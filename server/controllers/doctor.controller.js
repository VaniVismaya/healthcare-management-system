const { pool } = require('../config/database');
const { sendNotification } = require('../utils/notification');
const { parseIdList, resolveDoctorProfileFields } = require('../utils/doctorProfileData');
const { enforcePlanRule, SubscriptionLimitError } = require('../utils/subscriptionLimits');

const normalizePath = (p) => (p ? p.replace(/\\/g, '/') : p);
let consultationFeesTableReady = false;
let scheduleOverridesReady = false;

const ensureConsultationFeesTable = async () => {
  if (consultationFeesTableReady) return;
  await pool.query(
    `CREATE TABLE IF NOT EXISTS doctor_consultation_fees (
      id INT AUTO_INCREMENT PRIMARY KEY,
      doctor_id INT NOT NULL,
      clinic_id INT NOT NULL,
      department_id INT NOT NULL DEFAULT 0,
      consultation_type ENUM('in_person', 'video', 'home_visit') DEFAULT 'in_person',
      priority_level ENUM('normal', 'priority') DEFAULT 'normal',
      new_patient_fee DECIMAL(10,2) DEFAULT 0,
      follow_up_fee DECIMAL(10,2) NULL,
      currency VARCHAR(8) DEFAULT 'INR',
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_doctor_clinic_department_type (doctor_id, clinic_id, department_id, consultation_type, priority_level),
      KEY idx_doctor_consultation_clinic (clinic_id),
      KEY idx_doctor_consultation_doctor (doctor_id)
    )`
  );
  const [priorityRows] = await pool.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'doctor_consultation_fees'
       AND COLUMN_NAME = 'priority_level'`
  );
  if (!priorityRows.length) {
    await pool.query(
      `ALTER TABLE doctor_consultation_fees
       ADD COLUMN priority_level ENUM('normal', 'priority') DEFAULT 'normal' AFTER consultation_type`
    );
  }
  consultationFeesTableReady = true;
};

const ensureScheduleOverridesSupport = async () => {
  if (scheduleOverridesReady) return;
  const [overrideDateRows] = await pool.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'doctor_schedules'
       AND COLUMN_NAME = 'override_date'`
  );
  if (!overrideDateRows.length) {
    await pool.query(
      `ALTER TABLE doctor_schedules
       ADD COLUMN override_date DATE NULL AFTER clinic_id`
    );
  }
  scheduleOverridesReady = true;
};

const seedLegacyConsultationFee = async (doctorId) => {
  await ensureConsultationFeesTable();
  await pool.query(
    `INSERT INTO doctor_consultation_fees (
       doctor_id, clinic_id, department_id, consultation_type, priority_level, new_patient_fee, follow_up_fee, currency, is_active
     )
     SELECT dp.user_id, dp.clinic_id, 0, 'in_person', 'normal', dp.consultation_fee, NULL, 'INR', 1
     FROM doctor_profiles dp
     WHERE dp.user_id = ?
       AND dp.clinic_id IS NOT NULL
       AND dp.consultation_fee IS NOT NULL
       AND dp.consultation_fee > 0
       AND NOT EXISTS (
         SELECT 1
         FROM doctor_consultation_fees dcf
         WHERE dcf.doctor_id = dp.user_id
           AND dcf.clinic_id = dp.clinic_id
           AND dcf.department_id = 0
           AND dcf.consultation_type = 'in_person'
           AND dcf.priority_level = 'normal'
       )`,
    [doctorId]
  );
};

const getUploadedFiles = (files) => (Array.isArray(files) ? files : []);
const getNamedUpload = (files, fieldName) => getUploadedFiles(files).find((file) => file.fieldname === fieldName);
const buildUploadMap = (files, prefix) => {
  const entries = getUploadedFiles(files)
    .filter((file) => String(file.fieldname || '').startsWith(prefix))
    .map((file) => [Number(String(file.fieldname).slice(prefix.length)), normalizePath(file.path)])
    .filter(([id, path]) => Number.isInteger(id) && id > 0 && path);
  return new Map(entries);
};

const syncDoctorDocuments = async (tableName, idColumn, userId, activeIds, uploadMap) => {
  if (activeIds.length) {
    await pool.query(`DELETE FROM ${tableName} WHERE user_id = ? AND ${idColumn} NOT IN (?)`, [userId, activeIds]);
  } else {
    await pool.query(`DELETE FROM ${tableName} WHERE user_id = ?`, [userId]);
  }

  for (const [itemId, certificatePath] of uploadMap.entries()) {
    await pool.query(
      `INSERT INTO ${tableName} (user_id, ${idColumn}, certificate_path)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE certificate_path = VALUES(certificate_path)`,
      [userId, itemId, certificatePath]
    );
  }
};

const loadDoctorCredentialDocs = async (userId, specializationIds = [], educationIds = []) => {
  const [specializationDocs] = specializationIds.length
    ? await pool.query(
      `SELECT dsc.specialization_id, dsc.certificate_path, ms.name
       FROM doctor_specialization_certificates dsc
       JOIN medical_specializations ms ON dsc.specialization_id = ms.id
       WHERE dsc.user_id = ? AND dsc.specialization_id IN (?)
       ORDER BY ms.name`,
      [userId, specializationIds]
    )
    : [[]];
  const [educationDocs] = educationIds.length
    ? await pool.query(
      `SELECT de.education_id, de.certificate_path, me.name
       FROM doctor_education_certificates de
       JOIN medical_educations me ON de.education_id = me.id
       WHERE de.user_id = ? AND de.education_id IN (?)
       ORDER BY me.name`,
      [userId, educationIds]
    )
    : [[]];

  return {
    specializationDocs: specializationDocs || [],
    educationDocs: educationDocs || [],
  };
};

const notifyAdmins = async (message, referenceId) => {
  const [admins] = await pool.query(
    `SELECT u.id FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE r.name = 'admin' AND u.is_active = 1`
  );
  for (const admin of admins) {
    await sendNotification(admin.id, 'Verification Requested', message, 'verification', referenceId, 'user');
  }
};

// Complete doctor profile setup
exports.setupProfile = async (req, res) => {
  const {
    specialization,
    qualification,
    medical_license_number,
    experience_years,
    bio,
    languages,
    department_ids,
    primary_specialization_id,
    additional_specialization_ids,
    education_ids,
  } = req.body;
  const userId = req.user.id;
  const expYears = (experience_years === '' || experience_years === undefined || experience_years === null)
    ? null
    : Number.parseInt(experience_years, 10);

  try {
    const resolved = await resolveDoctorProfileFields(pool, {
      specialization,
      qualification,
      primary_specialization_id,
      additional_specialization_ids,
      education_ids,
    });

    const specializationName = resolved.specialization;
    const qualificationName = resolved.qualification;
    const departmentIds = parseIdList(department_ids);
    const specializationIdsForDocs = [...new Set([resolved.primarySpecializationId, ...(resolved.additionalSpecializationIds || [])].filter(Boolean))];
    const educationIdsForDocs = [...new Set((resolved.educationIds || []).filter(Boolean))];
    const specializationUploadMap = buildUploadMap(req.files, 'specialization_certificate_');
    const educationUploadMap = buildUploadMap(req.files, 'education_certificate_');

    if (!specializationName || !qualificationName || !medical_license_number) {
      return res.status(400).json({ error: 'Primary specialization, education, and license number are required' });
    }
    const [[user]] = await pool.query('SELECT profile_image FROM users WHERE id = ?', [userId]);
    if (!user?.profile_image) {
      return res.status(400).json({ error: 'Profile image is required' });
    }
    const certPath = normalizePath(getNamedUpload(req.files, 'license_certificate')?.path) || null;
    const [existing] = await pool.query('SELECT id, specialization, qualification, medical_license_number, license_certificate_path, is_verified FROM doctor_profiles WHERE user_id = ?', [userId]);
    const [[existingUser]] = await pool.query('SELECT is_verified FROM users WHERE id = ?', [userId]);
    if (!certPath && (!existing.length || !existing[0]?.license_certificate_path)) {
      return res.status(400).json({ error: 'License certificate is required' });
    }
    const wasVerified = !!(existingUser?.is_verified && existing[0]?.is_verified);
    const mandatoryChanged = existing.length
      && (
        String(existing[0].specialization || '') !== String(specializationName || '') ||
        String(existing[0].qualification || '') !== String(qualificationName || '') ||
        String(existing[0].medical_license_number || '') !== String(medical_license_number || '') ||
        !!certPath
      );
    
    if (existing.length) {
      const existingCert = existing[0].license_certificate_path || null;
      await pool.query(
        `UPDATE doctor_profiles
         SET specialization=?, qualification=?, medical_license_number=?, 
             license_certificate_path=?, experience_years=?, bio=?, languages=?,
             primary_specialization_id=?, additional_specialization_ids=?, education_ids=?, is_verified=?
         WHERE user_id=?`,
        [
          specializationName,
          qualificationName,
          medical_license_number,
          certPath || existingCert,
          expYears,
          bio,
          languages,
          resolved.primarySpecializationId,
          JSON.stringify(resolved.additionalSpecializationIds || []),
          JSON.stringify(resolved.educationIds || []),
          (wasVerified && mandatoryChanged) ? 0 : existing[0].is_verified,
          userId,
        ]
      );
      if (wasVerified && mandatoryChanged) {
        await pool.query('UPDATE users SET is_verified = 0 WHERE id = ?', [userId]);
      }
    } else {
      const licCert = certPath;
      await pool.query(
        `INSERT INTO doctor_profiles (
           user_id, specialization, qualification, medical_license_number, license_certificate_path,
           experience_years, bio, languages, primary_specialization_id, additional_specialization_ids, education_ids
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          specializationName,
          qualificationName,
          medical_license_number,
          licCert,
          expYears,
          bio,
          languages,
          resolved.primarySpecializationId,
          JSON.stringify(resolved.additionalSpecializationIds || []),
          JSON.stringify(resolved.educationIds || []),
        ]
      );
    }

    if (department_ids !== undefined) {
      await pool.query('DELETE FROM doctor_departments WHERE doctor_id = ?', [userId]);
      for (const deptId of departmentIds) {
        await pool.query('INSERT IGNORE INTO doctor_departments (doctor_id, department_id) VALUES (?, ?)', [userId, deptId]);
      }
    }

    await syncDoctorDocuments('doctor_specialization_certificates', 'specialization_id', userId, specializationIdsForDocs, specializationUploadMap);
    await syncDoctorDocuments('doctor_education_certificates', 'education_id', userId, educationIdsForDocs, educationUploadMap);

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get doctor profile with details
exports.getDoctorProfile = async (req, res) => {
  const doctorId = req.params.id || req.user.id;
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.uuid, u.name, u.email, u.phone, u.profile_image,
              dp.specialization, dp.qualification, dp.medical_license_number, dp.experience_years, dp.consultation_fee, dp.bio, dp.languages, dp.is_verified,
              dp.license_certificate_path, dp.primary_specialization_id, dp.additional_specialization_ids, dp.education_ids,
              GROUP_CONCAT(md.name) as departments,
              GROUP_CONCAT(dd.department_id) as department_ids
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
       LEFT JOIN doctor_departments dd ON u.id = dd.doctor_id
       LEFT JOIN medical_departments md ON dd.department_id = md.id
       WHERE u.id = ? AND r.name = 'doctor'
       GROUP BY u.id`,
      [doctorId]
    );

    if (!users.length) return res.status(404).json({ error: 'Doctor not found' });

    const doctor = users[0];
    const additionalSpecializationIds = parseIdList(doctor.additional_specialization_ids);
    const educationIds = parseIdList(doctor.education_ids);
    const specializationIdsToLoad = [...new Set([doctor.primary_specialization_id, ...additionalSpecializationIds].filter(Boolean))];
    const [specializationRows] = specializationIdsToLoad.length
      ? await pool.query('SELECT id, name FROM medical_specializations WHERE id IN (?) ORDER BY name', [specializationIdsToLoad])
      : [[]];
    const [educationRows] = educationIds.length
      ? await pool.query('SELECT id, name FROM medical_educations WHERE id IN (?) ORDER BY name', [educationIds])
      : [[]];
    const specializationMap = new Map((specializationRows || []).map((row) => [row.id, row.name]));
    const educationMap = new Map((educationRows || []).map((row) => [row.id, row.name]));

    doctor.additional_specialization_ids = additionalSpecializationIds;
    doctor.additional_specializations = additionalSpecializationIds.map((id) => specializationMap.get(id)).filter(Boolean);
    doctor.education_ids = educationIds;
    doctor.educations = educationIds.map((id) => educationMap.get(id)).filter(Boolean);
    doctor.primary_specialization = doctor.primary_specialization_id
      ? (specializationMap.get(Number(doctor.primary_specialization_id)) || doctor.specialization)
      : doctor.specialization;
    const { specializationDocs, educationDocs } = await loadDoctorCredentialDocs(doctorId, specializationIdsToLoad, educationIds);
    doctor.specialization_certificates = specializationDocs.map((docRow) => ({
      specialization_id: docRow.specialization_id,
      name: docRow.name,
      certificate_path: docRow.certificate_path,
      is_primary: Number(docRow.specialization_id) === Number(doctor.primary_specialization_id),
    }));
    doctor.education_certificates = educationDocs.map((docRow) => ({
      education_id: docRow.education_id,
      name: docRow.name,
      certificate_path: docRow.certificate_path,
    }));

    const [clinics] = await pool.query(
      `SELECT c.* FROM clinics c
       JOIN doctor_profiles dp ON c.id = dp.clinic_id
       WHERE dp.user_id = ? AND c.is_active = 1`,
      [doctorId]
    );

    res.json({ doctor, clinics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add guest doctor
exports.addGuestDoctor = async (req, res) => {
  const { name, phone, email, specialization, qualification, clinic_id } = req.body;
  const mainDoctorId = req.user.id;

  try {
    // Verify clinic belongs to this doctor
    const [clinic] = await pool.query('SELECT id FROM clinics WHERE id = ? AND owner_doctor_id = ?', [clinic_id, mainDoctorId]);
    if (!clinic.length) return res.status(403).json({ error: 'Clinic not found or unauthorized' });

    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    // Check existing user
    let userId;
    const [existing] = await pool.query('SELECT id FROM users WHERE phone = ?', [phone]);
    
    if (existing.length) {
      userId = existing[0].id;
    } else {
      const bcrypt = require('bcryptjs');
      const tempPassword = Math.random().toString(36).slice(-8);
      const hash = await bcrypt.hash(tempPassword, 12);
      
      const [result] = await pool.query(
        'INSERT INTO users (name, email, phone, password_hash, role_id, is_verified) VALUES (?, ?, ?, ?, (SELECT id FROM roles WHERE name = ?), ?)',
        [name, email || null, phone, hash, 'doctor', true]
      );
      userId = result.insertId;

      console.log(`\n🔑 Guest Doctor Credentials - Phone: ${phone}, Temp Password: ${tempPassword}\n`);
    }

    await pool.query('INSERT IGNORE INTO doctor_profiles (user_id, specialization, qualification, clinic_id, is_guest_doctor, main_doctor_id, is_verified) VALUES (?, ?, ?, ?, 1, ?, 1)',
      [userId, specialization, qualification, clinic_id, mainDoctorId]);

    await sendNotification(userId, 'Account Created', 
      `You have been added as a guest doctor at clinic. Login with your phone number.`, 'system');

    res.status(201).json({ message: 'Guest doctor added successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Set schedule
exports.setSchedule = async (req, res) => {
  const { clinic_id, schedules } = req.body; // schedules: array of {day_of_week, start_time, end_time, session_label, slot_duration_minutes, max_patients_per_slot}
  const doctorId = req.user.id;

  try {
    await ensureScheduleOverridesSupport();
    if (!clinic_id) {
      return res.status(400).json({ error: 'Clinic is required' });
    }
    if (!Array.isArray(schedules) || !schedules.length) {
      return res.status(400).json({ error: 'Add at least one weekly schedule session' });
    }

    // Clear only recurring weekly schedules, keep date-wise overrides intact.
    await pool.query(
      'DELETE FROM doctor_schedules WHERE doctor_id = ? AND clinic_id = ? AND override_date IS NULL',
      [doctorId, clinic_id]
    );

    for (const s of schedules) {
      await pool.query(
        `INSERT INTO doctor_schedules
           (doctor_id, clinic_id, override_date, day_of_week, session_label, start_time, end_time, slot_duration_minutes, max_patients_per_slot)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
        [doctorId, clinic_id, s.day_of_week, s.session_label || 'Session', s.start_time, s.end_time, s.slot_duration_minutes || 15, s.max_patients_per_slot || 30]
      );
    }

    res.json({ message: 'Weekly schedule saved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.saveScheduleOverride = async (req, res) => {
  const {
    id,
    clinic_id,
    override_date,
    session_label,
    start_time,
    end_time,
    slot_duration_minutes,
    max_patients_per_slot,
  } = req.body;
  const doctorId = req.user.id;

  try {
    await ensureScheduleOverridesSupport();
    if (!clinic_id || !override_date || !start_time || !end_time) {
      return res.status(400).json({ error: 'Clinic, date, start time, and end time are required' });
    }

    if (id) {
      const [rows] = await pool.query(
        `UPDATE doctor_schedules
         SET clinic_id = ?, override_date = ?, day_of_week = ?, session_label = ?, start_time = ?, end_time = ?,
             slot_duration_minutes = ?, max_patients_per_slot = ?
         WHERE id = ? AND doctor_id = ? AND override_date IS NOT NULL`,
        [
          clinic_id,
          override_date,
          new Date(`${override_date}T00:00:00`).getDay(),
          session_label || 'Custom Session',
          start_time,
          end_time,
          slot_duration_minutes || 15,
          max_patients_per_slot || 30,
          id,
          doctorId,
        ]
      );
      if (!rows.affectedRows) {
        return res.status(404).json({ error: 'Override session not found' });
      }
    } else {
      await pool.query(
        `INSERT INTO doctor_schedules
           (doctor_id, clinic_id, override_date, day_of_week, session_label, start_time, end_time, slot_duration_minutes, max_patients_per_slot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          doctorId,
          clinic_id,
          override_date,
          new Date(`${override_date}T00:00:00`).getDay(),
          session_label || 'Custom Session',
          start_time,
          end_time,
          slot_duration_minutes || 15,
          max_patients_per_slot || 30,
        ]
      );
    }

    res.json({ message: 'Date-wise schedule override saved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteScheduleOverride = async (req, res) => {
  const doctorId = req.user.id;
  try {
    await ensureScheduleOverridesSupport();
    const [rows] = await pool.query(
      'DELETE FROM doctor_schedules WHERE id = ? AND doctor_id = ? AND override_date IS NOT NULL',
      [req.params.id, doctorId]
    );
    if (!rows.affectedRows) {
      return res.status(404).json({ error: 'Override session not found' });
    }
    res.json({ message: 'Date-wise override removed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Mark leave
exports.markLeave = async (req, res) => {
  const { clinic_id, leave_date, leave_type, reason } = req.body;
  const doctorId = req.user.id;

  try {
    await pool.query(
      'INSERT INTO doctor_leaves (doctor_id, clinic_id, leave_date, leave_type, reason) VALUES (?, ?, ?, ?, ?)',
      [doctorId, clinic_id || null, leave_date, leave_type || 'full_day', reason]
    );
    res.json({ message: 'Leave marked' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Search doctors
exports.searchDoctors = async (req, res) => {
  const { name, city, department_id, clinic_id, latitude, longitude, radius_km } = req.query;
  const lat = Number.parseFloat(latitude);
  const lng = Number.parseFloat(longitude);
  const radius = Number.parseFloat(radius_km) || 10;
  const useGeo = Number.isFinite(lat) && Number.isFinite(lng);
  const distanceExpr = `6371 * acos(
    cos(radians(?)) * cos(radians(c.latitude)) * cos(radians(c.longitude) - radians(?)) +
    sin(radians(?)) * sin(radians(c.latitude))
  )`;
  try {
    await ensureConsultationFeesTable();
    let query = `
      SELECT u.id, u.name, u.profile_image,
             dp.specialization,
             COALESCE(MAX(NULLIF(dcf.new_patient_fee, 0)), dp.consultation_fee) as consultation_fee,
             dp.experience_years, dp.bio,
             c.id as clinic_id, c.name as clinic_name, c.city, c.address,
             GROUP_CONCAT(DISTINCT md.name) as departments
             ${useGeo ? `, MIN(${distanceExpr}) as distance_km` : ''}
      FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN doctor_profiles dp ON u.id = dp.user_id
      LEFT JOIN clinics c ON dp.clinic_id = c.id
      LEFT JOIN doctor_consultation_fees dcf
        ON dcf.doctor_id = u.id
       AND dcf.clinic_id = c.id
       AND dcf.department_id = 0
       AND dcf.consultation_type = 'in_person'
       AND dcf.priority_level = 'normal'
       AND dcf.is_active = 1
      LEFT JOIN doctor_departments dd ON u.id = dd.doctor_id
      LEFT JOIN medical_departments md ON dd.department_id = md.id
      WHERE r.name = 'doctor' AND u.is_verified = 1 AND u.is_active = 1 AND dp.is_verified = 1
    `;
    const params = [];

    if (useGeo) {
      query += ' AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL';
    }
    if (name) { query += ' AND u.name LIKE ?'; params.push(`%${name}%`); }
    if (city) { query += ' AND c.city LIKE ?'; params.push(`%${city}%`); }
    if (department_id) { query += ' AND dd.department_id = ?'; params.push(department_id); }
    if (clinic_id) { query += ' AND dp.clinic_id = ?'; params.push(clinic_id); }

    if (useGeo) {
      params.push(lat, lng, lat);
    }
    query += ' GROUP BY u.id, c.id';
    if (useGeo) {
      query += ' HAVING distance_km <= ?';
      params.push(radius);
      query += ' ORDER BY distance_km ASC, dp.experience_years DESC';
    } else {
      query += ' ORDER BY dp.experience_years DESC';
    }

    const [doctors] = await pool.query(query, params);
    res.json({ doctors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getConsultationFees = async (req, res) => {
  try {
    await seedLegacyConsultationFee(req.user.id);
    const [fees] = await pool.query(
      `SELECT dcf.id, dcf.clinic_id, c.name as clinic_name,
              dcf.department_id,
              CASE WHEN dcf.department_id = 0 THEN 'All Departments' ELSE md.name END as department_name,
              dcf.consultation_type, dcf.priority_level, dcf.new_patient_fee, dcf.follow_up_fee, dcf.currency, dcf.is_active
       FROM doctor_consultation_fees dcf
       JOIN clinics c ON c.id = dcf.clinic_id
       LEFT JOIN medical_departments md ON md.id = dcf.department_id AND dcf.department_id > 0
       WHERE dcf.doctor_id = ? AND c.owner_doctor_id = ?
       ORDER BY c.name, dcf.department_id, dcf.consultation_type, dcf.priority_level`,
      [req.user.id, req.user.id]
    );
    res.json({ fees });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.saveConsultationFee = async (req, res) => {
  const {
    id,
    clinic_id,
    department_id,
    consultation_type,
    priority_level,
    new_patient_fee,
    follow_up_fee,
  } = req.body;
  const doctorId = req.user.id;
  const clinicId = Number(clinic_id);
  const departmentId = Number(department_id) || 0;
  const allowedTypes = ['in_person', 'video', 'home_visit'];
  const consultType = allowedTypes.includes(consultation_type) ? consultation_type : 'in_person';
  const priorityLevel = priority_level === 'priority' ? 'priority' : 'normal';
  const newFee = Number.parseFloat(new_patient_fee);
  const followFee = follow_up_fee === '' || follow_up_fee === null || follow_up_fee === undefined
    ? null
    : Number.parseFloat(follow_up_fee);

  try {
    await ensureConsultationFeesTable();
    if (!clinicId) {
      return res.status(400).json({ error: 'Clinic is required' });
    }
    if (!Number.isFinite(newFee) || newFee < 0) {
      return res.status(400).json({ error: 'Enter a valid new patient fee' });
    }
    if (followFee !== null && (!Number.isFinite(followFee) || followFee < 0)) {
      return res.status(400).json({ error: 'Enter a valid follow-up fee' });
    }

    const [clinicRows] = await pool.query(
      'SELECT id FROM clinics WHERE id = ? AND owner_doctor_id = ?',
      [clinicId, doctorId]
    );
    if (!clinicRows.length) {
      return res.status(403).json({ error: 'Clinic not found or unauthorized' });
    }

    if (departmentId > 0) {
      const [departmentRows] = await pool.query(
        'SELECT id FROM medical_departments WHERE id = ?',
        [departmentId]
      );
      if (!departmentRows.length) {
        return res.status(400).json({ error: 'Department not found' });
      }
    }

    if (id) {
      const [existingRows] = await pool.query(
        `SELECT dcf.id
         FROM doctor_consultation_fees dcf
         JOIN clinics c ON c.id = dcf.clinic_id
         WHERE dcf.id = ? AND dcf.doctor_id = ? AND c.owner_doctor_id = ?`,
        [id, doctorId, doctorId]
      );
      if (!existingRows.length) {
        return res.status(404).json({ error: 'Consultation fee record not found' });
      }

      await pool.query(
        `UPDATE doctor_consultation_fees
         SET clinic_id = ?, department_id = ?, consultation_type = ?, priority_level = ?, new_patient_fee = ?, follow_up_fee = ?, is_active = 1
         WHERE id = ? AND doctor_id = ?`,
        [clinicId, departmentId, consultType, priorityLevel, newFee, followFee, id, doctorId]
      );
    } else {
      await pool.query(
        `INSERT INTO doctor_consultation_fees (
           doctor_id, clinic_id, department_id, consultation_type, priority_level, new_patient_fee, follow_up_fee, currency, is_active
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'INR', 1)
         ON DUPLICATE KEY UPDATE
           new_patient_fee = VALUES(new_patient_fee),
           follow_up_fee = VALUES(follow_up_fee),
           is_active = VALUES(is_active),
           updated_at = CURRENT_TIMESTAMP`,
        [doctorId, clinicId, departmentId, consultType, priorityLevel, newFee, followFee]
      );
    }

    res.json({ message: 'Consultation fee saved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getApplicableConsultationFee = async (req, res) => {
  const { doctor_id, clinic_id, department_id, consultation_type, priority_level } = req.query;
  try {
    await ensureConsultationFeesTable();
    const doctorId = Number(doctor_id);
    const clinicId = Number(clinic_id);
    const departmentId = Number(department_id) || 0;
    const consultType = ['in_person', 'video', 'home_visit'].includes(String(consultation_type))
      ? String(consultation_type)
      : 'in_person';
    const priorityLevel = String(priority_level) === 'priority' ? 'priority' : 'normal';

    if (!doctorId || !clinicId) {
      return res.status(400).json({ error: 'Doctor and clinic are required' });
    }

    const [fees] = await pool.query(
      `SELECT dcf.id, dcf.doctor_id, dcf.clinic_id, dcf.department_id,
              dcf.consultation_type, dcf.priority_level, dcf.new_patient_fee, dcf.follow_up_fee, dcf.currency
       FROM doctor_consultation_fees dcf
       WHERE dcf.doctor_id = ?
         AND dcf.clinic_id = ?
         AND dcf.consultation_type = ?
         AND dcf.priority_level = ?
         AND dcf.department_id IN (?, 0)
         AND dcf.is_active = 1
       ORDER BY CASE WHEN dcf.department_id = ? THEN 0 ELSE 1 END
       LIMIT 1`,
      [doctorId, clinicId, consultType, priorityLevel, departmentId, departmentId]
    );

    if (fees.length) {
      return res.json({ fee: fees[0] });
    }

    const [[legacy]] = await pool.query(
      'SELECT consultation_fee FROM doctor_profiles WHERE user_id = ? AND clinic_id = ? LIMIT 1',
      [doctorId, clinicId]
    );

    return res.json({
      fee: legacy?.consultation_fee
        ? {
            doctor_id: doctorId,
            clinic_id: clinicId,
            department_id: 0,
            consultation_type: consultType,
            priority_level: priorityLevel,
            new_patient_fee: legacy.consultation_fee,
            follow_up_fee: null,
            currency: 'INR',
            legacy: true,
          }
        : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteConsultationFee = async (req, res) => {
  try {
    await ensureConsultationFeesTable();
    const [rows] = await pool.query(
      `DELETE dcf
       FROM doctor_consultation_fees dcf
       JOIN clinics c ON c.id = dcf.clinic_id
       WHERE dcf.id = ? AND dcf.doctor_id = ? AND c.owner_doctor_id = ?`,
      [req.params.id, req.user.id, req.user.id]
    );
    if (!rows.affectedRows) {
      return res.status(404).json({ error: 'Consultation fee record not found' });
    }
    res.json({ message: 'Consultation fee removed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get doctor schedules
exports.getSchedule = async (req, res) => {
  const doctorId = req.user.id;
  const { clinic_id } = req.query;
  try {
    await ensureScheduleOverridesSupport();
    let query = 'SELECT * FROM doctor_schedules WHERE doctor_id = ? AND override_date IS NULL';
    const params = [doctorId];
    if (clinic_id) {
      query += ' AND clinic_id = ?';
      params.push(clinic_id);
    }
    query += ' ORDER BY day_of_week ASC, start_time ASC';
    const [schedules] = await pool.query(query, params);
    res.json({ schedules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getScheduleOverrides = async (req, res) => {
  const doctorId = req.user.id;
  const { clinic_id, from, to } = req.query;
  try {
    await ensureScheduleOverridesSupport();
    let query = 'SELECT * FROM doctor_schedules WHERE doctor_id = ? AND override_date IS NOT NULL';
    const params = [doctorId];
    if (clinic_id) {
      query += ' AND clinic_id = ?';
      params.push(clinic_id);
    }
    if (from) {
      query += ' AND override_date >= ?';
      params.push(from);
    }
    if (to) {
      query += ' AND override_date <= ?';
      params.push(to);
    }
    query += ' ORDER BY override_date ASC, start_time ASC';
    const [overrides] = await pool.query(query, params);
    res.json({ overrides });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get doctor leaves
exports.getLeaves = async (req, res) => {
  const doctorId = req.user.id;
  const { clinic_id, from, to } = req.query;
  try {
    let query = 'SELECT * FROM doctor_leaves WHERE doctor_id = ?';
    const params = [doctorId];
    if (clinic_id) {
      query += ' AND clinic_id = ?';
      params.push(clinic_id);
    }
    if (from) {
      query += ' AND leave_date >= ?';
      params.push(from);
    }
    if (to) {
      query += ' AND leave_date <= ?';
      params.push(to);
    }
    query += ' ORDER BY leave_date DESC';
    const [leaves] = await pool.query(query, params);
    res.json({ leaves });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get patient details for doctor
exports.getPatientDetails = async (req, res) => {
  const { patientId } = req.params;
  try {
    const [patient] = await pool.query(
      `SELECT u.id, u.name, u.phone, u.email, u.profile_image,
              pp.date_of_birth, pp.gender, pp.blood_group, pp.allergies, pp.chronic_conditions
       FROM users u LEFT JOIN patient_profiles pp ON u.id = pp.user_id WHERE u.id = ?`,
      [patientId]
    );

    const [appointments] = await pool.query(
      `SELECT a.*, c.name as clinic_name FROM appointments a 
       JOIN clinics c ON a.clinic_id = c.id WHERE a.patient_id = ? ORDER BY a.appointment_date DESC LIMIT 10`,
      [patientId]
    );

    const [prescriptions] = await pool.query(
      `SELECT p.*, GROUP_CONCAT(pm.medicine_name) as medicines 
       FROM prescriptions p 
       LEFT JOIN prescription_medicines pm ON p.id = pm.prescription_id
       WHERE p.patient_id = ? GROUP BY p.id ORDER BY p.created_at DESC LIMIT 5`,
      [patientId]
    );

    const [labOrders] = await pool.query(
      'SELECT * FROM lab_orders WHERE patient_id = ? ORDER BY created_at DESC LIMIT 5',
      [patientId]
    );

    const [vitals] = await pool.query(
      `SELECT pv.*, a.appointment_date, a.appointment_time, c.name as clinic_name
       FROM patient_vitals pv
       JOIN appointments a ON pv.appointment_id = a.id
       LEFT JOIN clinics c ON a.clinic_id = c.id
       WHERE pv.patient_id = ?
       ORDER BY pv.created_at DESC
       LIMIT 20`,
      [patientId]
    );

    res.json({ patient: patient[0], appointments, prescriptions, labOrders, vitals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Dashboard stats
exports.getDashboardStats = async (req, res) => {
  const doctorId = req.user.id;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  try {
    const [[todayAppts]] = await pool.query(
      'SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND appointment_date = ?',
      [doctorId, today]
    );
    const [[pendingAppts]] = await pool.query(
      "SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND status = 'pending'",
      [doctorId]
    );
    const [[totalPatients]] = await pool.query(
      'SELECT COUNT(DISTINCT patient_id) as count FROM appointments WHERE doctor_id = ?',
      [doctorId]
    );
    const [[pendingLabs]] = await pool.query(
      "SELECT COUNT(*) as count FROM lab_orders WHERE doctor_id = ? AND status = 'pending'",
      [doctorId]
    );

    res.json({ today_appointments: todayAppts.count, pending_appointments: pendingAppts.count, total_patients: totalPatients.count, pending_lab_orders: pendingLabs.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// List guest doctors for main doctor
exports.getGuestDoctors = async (req, res) => {
  const doctorId = req.user.id;
  try {
    const [guests] = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.is_active,
              dp.specialization, dp.qualification, dp.clinic_id,
              c.name as clinic_name
       FROM doctor_profiles dp
       JOIN users u ON dp.user_id = u.id
       LEFT JOIN clinics c ON dp.clinic_id = c.id
       WHERE dp.is_guest_doctor = 1 AND dp.main_doctor_id = ?
       ORDER BY u.created_at DESC`,
      [doctorId]
    );
    res.json({ guests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Request admin verification (doctor)
exports.requestVerification = async (req, res) => {
  const userId = req.user.id;
  try {
    const [[user]] = await pool.query('SELECT name, profile_image, is_verified FROM users WHERE id = ?', [userId]);
    const [[profile]] = await pool.query(
      'SELECT specialization, qualification, medical_license_number, license_certificate_path, is_verified, primary_specialization_id, additional_specialization_ids, education_ids FROM doctor_profiles WHERE user_id = ?',
      [userId]
    );
    if (!user || !profile) return res.status(404).json({ error: 'Profile not found' });
    if (user.is_verified || profile.is_verified) return res.status(400).json({ error: 'Already verified' });

    if (!profile.specialization || !profile.qualification || !profile.medical_license_number) {
      return res.status(400).json({ error: 'Complete specialization, qualification, and license number first' });
    }
    if (!profile.license_certificate_path) {
      return res.status(400).json({ error: 'Upload license certificate first' });
    }
    if (!user.profile_image) {
      return res.status(400).json({ error: 'Upload profile photo first' });
    }

    const specializationIds = [...new Set([profile.primary_specialization_id, ...parseIdList(profile.additional_specialization_ids)].filter(Boolean))];
    const educationIds = parseIdList(profile.education_ids);
    const { specializationDocs, educationDocs } = await loadDoctorCredentialDocs(userId, specializationIds, educationIds);
    const specializationDocIds = new Set(specializationDocs.map((item) => Number(item.specialization_id)));
    const educationDocIds = new Set(educationDocs.map((item) => Number(item.education_id)));
    const missingSpecializationDocs = specializationIds.filter((id) => !specializationDocIds.has(Number(id)));
    const missingEducationDocs = educationIds.filter((id) => !educationDocIds.has(Number(id)));

    if (missingSpecializationDocs.length) {
      return res.status(400).json({ error: 'Upload specialization certificates for all selected specializations first' });
    }
    if (missingEducationDocs.length) {
      return res.status(400).json({ error: 'Upload education certificates for all selected education entries first' });
    }

    await notifyAdmins(`Doctor verification requested: ${user.name}`, userId);
    res.json({ message: 'Verification request sent to admin' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
