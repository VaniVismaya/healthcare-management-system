const { pool } = require('../config/database');
const { sendNotification, sendNotificationWithEmit } = require('../utils/notification');
const { parseIdList } = require('../utils/doctorProfileData');
const { assignPlanToUser, formatPlanRow, sanitizePlanPayload } = require('../utils/subscription');
let consultationFeesTableReady = false;

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
  consultationFeesTableReady = true;
};

const ensureSettingsTable = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(64) PRIMARY KEY,
      setting_value VARCHAR(255),
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );
};

const ensureAnnouncementsTableSupport = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS system_announcements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      target_role ENUM('all','doctor','patient','laboratory','pharmacist','receptionist') DEFAULT 'all',
      target_platform ENUM('all','web','mobile') DEFAULT 'all',
      is_active BOOLEAN DEFAULT TRUE,
      created_by INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )`
  );

  const [platformColumn] = await pool.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'system_announcements'
       AND COLUMN_NAME = 'target_platform'`
  );
  if (!platformColumn.length) {
    await pool.query(
      `ALTER TABLE system_announcements
       ADD COLUMN target_platform ENUM('all','web','mobile') DEFAULT 'all' AFTER target_role`
    );
  }
};

const notifyAdmins = async (io, type) => {
  try {
    const [admins] = await pool.query(
      `SELECT u.id FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE r.name = 'admin' AND u.is_active = 1`
    );
    admins.forEach((a) => {
      io?.to(`user_${a.id}`).emit('admin_counts_refresh', { type });
    });
  } catch {
    // ignore admin notify failures
  }
};

const logAudit = async (req, action, resourceType, resourceId, oldValues, newValues) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user?.id || null,
        action,
        resourceType,
        resourceId || null,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        req.ip || null,
        req.headers['user-agent'] || null
      ]
    );
  } catch {
    // ignore audit failures
  }
};

// Dashboard stats
exports.getDashboard = async (req, res) => {
  try {
    const [[totalUsers]] = await pool.query(
      `SELECT COUNT(*) as count FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE r.name != 'admin' OR r.name IS NULL`
    );
    const [[pendingVerifications]] = await pool.query(
      `SELECT COUNT(*) as count FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.is_verified = 0 AND (r.name NOT IN ('admin','patient') OR r.name IS NULL)`
    );
    const [[totalAppointments]] = await pool.query('SELECT COUNT(*) as count FROM appointments');
    const [[todayAppointments]] = await pool.query('SELECT COUNT(*) as count FROM appointments WHERE appointment_date = CURDATE()');
    const [[totalClinics]] = await pool.query('SELECT COUNT(*) as count FROM clinics');
    const [[pendingClinics]] = await pool.query('SELECT COUNT(*) as count FROM clinics WHERE is_verified = 0');
    const [[totalLabs]] = await pool.query(
      `SELECT COUNT(*) as count FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE r.name = 'laboratory'`
    );
    const [[totalPharmacists]] = await pool.query(
      `SELECT COUNT(*) as count FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE r.name = 'pharmacist'`
    );
    const [[totalDoctors]] = await pool.query(
      `SELECT COUNT(*) as count FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE r.name = 'doctor'`
    );
    const [[totalPatients]] = await pool.query(
      `SELECT COUNT(*) as count FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE r.name = 'patient'`
    );
    const [roleBreakdown] = await pool.query(
      `SELECT COALESCE(r.name, 'unknown') as role, COUNT(*) as count
       FROM users u LEFT JOIN roles r ON u.role_id = r.id
       WHERE r.name != 'admin' OR r.name IS NULL
       GROUP BY COALESCE(r.name, 'unknown')`
    );

    res.json({
      total_users: totalUsers.count,
      pending_verifications: pendingVerifications.count,
      total_appointments: totalAppointments.count,
      today_appointments: todayAppointments.count,
      total_clinics: totalClinics.count,
      pending_clinics: pendingClinics.count,
      total_labs: totalLabs.count,
      total_pharmacists: totalPharmacists.count,
      total_doctors: totalDoctors.count,
      total_patients: totalPatients.count,
      role_breakdown: roleBreakdown
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Get all users with filters
exports.getUsers = async (req, res) => {
  const { role, is_verified, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let where = "WHERE 1=1";
    const params = [];
    if (role) { where += ' AND r.name = ?'; params.push(role); }
    if (is_verified !== undefined && is_verified !== '') { where += ' AND u.is_verified = ?'; params.push(is_verified); }
    if (search) { where += ' AND (u.name LIKE ? OR u.phone LIKE ? OR u.email LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM users u LEFT JOIN roles r ON u.role_id = r.id ${where}`,
      params
    );
    const [users] = await pool.query(
      `SELECT u.id, u.uuid, u.name, u.email, u.phone, COALESCE(r.name, 'unknown') as role,
              u.is_verified, u.is_active, u.subscription_plan, u.current_plan_id, u.subscription_expires_at, u.created_at, u.profile_image,
              sp.name as current_plan_name, sp.code as current_plan_code, sp.price as current_plan_price,
              COALESCE(dp.specialization, lp.lab_name, pp.pharmacy_name) as profile_info,
              COALESCE(dp.medical_license_number, lp.registration_number, pp.license_number) as license_number,
              COALESCE(dp.license_certificate_path, lp.certificate_path, pp.license_certificate_path) as certificate_path,
              dp.experience_years, dp.consultation_fee,
              (SELECT COUNT(*) FROM appointments a WHERE a.patient_id = u.id) as patient_appointments,
              (SELECT COUNT(*) FROM appointments a WHERE a.doctor_id = u.id) as doctor_appointments,
              (SELECT d.name
               FROM appointments a JOIN users d ON a.doctor_id = d.id
               WHERE a.patient_id = u.id
               ORDER BY a.created_at DESC LIMIT 1) as last_doctor_name,
              (SELECT c.name
               FROM appointments a JOIN clinics c ON a.clinic_id = c.id
               WHERE a.patient_id = u.id
               ORDER BY a.created_at DESC LIMIT 1) as last_clinic_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
       LEFT JOIN laboratory_profiles lp ON u.id = lp.user_id
       LEFT JOIN pharmacist_profiles pp ON u.id = pp.user_id
       LEFT JOIN subscription_plans sp ON sp.id = u.current_plan_id
       ${where}
       ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({ users, total, page: parseInt(page), total_pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Get single user details (with booking history for patients)
exports.getUserDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.uuid, u.name, u.email, u.phone, COALESCE(r.name, 'unknown') as role,
              u.is_verified, u.is_active, u.subscription_plan, u.current_plan_id, u.subscription_expires_at, u.created_at,
              u.profile_image,
              sp.name as current_plan_name, sp.code as current_plan_code, sp.price as current_plan_price,
              sp.duration_days as current_plan_duration_days, sp.features as current_plan_features,
              sp.modules as current_plan_modules, sp.limits as current_plan_limits,
              COALESCE(dp.specialization, lp.lab_name, pp.pharmacy_name) as profile_info,
              COALESCE(dp.medical_license_number, lp.registration_number, pp.license_number) as license_number,
              COALESCE(dp.license_certificate_path, lp.certificate_path, pp.license_certificate_path) as certificate_path,
              dp.specialization as doctor_specialization, dp.qualification, dp.bio, dp.languages,
              dp.experience_years, dp.consultation_fee, dp.admin_remarks as doctor_admin_remarks,
              dp.primary_specialization_id, dp.additional_specialization_ids, dp.education_ids,
              lp.lab_name, lp.registration_number as lab_registration_number, lp.certificate_path as lab_certificate_path,
              lp.address as lab_address, lp.city as lab_city, lp.state as lab_state, lp.pincode as lab_pincode,
              lp.phone as lab_phone, lp.email as lab_email, lp.logo as lab_logo,
              lp.working_hours_start, lp.working_hours_end, lp.working_days, lp.admin_remarks as lab_admin_remarks,
              pp.pharmacy_name, pp.license_number as pharmacy_license_number, pp.license_certificate_path as pharmacy_certificate_path,
              pp.address as pharmacy_address, pp.city as pharmacy_city, pp.state as pharmacy_state, pp.pincode as pharmacy_pincode,
              pp.phone as pharmacy_phone, pp.gstin, pp.admin_remarks as pharmacy_admin_remarks,
              pat.date_of_birth, pat.gender, pat.blood_group, pat.address as patient_address,
              pat.city as patient_city, pat.state as patient_state, pat.pincode as patient_pincode,
              pat.emergency_contact_name, pat.emergency_contact_phone, pat.allergies, pat.chronic_conditions,
              pat.insurance_provider, pat.insurance_number
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
       LEFT JOIN laboratory_profiles lp ON u.id = lp.user_id
       LEFT JOIN pharmacist_profiles pp ON u.id = pp.user_id
       LEFT JOIN patient_profiles pat ON u.id = pat.user_id
       LEFT JOIN subscription_plans sp ON sp.id = u.current_plan_id
       WHERE u.id = ? LIMIT 1`,
      [id]
    );
    if (!users.length) return res.status(404).json({ error: 'User not found' });
    const user = users[0];
    user.current_plan = user.current_plan_id
      ? formatPlanRow({
          id: user.current_plan_id,
          name: user.current_plan_name,
          code: user.current_plan_code,
          price: user.current_plan_price,
          duration_days: user.current_plan_duration_days,
          features: user.current_plan_features,
          modules: user.current_plan_modules,
          limits: user.current_plan_limits,
        })
      : null;

    let doctorDepartments = [];
    let clinics = [];
    let labDepartments = [];
    let labPhotos = [];
    let pharmacyPhotos = [];

    if (user.role === 'doctor') {
      await ensureConsultationFeesTable();
      const [deptRows] = await pool.query(
        `SELECT md.name
         FROM doctor_departments dd
         JOIN medical_departments md ON dd.department_id = md.id
         WHERE dd.doctor_id = ?
         ORDER BY md.name`,
        [id]
      );
      doctorDepartments = deptRows.map((d) => d.name);

      const additionalSpecializationIds = parseIdList(user.additional_specialization_ids);
      const educationIds = parseIdList(user.education_ids);
      const specializationIds = [...new Set([user.primary_specialization_id, ...additionalSpecializationIds].filter(Boolean))];
      const [specializationRows] = specializationIds.length
        ? await pool.query('SELECT id, name FROM medical_specializations WHERE id IN (?) ORDER BY name', [specializationIds])
        : [[]];
      const [educationRows] = educationIds.length
        ? await pool.query('SELECT id, name FROM medical_educations WHERE id IN (?) ORDER BY name', [educationIds])
        : [[]];
      const specializationMap = new Map((specializationRows || []).map((row) => [row.id, row.name]));
      const educationMap = new Map((educationRows || []).map((row) => [row.id, row.name]));

      user.primary_specialization = user.primary_specialization_id
        ? (specializationMap.get(Number(user.primary_specialization_id)) || user.doctor_specialization)
        : user.doctor_specialization;
      user.additional_specializations = additionalSpecializationIds
        .map((specializationId) => specializationMap.get(specializationId))
        .filter(Boolean);
      user.educations = educationIds
        .map((educationId) => educationMap.get(educationId))
        .filter(Boolean);

      const [specializationDocRows] = specializationIds.length
        ? await pool.query(
          `SELECT dsc.specialization_id, dsc.certificate_path, ms.name
           FROM doctor_specialization_certificates dsc
           JOIN medical_specializations ms ON dsc.specialization_id = ms.id
           WHERE dsc.user_id = ? AND dsc.specialization_id IN (?)
           ORDER BY ms.name`,
          [id, specializationIds]
        )
        : [[]];
      const [educationDocRows] = educationIds.length
        ? await pool.query(
          `SELECT de.education_id, de.certificate_path, me.name
           FROM doctor_education_certificates de
           JOIN medical_educations me ON de.education_id = me.id
           WHERE de.user_id = ? AND de.education_id IN (?)
           ORDER BY me.name`,
          [id, educationIds]
        )
        : [[]];
      user.specialization_certificates = (specializationDocRows || []).map((row) => ({
        specialization_id: row.specialization_id,
        name: row.name,
        certificate_path: row.certificate_path,
        is_primary: Number(row.specialization_id) === Number(user.primary_specialization_id),
      }));
      user.education_certificates = (educationDocRows || []).map((row) => ({
        education_id: row.education_id,
        name: row.name,
        certificate_path: row.certificate_path,
      }));

      const [clinicRows] = await pool.query(
        `SELECT * FROM clinics WHERE owner_doctor_id = ? ORDER BY created_at DESC`,
        [id]
      );
      clinics = clinicRows;

      if (clinics.length) {
        const clinicIds = clinics.map((c) => c.id);
        const placeholders = clinicIds.map(() => '?').join(',');
        const [photoRows] = await pool.query(
          `SELECT clinic_id, photo_path FROM clinic_photos WHERE clinic_id IN (${placeholders})`,
          clinicIds
        );
        const photoMap = {};
        photoRows.forEach((p) => {
          if (!photoMap[p.clinic_id]) photoMap[p.clinic_id] = [];
          photoMap[p.clinic_id].push(p.photo_path);
        });
        clinics = clinics.map((c) => ({ ...c, photos: photoMap[c.id] || [] }));
      }

      const [consultationFeeRows] = await pool.query(
        `SELECT dcf.id, dcf.clinic_id, c.name as clinic_name,
                dcf.department_id,
                CASE WHEN dcf.department_id = 0 THEN 'All Departments' ELSE md.name END as department_name,
                dcf.consultation_type, dcf.priority_level, dcf.new_patient_fee, dcf.follow_up_fee, dcf.currency
         FROM doctor_consultation_fees dcf
         JOIN clinics c ON c.id = dcf.clinic_id
         LEFT JOIN medical_departments md ON md.id = dcf.department_id AND dcf.department_id > 0
         WHERE dcf.doctor_id = ? AND c.owner_doctor_id = ? AND dcf.is_active = 1
         ORDER BY c.name, dcf.department_id, dcf.consultation_type, dcf.priority_level`,
        [id, id]
      );
      user.consultation_fee_rules = consultationFeeRows;
    }

    if (user.role === 'laboratory') {
      const [deptRows] = await pool.query(
        `SELECT name FROM lab_departments WHERE lab_id = ? AND is_active = 1 ORDER BY name`,
        [id]
      );
      labDepartments = deptRows.map((d) => d.name);
      const [photoRows] = await pool.query(
        `SELECT photo_path FROM lab_photos WHERE lab_id = ? ORDER BY created_at DESC`,
        [id]
      );
      labPhotos = photoRows.map((p) => p.photo_path);
    }

    if (user.role === 'pharmacist') {
      const [photoRows] = await pool.query(
        `SELECT photo_path FROM pharmacy_photos WHERE pharmacist_id = ? ORDER BY created_at DESC`,
        [id]
      );
      pharmacyPhotos = photoRows.map((p) => p.photo_path);
    }

    let appointments = [];
    if (user.role === 'patient') {
      const [rows] = await pool.query(
        `SELECT a.id, a.appointment_date, a.appointment_time, a.status,
                d.name as doctor_name, c.name as clinic_name
         FROM appointments a
         JOIN users d ON a.doctor_id = d.id
         JOIN clinics c ON a.clinic_id = c.id
         WHERE a.patient_id = ?
         ORDER BY a.created_at DESC
         LIMIT 10`,
        [id]
      );
      appointments = rows;
    }

    res.json({
      user,
      appointments,
      doctor_departments: doctorDepartments,
      clinics,
      lab_departments: labDepartments,
      lab_photos: labPhotos,
      pharmacy_photos: pharmacyPhotos
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get single clinic details (with photos and owner info)
exports.getClinicDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT c.*, u.name as owner_name, u.email as owner_email, u.phone as owner_phone, u.profile_image as owner_profile_image,
              dp.specialization as owner_specialization, dp.qualification as owner_qualification,
              dp.medical_license_number as owner_license_number, dp.license_certificate_path as owner_certificate_path
       FROM clinics c
       JOIN users u ON c.owner_doctor_id = u.id
       LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
       WHERE c.id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Clinic not found' });
    const clinic = rows[0];
    const [photos] = await pool.query(
      `SELECT photo_path FROM clinic_photos WHERE clinic_id = ? ORDER BY created_at DESC`,
      [id]
    );
    res.json({ clinic, photos: photos.map((p) => p.photo_path) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Booking fee (admin setting)
exports.getBookingFee = async (req, res) => {
  try {
    await ensureSettingsTable();
    const [rows] = await pool.query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'booking_fee' LIMIT 1"
    );
    const fee = rows.length ? Number(rows[0].setting_value) : 0;
    res.json({ booking_fee: Number.isFinite(fee) ? fee : 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.setBookingFee = async (req, res) => {
  const fee = Number(req.body.booking_fee || 0);
  try {
    await ensureSettingsTable();
    const [beforeRows] = await pool.query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'booking_fee' LIMIT 1"
    );
    const nextFee = Number.isFinite(fee) ? fee : 0;
    await pool.query(
      `INSERT INTO system_settings (setting_key, setting_value)
       VALUES ('booking_fee', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [nextFee]
    );
    await logAudit(req, 'update_booking_fee', 'system_setting', null, {
      booking_fee: beforeRows.length ? Number(beforeRows[0].setting_value) : 0,
    }, {
      booking_fee: nextFee,
    });
    res.json({ booking_fee: nextFee });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get audit logs
exports.getAuditLogs = async (req, res) => {
  const { action, resource_type, user_id, date_from, date_to, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  try {
    let where = 'WHERE 1=1';
    const params = [];
    if (action) { where += ' AND al.action = ?'; params.push(action); }
    if (resource_type) { where += ' AND al.resource_type = ?'; params.push(resource_type); }
    if (user_id) { where += ' AND al.user_id = ?'; params.push(user_id); }
    if (date_from) { where += ' AND al.created_at >= ?'; params.push(date_from); }
    if (date_to) { where += ' AND al.created_at <= ?'; params.push(date_to); }

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM audit_logs al ${where}`, params);
    const [logs] = await pool.query(
      `SELECT al.*, u.name as user_name, r.name as user_role
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({ logs, total, page: parseInt(page), total_pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Advanced reports
exports.getReports = async (req, res) => {
  const { date_from, date_to } = req.query;
  const from = date_from || new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = date_to || new Date().toISOString().slice(0, 10);

  try {
    const [registrationsDaily] = await pool.query(
      `SELECT DATE(u.created_at) as date, COUNT(*) as count
       FROM users u LEFT JOIN roles r ON u.role_id = r.id
       WHERE (r.name != 'admin' OR r.name IS NULL) AND DATE(u.created_at) BETWEEN ? AND ?
       GROUP BY DATE(u.created_at)
       ORDER BY DATE(u.created_at)`,
      [from, to]
    );
    const [registrationsByRole] = await pool.query(
      `SELECT COALESCE(r.name, 'unknown') as role, COUNT(*) as count
       FROM users u LEFT JOIN roles r ON u.role_id = r.id
       WHERE (r.name != 'admin' OR r.name IS NULL) AND DATE(u.created_at) BETWEEN ? AND ?
       GROUP BY COALESCE(r.name, 'unknown')`,
      [from, to]
    );
    const [appointmentsDaily] = await pool.query(
      `SELECT appointment_date as date, COUNT(*) as count
       FROM appointments
       WHERE appointment_date BETWEEN ? AND ?
       GROUP BY appointment_date
       ORDER BY appointment_date`,
      [from, to]
    );
    const [appointmentsByStatus] = await pool.query(
      `SELECT status, COUNT(*) as count
       FROM appointments
       WHERE appointment_date BETWEEN ? AND ?
       GROUP BY status
       ORDER BY count DESC`,
      [from, to]
    );
    const [labOrdersDaily] = await pool.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM lab_orders
       WHERE DATE(created_at) BETWEEN ? AND ?
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at)`,
      [from, to]
    );
    const [prescriptionsDaily] = await pool.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM prescriptions
       WHERE DATE(created_at) BETWEEN ? AND ?
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at)`,
      [from, to]
    );
    const [verificationByRole] = await pool.query(
      `SELECT COALESCE(r.name, 'unknown') as role,
              SUM(CASE WHEN u.is_verified = 1 THEN 1 ELSE 0 END) as verified_count,
              SUM(CASE WHEN u.is_verified = 0 THEN 1 ELSE 0 END) as pending_count
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE COALESCE(r.name, 'unknown') IN ('doctor','laboratory','pharmacist','patient','receptionist')
       GROUP BY COALESCE(r.name, 'unknown')
       ORDER BY role`,
      []
    );
    const [topClinics] = await pool.query(
      `SELECT c.id, c.name, COUNT(a.id) as appointments
       FROM clinics c
       LEFT JOIN appointments a ON a.clinic_id = c.id AND a.appointment_date BETWEEN ? AND ?
       GROUP BY c.id
       ORDER BY appointments DESC
       LIMIT 5`,
      [from, to]
    );
    const [topDoctors] = await pool.query(
      `SELECT u.id, u.name, COUNT(a.id) as appointments
       FROM users u
       JOIN roles r ON r.id = u.role_id AND r.name = 'doctor'
       LEFT JOIN appointments a ON a.doctor_id = u.id AND a.appointment_date BETWEEN ? AND ?
       GROUP BY u.id, u.name
       ORDER BY appointments DESC, u.name ASC
       LIMIT 5`,
      [from, to]
    );
    const [plansByRole] = await pool.query(
      `SELECT COALESCE(r.name, 'unknown') as role, COALESCE(sp.name, 'No Plan') as plan_name, COUNT(*) as count
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN subscription_plans sp ON sp.id = u.current_plan_id
       WHERE COALESCE(r.name, 'unknown') != 'admin'
       GROUP BY COALESCE(r.name, 'unknown'), COALESCE(sp.name, 'No Plan')
       ORDER BY role, count DESC`,
      []
    );
    const [planRequests] = await pool.query(
      `SELECT status, COUNT(*) as count
       FROM subscription_plan_requests
       GROUP BY status
       ORDER BY count DESC`,
      []
    );
    const [[summary]] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE (r.name != 'admin' OR r.name IS NULL) AND DATE(u.created_at) BETWEEN ? AND ?) as registrations_count,
         (SELECT COUNT(*) FROM appointments WHERE appointment_date BETWEEN ? AND ?) as appointments_count,
         (SELECT COUNT(*) FROM lab_orders WHERE DATE(created_at) BETWEEN ? AND ?) as lab_orders_count,
         (SELECT COUNT(*) FROM prescriptions WHERE DATE(created_at) BETWEEN ? AND ?) as prescriptions_count,
         (SELECT COUNT(*) FROM system_announcements WHERE is_active = 1) as active_announcements,
         (SELECT COUNT(*) FROM subscription_plan_requests WHERE status = 'pending') as pending_plan_requests`,
      [from, to, from, to, from, to, from, to]
    );

    res.json({
      date_from: from,
      date_to: to,
      summary,
      registrations_daily: registrationsDaily,
      registrations_by_role: registrationsByRole,
      appointments_daily: appointmentsDaily,
      appointments_by_status: appointmentsByStatus,
      lab_orders_daily: labOrdersDaily,
      prescriptions_daily: prescriptionsDaily,
      verification_by_role: verificationByRole,
      top_clinics: topClinics,
      top_doctors: topDoctors,
      plans_by_role: plansByRole,
      plan_requests_by_status: planRequests
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Verify user (doctor, lab, pharmacist)
exports.verifyUser = async (req, res) => {
  const { id } = req.params;
  const { is_verified, remarks } = req.body;

  try {
    const [before] = await pool.query(
      `SELECT u.id, COALESCE(r.name, 'unknown') as role, u.is_verified
       FROM users u LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [id]
    );
    await pool.query('UPDATE users SET is_verified = ? WHERE id = ?', [is_verified, id]);

    // Update role-specific profile
    const [user] = await pool.query(
      `SELECT COALESCE(r.name, 'unknown') as role FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
      [id]
    );
    if (user.length) {
      const role = user[0].role;
      if (role === 'doctor') {
        await pool.query('UPDATE doctor_profiles SET is_verified = ?, admin_remarks = ? WHERE user_id = ?', [is_verified, remarks || null, id]);
      } else if (role === 'laboratory') {
        await pool.query('UPDATE laboratory_profiles SET is_verified = ?, admin_remarks = ?, verified_at = NOW() WHERE user_id = ?', [is_verified, remarks || null, id]);
      } else if (role === 'pharmacist') {
        await pool.query('UPDATE pharmacist_profiles SET is_verified = ?, admin_remarks = ?, verified_at = NOW() WHERE user_id = ?', [is_verified, remarks || null, id]);
      }

      const msg = is_verified
        ? 'Your account has been verified. You can now use the application.'
        : `Your account verification was not approved. Reason: ${remarks || 'Please contact admin.'}`;
      await sendNotification(id, is_verified ? 'Account Verified' : 'Verification Failed', msg, 'verification');
    }

    res.json({ message: `User ${is_verified ? 'verified' : 'rejected'} successfully` });
    const io = req.app.get('io');
    await logAudit(req, 'verify_user', 'user', id, { is_verified: before[0]?.is_verified }, { is_verified });
    await notifyAdmins(io, 'verify_user');
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Verify clinic
exports.verifyClinic = async (req, res) => {
  const { id } = req.params;
  const { is_verified, admin_remarks } = req.body;

  try {
    const [before] = await pool.query('SELECT id, is_verified FROM clinics WHERE id = ?', [id]);
    await pool.query('UPDATE clinics SET is_verified = ?, admin_remarks = ?, verified_at = NOW() WHERE id = ?', [is_verified, admin_remarks, id]);
    const [clinic] = await pool.query('SELECT owner_doctor_id, name FROM clinics WHERE id = ?', [id]);
    if (clinic.length) {
      await sendNotification(clinic[0].owner_doctor_id, `Clinic ${is_verified ? 'Verified' : 'Rejected'}`,
        `Your clinic "${clinic[0].name}" has been ${is_verified ? 'verified' : `rejected. Reason: ${admin_remarks}`}.`, 'verification');
    }
    res.json({ message: 'Clinic verification updated' });
    const io = req.app.get('io');
    await logAudit(req, 'verify_clinic', 'clinic', id, { is_verified: before[0]?.is_verified }, { is_verified });
    await notifyAdmins(io, 'verify_clinic');
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Toggle user active status
exports.toggleUserStatus = async (req, res) => {
  const { id } = req.params;
  try {
    const [before] = await pool.query('SELECT id, is_active FROM users WHERE id = ?', [id]);
    await pool.query('UPDATE users SET is_active = NOT is_active WHERE id = ?', [id]);
    res.json({ message: 'User status toggled' });
    const nextActive = before[0] ? !before[0].is_active : null;
    await logAudit(
      req,
      nextActive ? 'enable_user' : 'disable_user',
      'user',
      id,
      { is_active: before[0]?.is_active },
      { is_active: nextActive }
    );
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Get pending verifications
exports.getPendingVerifications = async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, COALESCE(r.name, 'unknown') as role, u.created_at,
              COALESCE(dp.specialization, lp.lab_name, pp.pharmacy_name) as profile_info,
              COALESCE(dp.medical_license_number, lp.registration_number, pp.license_number) as license_number,
              COALESCE(dp.license_certificate_path, lp.certificate_path, pp.license_certificate_path) as certificate_path
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
       LEFT JOIN laboratory_profiles lp ON u.id = lp.user_id
       LEFT JOIN pharmacist_profiles pp ON u.id = pp.user_id
       WHERE u.is_verified = 0 AND r.name IN ('doctor','laboratory','pharmacist')
       ORDER BY u.created_at DESC`
    );
    const [clinics] = await pool.query(
      `SELECT c.*, u.name as owner_name, u.phone as owner_phone
       FROM clinics c JOIN users u ON c.owner_doctor_id = u.id
       WHERE c.is_verified = 0 ORDER BY c.created_at DESC`
    );
    res.json({ users, clinics });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Get all clinics
exports.getClinics = async (req, res) => {
  const { search, is_verified } = req.query;
  try {
    let where = 'WHERE 1=1';
    const params = [];
    if (search) {
      where += ' AND (c.name LIKE ? OR c.city LIKE ? OR u.name LIKE ? OR u.phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (is_verified !== undefined && is_verified !== '') {
      where += ' AND c.is_verified = ?';
      params.push(is_verified);
    }

    const [clinics] = await pool.query(
      `SELECT c.*, u.name as owner_name, u.phone as owner_phone
       FROM clinics c
       JOIN users u ON c.owner_doctor_id = u.id
       ${where}
       ORDER BY c.created_at DESC`,
      params
    );
    res.json({ clinics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get contact messages
exports.getContactMessages = async (req, res) => {
  const { status } = req.query;
  try {
    let query = 'SELECT * FROM contact_messages';
    const params = [];
    if (status) { query += ' WHERE status = ?'; params.push(status); }
    query += ' ORDER BY created_at DESC';
    const [messages] = await pool.query(query, params);
    res.json({ messages });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Reply to contact message
exports.replyContact = async (req, res) => {
  const { id } = req.params;
  const { reply } = req.body;
  try {
    const [before] = await pool.query('SELECT id, status, admin_reply FROM contact_messages WHERE id = ?', [id]);
    await pool.query('UPDATE contact_messages SET admin_reply = ?, status = ? WHERE id = ?',
      [reply, 'resolved', id]);
    res.json({ message: 'Reply sent' });
    await logAudit(req, 'reply_contact', 'contact_message', id, { status: before[0]?.status, admin_reply: before[0]?.admin_reply }, { status: 'resolved', admin_reply: reply });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Get subscription plans
exports.getPlans = async (req, res) => {
  try {
    const [plans] = await pool.query(
      `SELECT sp.*,
              u.name as target_user_name,
              u.email as target_user_email,
              u.phone as target_user_phone
       FROM subscription_plans sp
       LEFT JOIN users u ON u.id = sp.target_user_id
       ORDER BY sp.role ASC, sp.is_default DESC, sp.display_order ASC, sp.price ASC, sp.id DESC`
    );
    res.json({ plans: plans.map(formatPlanRow) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Add/Update subscription plan
exports.upsertPlan = async (req, res) => {
  const { id } = req.params;
  try {
    const payload = sanitizePlanPayload(req.body);
    if (!payload.name || !payload.role) {
      return res.status(400).json({ error: 'Plan name and role are required' });
    }
    if (payload.plan_type === 'custom' && !payload.target_user_id) {
      return res.status(400).json({ error: 'Custom plans must target a specific user' });
    }
    if (!payload.code) {
      payload.code = `${payload.role}_${payload.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    }

    if (payload.is_default) {
      await pool.query(
        `UPDATE subscription_plans
         SET is_default = 0
         WHERE role = ? AND id != COALESCE(?, 0)`,
        [payload.role, id || null]
      );
    }

    if (id) {
      const [before] = await pool.query('SELECT * FROM subscription_plans WHERE id = ?', [id]);
      await pool.query(
        `UPDATE subscription_plans
         SET name=?, code=?, description=?, role=?, plan_type=?, target_user_id=?, is_default=?, display_order=?,
             price=?, duration_days=?, max_appointments=?, features=?, modules=?, limits=?, is_active=?
         WHERE id=?`,
        [
          payload.name,
          payload.code,
          payload.description,
          payload.role,
          payload.plan_type,
          payload.target_user_id,
          payload.is_default,
          payload.display_order,
          payload.price,
          payload.duration_days,
          payload.max_appointments,
          JSON.stringify(payload.features),
          JSON.stringify(payload.modules),
          JSON.stringify(payload.limits),
          payload.is_active,
          id,
        ]
      );
      await logAudit(req, 'update_plan', 'subscription_plan', id, before[0] || null, payload);
      res.json({ message: 'Plan saved', plan_id: Number(id) });
    } else {
      const [result] = await pool.query(
        `INSERT INTO subscription_plans (
           name, code, description, role, plan_type, target_user_id, is_default, display_order,
           price, duration_days, max_appointments, features, modules, limits, is_active
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.name,
          payload.code,
          payload.description,
          payload.role,
          payload.plan_type,
          payload.target_user_id,
          payload.is_default,
          payload.display_order,
          payload.price,
          payload.duration_days,
          payload.max_appointments,
          JSON.stringify(payload.features),
          JSON.stringify(payload.modules),
          JSON.stringify(payload.limits),
          payload.is_active,
        ]
      );
      await logAudit(req, 'create_plan', 'subscription_plan', result.insertId, null, payload);
      res.json({ message: 'Plan saved', plan_id: result.insertId });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.assignPlan = async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'User is required' });
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.name, r.name as role
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? LIMIT 1`,
      [user_id]
    );
    if (!users.length) return res.status(404).json({ error: 'User not found' });

    const [plans] = await pool.query('SELECT * FROM subscription_plans WHERE id = ? LIMIT 1', [id]);
    if (!plans.length) return res.status(404).json({ error: 'Plan not found' });
    const plan = formatPlanRow(plans[0]);

    if (plan.role !== 'all' && plan.role !== users[0].role) {
      return res.status(400).json({ error: 'Plan role does not match selected user' });
    }
    if (plan.plan_type === 'custom' && plan.target_user_id && Number(plan.target_user_id) !== Number(user_id)) {
      return res.status(400).json({ error: 'This custom plan belongs to another user' });
    }

    await assignPlanToUser(pool, user_id, id);
    await logAudit(req, 'assign_plan', 'subscription_plan', id, null, { user_id, plan_name: plan.name });
    res.json({ message: 'Plan assigned successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPlanRequests = async (req, res) => {
  try {
    const [requests] = await pool.query(
      `SELECT spr.*,
              u.name as requester_name,
              u.email as requester_email,
              u.phone as requester_phone,
              u.current_plan_id,
              u.subscription_plan as current_plan_name,
              rp.name as requester_role_name,
              admin.name as handled_by_name
       FROM subscription_plan_requests spr
       JOIN users u ON u.id = spr.user_id
       LEFT JOIN roles rp ON rp.id = u.role_id
       LEFT JOIN users admin ON admin.id = spr.handled_by
       ORDER BY FIELD(spr.status, 'pending', 'accepted', 'contacted', 'rejected'), spr.created_at DESC`
    );
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updatePlanRequest = async (req, res) => {
  const { id } = req.params;
  const { status, admin_notes } = req.body;
  if (!['pending', 'accepted', 'contacted', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const [before] = await pool.query('SELECT * FROM subscription_plan_requests WHERE id = ?', [id]);
    if (!before.length) return res.status(404).json({ error: 'Request not found' });

    await pool.query(
      `UPDATE subscription_plan_requests
       SET status = ?, admin_notes = ?, handled_by = ?, handled_at = NOW()
       WHERE id = ?`,
      [status, admin_notes || null, req.user.id, id]
    );

    await logAudit(req, 'update_plan_request', 'subscription_plan_request', id, before[0], { status, admin_notes });
    res.json({ message: 'Request updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get announcements (admin)
exports.getAnnouncements = async (req, res) => {
  try {
    await ensureAnnouncementsTableSupport();
    const [announcements] = await pool.query(
      `SELECT a.*, u.name as created_by_name
       FROM system_announcements a
       LEFT JOIN users u ON a.created_by = u.id
       ORDER BY a.created_at DESC`
    );
    res.json({ announcements });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Get active announcements (all users)
exports.getActiveAnnouncements = async (req, res) => {
  const role = req.user?.role || 'patient';
  const platform = String(req.query.platform || req.headers['x-client-platform'] || 'web').toLowerCase() === 'mobile' ? 'mobile' : 'web';
  try {
    await ensureAnnouncementsTableSupport();
    const [announcements] = await pool.query(
      `SELECT id, title, message, target_role, target_platform, created_at
       FROM system_announcements
       WHERE is_active = 1
         AND (target_role = 'all' OR target_role = ?)
         AND (target_platform = 'all' OR target_platform = ?)
       ORDER BY created_at DESC LIMIT 50`,
      [role, platform]
    );
    res.json({ announcements });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Create announcement (admin)
exports.createAnnouncement = async (req, res) => {
  const { title, message, target_role, target_platform, is_active } = req.body;
  if (!title || !message) return res.status(400).json({ error: 'Title and message are required' });

  const roleTarget = target_role || 'all';
  const platformTarget = ['all', 'web', 'mobile'].includes(target_platform) ? target_platform : 'all';
  const activeFlag = is_active !== false;

  try {
    await ensureAnnouncementsTableSupport();
    const [result] = await pool.query(
      'INSERT INTO system_announcements (title, message, target_role, target_platform, is_active, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [title, message, roleTarget, platformTarget, activeFlag, req.user.id]
    );
    const announcementId = result.insertId;

    if (activeFlag) {
      let query = 'SELECT id FROM users WHERE is_active = 1';
      const params = [];
      if (roleTarget !== 'all') {
        query += ' AND id IN (SELECT u.id FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE r.name = ?)';
        params.push(roleTarget);
      }
      const [users] = await pool.query(query, params);
      const io = req.app.get('io');

      for (const u of users) {
        await sendNotificationWithEmit(
          io,
          u.id,
          `Announcement: ${title}`,
          `${message}${platformTarget !== 'all' ? ` (${platformTarget.toUpperCase()} only)` : ''}`,
          'system',
          announcementId,
          'announcement'
        );
      }
    }

    await logAudit(req, 'create_announcement', 'announcement', announcementId, null, { title, message, target_role: roleTarget, target_platform: platformTarget, is_active: activeFlag });
    res.status(201).json({ message: 'Announcement created', announcement_id: announcementId });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
