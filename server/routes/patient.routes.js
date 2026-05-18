const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { enforcePlanRule, SubscriptionLimitError } = require('../utils/subscriptionLimits');

const insuranceDir = path.join(__dirname, '..', 'uploads', 'insurance');
if (!fs.existsSync(insuranceDir)) {
  fs.mkdirSync(insuranceDir, { recursive: true });
}
const insuranceStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, insuranceDir),
  filename: (req, file, cb) => cb(null, `insurance-${req.user.id}-${Date.now()}${path.extname(file.originalname)}`)
});
const insuranceUpload = multer({ storage: insuranceStorage, limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticate);

// Get patient profile
router.get('/profile', async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT u.*, pp.* FROM users u LEFT JOIN patient_profiles pp ON u.id = pp.user_id WHERE u.id = ?`, [req.user.id]
    );
    res.json({ patient: users[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update patient profile
router.put('/profile', async (req, res) => {
  const { date_of_birth, gender, blood_group, address, city, state, pincode, emergency_contact_name, emergency_contact_phone, allergies, chronic_conditions } = req.body;
  try {
    const [existing] = await pool.query('SELECT id FROM patient_profiles WHERE user_id = ?', [req.user.id]);
    if (existing.length) {
      await pool.query(
        `UPDATE patient_profiles SET date_of_birth=?, gender=?, blood_group=?, address=?, city=?, state=?, pincode=?, emergency_contact_name=?, emergency_contact_phone=?, allergies=?, chronic_conditions=? WHERE user_id=?`,
        [date_of_birth, gender, blood_group, address, city, state, pincode, emergency_contact_name, emergency_contact_phone, allergies, chronic_conditions, req.user.id]
      );
    } else {
      await pool.query(
        `INSERT INTO patient_profiles (user_id, date_of_birth, gender, blood_group, address, city, state, pincode, emergency_contact_name, emergency_contact_phone, allergies, chronic_conditions) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [req.user.id, date_of_birth, gender, blood_group, address, city, state, pincode, emergency_contact_name, emergency_contact_phone, allergies, chronic_conditions]
      );
    }
    res.json({ message: 'Profile updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Insurance policies (KYC)
router.get('/insurance', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, provider, policy_number, plan_name, valid_from, valid_to, kyc_doc_path, status, created_at
       FROM insurance_policies
       WHERE patient_id = ?
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ policies: rows });
  } catch (err) {
    if (err instanceof SubscriptionLimitError) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code, details: err.details });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/insurance', insuranceUpload.single('document'), async (req, res) => {
  const { provider, policy_number, plan_name, valid_from, valid_to } = req.body;
  if (!provider || !policy_number) {
    return res.status(400).json({ error: 'Provider and policy number are required' });
  }
  const docPath = req.file ? `/uploads/insurance/${req.file.filename}` : null;
  try {
    const [result] = await pool.query(
      `INSERT INTO insurance_policies (patient_id, provider, policy_number, plan_name, valid_from, valid_to, kyc_doc_path)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, provider, policy_number, plan_name || null, valid_from || null, valid_to || null, docPath]
    );
    res.status(201).json({ policy_id: result.insertId, message: 'Insurance saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search patient by phone (for receptionist/doctor/lab)
router.get('/search', authorize('receptionist','doctor','laboratory','admin'), async (req, res) => {
  const { phone, name } = req.query;
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });
  try {
    let where = 'r.name = ? AND u.phone LIKE ?';
    const params = ['patient', `%${phone}%`];
    if (name) {
      where += ' AND u.name LIKE ?';
      params.push(`%${name}%`);
    }
    const [patients] = await pool.query(
      `SELECT u.id, u.name, u.phone, u.profile_image, pp.date_of_birth, pp.gender, pp.blood_group 
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN patient_profiles pp ON u.id = pp.user_id
       WHERE ${where}`,
      params
    );
    res.json({ patients });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Past visit summary for patient
router.get('/summary', async (req, res) => {
  try {
    const [appointments] = await pool.query(
      `SELECT a.id as appointment_id, a.appointment_date, a.appointment_time, a.reason_for_visit,
              d.name as doctor_name, c.name as clinic_name
       FROM appointments a
       JOIN users d ON a.doctor_id = d.id
       JOIN clinics c ON a.clinic_id = c.id
       WHERE a.patient_id = ? AND a.status = 'completed'
       ORDER BY a.appointment_date DESC, a.appointment_time DESC
       LIMIT 50`,
      [req.user.id]
    );

    if (!appointments.length) return res.json({ visits: [] });

    const appointmentIds = appointments.map(a => a.appointment_id);

    const [prescriptions] = await pool.query(
      'SELECT * FROM prescriptions WHERE appointment_id IN (?)',
      [appointmentIds]
    );

    const prescriptionIds = prescriptions.map(p => p.id);
    let medicines = [];
    if (prescriptionIds.length) {
      const [medRows] = await pool.query(
        'SELECT * FROM prescription_medicines WHERE prescription_id IN (?)',
        [prescriptionIds]
      );
      medicines = medRows;
    }

    const [reports] = await pool.query(
      `SELECT lr.id as report_id, lr.report_title, lr.created_at, lr.lab_order_id,
              lr.result_value, lr.result_unit, lr.result_flag, lr.normal_range_snapshot,
              lt.test_name, lo.appointment_id
       FROM lab_reports lr
       JOIN lab_orders lo ON lr.lab_order_id = lo.id
       LEFT JOIN lab_tests lt ON lr.test_id = lt.id
       WHERE lo.appointment_id IN (?) AND lo.patient_id = ?
       ORDER BY lr.created_at DESC`,
      [appointmentIds, req.user.id]
    );

    const [vitalsRows] = await pool.query(
      `SELECT * FROM patient_vitals
       WHERE appointment_id IN (?)
       ORDER BY created_at DESC`,
      [appointmentIds]
    );

    const presByAppt = prescriptions.reduce((acc, p) => {
      acc[p.appointment_id] = p;
      return acc;
    }, {});
    const medsByPres = medicines.reduce((acc, m) => {
      acc[m.prescription_id] = acc[m.prescription_id] || [];
      acc[m.prescription_id].push(m);
      return acc;
    }, {});
    const reportsByAppt = reports.reduce((acc, r) => {
      acc[r.appointment_id] = acc[r.appointment_id] || [];
      acc[r.appointment_id].push(r);
      return acc;
    }, {});
    const vitalsByAppt = vitalsRows.reduce((acc, v) => {
      if (!acc[v.appointment_id]) acc[v.appointment_id] = v;
      return acc;
    }, {});

    const visits = appointments.map((a) => {
      const pres = presByAppt[a.appointment_id];
      return {
        appointment_id: a.appointment_id,
        appointment_date: a.appointment_date,
        appointment_time: a.appointment_time,
        reason_for_visit: a.reason_for_visit,
        doctor_name: a.doctor_name,
        clinic_name: a.clinic_name,
        prescription_id: pres?.id || null,
        diagnosis: pres?.diagnosis || null,
        notes: pres?.notes || null,
        medicines: pres ? (medsByPres[pres.id] || []) : [],
        lab_reports: reportsByAppt[a.appointment_id] || [],
        vitals: vitalsByAppt[a.appointment_id] || null
      };
    });

    res.json({ visits });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
