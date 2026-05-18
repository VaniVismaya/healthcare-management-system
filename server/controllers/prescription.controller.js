const { pool } = require('../config/database');
const { sendNotification } = require('../utils/notification');

// Create prescription
exports.createPrescription = async (req, res) => {
  const { appointment_id, diagnosis, notes, follow_up_date, medicines, pharmacist_id } = req.body;
  const doctorId = req.user.id;

  try {
    const [appt] = await pool.query('SELECT * FROM appointments WHERE id = ?', [appointment_id]);
    if (!appt.length) return res.status(404).json({ error: 'Appointment not found' });

    const [result] = await pool.query(
      'INSERT INTO prescriptions (appointment_id, doctor_id, patient_id, pharmacist_id, diagnosis, notes, follow_up_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [appointment_id, doctorId, appt[0].patient_id, pharmacist_id || null, diagnosis, notes, follow_up_date || null]
    );

    const prescriptionId = result.insertId;

    // Insert medicines
    if (medicines && medicines.length) {
      for (const med of medicines) {
        await pool.query(
          `INSERT INTO prescription_medicines (prescription_id, medicine_id, medicine_name, dosage, frequency, morning, afternoon, evening, before_food, duration_days, quantity, instructions)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [prescriptionId, med.medicine_id || null, med.medicine_name, med.dosage, med.frequency,
           med.morning || 0, med.afternoon || 0, med.evening || 0, med.before_food || false,
           med.duration_days, med.quantity, med.instructions || null]
        );
      }
    }

    // Notify patient
    await sendNotification(appt[0].patient_id, 'Prescription Ready',
      'Your doctor has added a prescription. View it in your appointments.', 'prescription', prescriptionId, 'prescription');

    // Notify pharmacist if assigned
    if (pharmacist_id) {
      await sendNotification(pharmacist_id, 'New Prescription',
        `New prescription assigned for patient. Please review.`, 'prescription', prescriptionId, 'prescription');
    }

    res.status(201).json({ prescription_id: prescriptionId, message: 'Prescription created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get prescription
exports.getPrescription = async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const [prescriptions] = await pool.query(
      `SELECT p.*, 
              d.name as doctor_name, d.profile_image as doctor_image,
              pat.name as patient_name, pat.phone as patient_phone,
              a.appointment_date, a.appointment_time,
              c.name as clinic_name
       FROM prescriptions p
       JOIN users d ON p.doctor_id = d.id
       JOIN users pat ON p.patient_id = pat.id
       LEFT JOIN appointments a ON p.appointment_id = a.id
       LEFT JOIN clinics c ON a.clinic_id = c.id
       WHERE p.id = ?`,
      [id]
    );

    if (!prescriptions.length) return res.status(404).json({ error: 'Prescription not found' });

    const pres = prescriptions[0];

    // Access control
    if (user.role === 'patient' && pres.patient_id !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [medicines] = await pool.query(
      'SELECT * FROM prescription_medicines WHERE prescription_id = ?', [id]
    );

    res.json({ prescription: pres, medicines });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get prescriptions list
exports.getPrescriptions = async (req, res) => {
  const user = req.user;
  try {
    let where = '';
    const params = [];

    if (user.role === 'patient') {
      where = 'WHERE p.patient_id = ?'; params.push(user.id);
    } else if (user.role === 'doctor') {
      where = 'WHERE p.doctor_id = ?'; params.push(user.id);
    } else if (user.role === 'pharmacist') {
      where = 'WHERE p.pharmacist_id = ?'; params.push(user.id);
    }

    const [prescriptions] = await pool.query(
      `SELECT p.id, p.diagnosis, p.created_at, p.is_dispensed,
              d.name as doctor_name, pat.name as patient_name, pat.phone as patient_phone,
              a.appointment_date
       FROM prescriptions p
       JOIN users d ON p.doctor_id = d.id
       JOIN users pat ON p.patient_id = pat.id
       LEFT JOIN appointments a ON p.appointment_id = a.id
       ${where}
       ORDER BY p.created_at DESC`,
      params
    );

    res.json({ prescriptions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Mark dispensed (pharmacist only)
exports.markDispensed = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE prescriptions SET is_dispensed = 1, pharmacist_id = ?, dispensed_at = NOW() WHERE id = ?',
      [req.user.id, id]);

    const [pres] = await pool.query('SELECT patient_id, doctor_id FROM prescriptions WHERE id = ?', [id]);
    if (pres.length) {
      await sendNotification(pres[0].patient_id, 'Prescription Dispensed',
        'Your prescription medicines have been dispensed.', 'prescription', id, 'prescription');
    }

    res.json({ message: 'Marked as dispensed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
