const { pool } = require('../config/database');
const { sendNotification } = require('../utils/notification');
const { enforcePlanRule, SubscriptionLimitError } = require('../utils/subscriptionLimits');

const normalizePath = (p) => (p ? p.replace(/\\/g, '/') : p);

const notifyAdminsVerification = async (message, referenceId) => {
  const [admins] = await pool.query(
    `SELECT u.id FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE r.name = 'admin' AND u.is_active = 1`
  );
  for (const admin of admins) {
    await sendNotification(admin.id, 'Verification Requested', message, 'verification', referenceId, 'clinic');
  }
};

const notifyAdmins = async (io, type) => {
  try {
    const [admins] = await pool.query(
      `SELECT u.id FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE r.name = 'admin' AND u.is_active = 1`
    );
    admins.forEach((a) => {
      io?.to(`user_${a.id}`).emit('admin_counts_refresh', { type });
    });
  } catch {
    // ignore admin notify failures
  }
};

// Create clinic
exports.createClinic = async (req, res) => {
  const { name, registration_number, address, city, state, pincode, latitude, longitude, phone, email, description } = req.body;
  const doctorId = req.user.id;

  try {
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });
    if (!registration_number) return res.status(400).json({ error: 'Registration number is required' });
    const certPath = normalizePath(req.files?.certificate?.[0]?.path) || null;
    if (!certPath) return res.status(400).json({ error: 'Clinic certificate is required' });
    const logoPath = normalizePath(req.files?.logo?.[0]?.path) || null;

    const [[{ totalClinics }]] = await pool.query(
      'SELECT COUNT(*) as totalClinics FROM clinics WHERE owner_doctor_id = ?',
      [doctorId]
    );
    await enforcePlanRule(pool, doctorId, {
      moduleKey: 'clinic_management',
      moduleLabel: 'Clinic management',
      limitKey: 'clinics_limit',
      limitLabel: 'Clinic limit reached for your current plan',
      currentCount: totalClinics,
    });

    const [result] = await pool.query(
      `INSERT INTO clinics (owner_doctor_id, name, registration_number, certificate_path, address, city, state, pincode, latitude, longitude, phone, email, logo, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [doctorId, name, registration_number, certPath, address, city, state, pincode, latitude || null, longitude || null, phone, email, logoPath, description]
    );

    // Set this as doctor's primary clinic if first
    const [dp] = await pool.query('SELECT clinic_id FROM doctor_profiles WHERE user_id = ?', [doctorId]);
    if (!dp.length || !dp[0].clinic_id) {
      await pool.query('UPDATE doctor_profiles SET clinic_id = ? WHERE user_id = ?', [result.insertId, doctorId]);
    }

    // Notify admins
    const [admins] = await pool.query(
      `SELECT u.id FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE r.name = 'admin'`
    );
    for (const admin of admins) {
      await sendNotification(admin.id, 'New Clinic Registration',
        `New clinic "${name}" requires verification.`, 'verification', result.insertId, 'clinic');
    }

    res.status(201).json({ clinic_id: result.insertId, message: 'Clinic registered. Pending admin verification.' });
    const io = req.app.get('io');
    await notifyAdmins(io, 'clinic_registered');
  } catch (err) {
    if (err instanceof SubscriptionLimitError) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code, details: err.details });
    }
    res.status(500).json({ error: err.message });
  }
};

// Get doctor's clinics
exports.getMyClinics = async (req, res) => {
  try {
    const [clinics] = await pool.query(
      `SELECT c.*, cp.photos
       FROM clinics c
       LEFT JOIN (
         SELECT clinic_id, GROUP_CONCAT(photo_path) as photos
         FROM clinic_photos
         GROUP BY clinic_id
       ) cp ON cp.clinic_id = c.id
       WHERE c.owner_doctor_id = ?
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    const mapped = clinics.map((c) => ({ ...c, photos: c.photos ? c.photos.split(',') : [] }));
    res.json({ clinics: mapped });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Update clinic
exports.updateClinic = async (req, res) => {
  const { id } = req.params;
  const { name, registration_number, address, city, state, pincode, latitude, longitude, phone, email, description } = req.body;
  try {
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });
    const [rows] = await pool.query(
      'SELECT registration_number, certificate_path, logo, is_verified FROM clinics WHERE id = ? AND owner_doctor_id = ?',
      [id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Clinic not found' });
    const existing = rows[0];
    const certPath = normalizePath(req.files?.certificate?.[0]?.path) || null;
    const logoPath = normalizePath(req.files?.logo?.[0]?.path) || null;
    const mandatoryChanged = String(existing.registration_number || '') !== String(registration_number || '') || !!certPath;
    const nextCert = certPath || existing.certificate_path;
    const nextLogo = logoPath || existing.logo;
    const nextVerified = (existing.is_verified && mandatoryChanged) ? 0 : existing.is_verified;

    await pool.query(
      'UPDATE clinics SET name=?, registration_number=?, certificate_path=?, address=?, city=?, state=?, pincode=?, latitude=?, longitude=?, phone=?, email=?, logo=?, description=?, is_verified=? WHERE id=? AND owner_doctor_id=?',
      [name, registration_number, nextCert, address, city, state, pincode, latitude || null, longitude || null, phone, email, nextLogo, description, nextVerified, id, req.user.id]
    );
    res.json({ message: 'Clinic updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Add receptionist
exports.addReceptionist = async (req, res) => {
  const { name, phone, email, clinic_id, org_role_id, password } = req.body;
  const doctorId = req.user.id;

  try {
    const [clinic] = await pool.query('SELECT id FROM clinics WHERE id = ? AND owner_doctor_id = ?', [clinic_id, doctorId]);
    if (!clinic.length) return res.status(403).json({ error: 'Unauthorized' });
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    const [[{ totalStaff }]] = await pool.query(
      `SELECT COUNT(DISTINCT rp.user_id) as totalStaff
       FROM receptionist_profiles rp
       JOIN clinics c ON c.id = rp.clinic_id
       WHERE c.owner_doctor_id = ?`,
      [doctorId]
    );
    await enforcePlanRule(pool, doctorId, {
      moduleKey: 'staff_roles',
      moduleLabel: 'Clinic staff management',
      limitKey: 'staff_limit',
      limitLabel: 'Staff limit reached for your current plan',
      currentCount: totalStaff,
    });

    let userId;
    let tempPassword = null;
    const conditions = [];
    const params = [];
    if (phone) { conditions.push('u.phone = ?'); params.push(phone); }
    if (email) { conditions.push('u.email = ?'); params.push(email); }
    if (conditions.length) {
      const [existing] = await pool.query(
        `SELECT u.id, r.name as role
         FROM users u JOIN roles r ON u.role_id = r.id
         WHERE ${conditions.join(' OR ')}
         LIMIT 1`,
        params
      );
      if (existing.length) {
        if (existing[0].role !== 'receptionist') {
          return res.status(400).json({ error: 'User exists with a different role' });
        }
        userId = existing[0].id;
      }
    }

    if (!userId) {
      const bcrypt = require('bcryptjs');
      const tempPass = password || Math.random().toString(36).slice(-8);
      if (!password) tempPassword = tempPass;
      const hash = await bcrypt.hash(tempPass, 12);
      const [result] = await pool.query(
        'INSERT INTO users (name, email, phone, password_hash, role_id, is_verified) VALUES (?, ?, ?, ?, (SELECT id FROM roles WHERE name = ?), ?)',
        [name, email || null, phone || null, hash, 'receptionist', true]
      );
      userId = result.insertId;
      if (tempPassword) {
        console.log(`\nReceptionist Credentials - Phone: ${phone || '-'} Email: ${email || '-'} Temp Password: ${tempPassword}\n`);
      }
    }

    await pool.query(
      'INSERT IGNORE INTO receptionist_profiles (user_id, clinic_id, doctor_id) VALUES (?, ?, ?)',
      [userId, clinic_id, doctorId]
    );

    if (org_role_id) {
      const [roleRows] = await pool.query(
        'SELECT id FROM org_roles WHERE id = ? AND org_type = ? AND org_id = ?',
        [org_role_id, 'clinic', clinic_id]
      );
      if (roleRows.length) {
        await pool.query(
          'INSERT IGNORE INTO org_user_roles (user_id, org_role_id) VALUES (?, ?)',
          [userId, org_role_id]
        );
      }
    }

    await sendNotification(userId, 'Account Created', 'You have been added as a receptionist. Please login.', 'system');
    res.status(201).json({ message: 'Clinic staff added', user_id: userId, temp_password: tempPassword });
  } catch (err) {
    if (err instanceof SubscriptionLimitError) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code, details: err.details });
    }
    res.status(500).json({ error: err.message });
  }
};

// List clinic roles
exports.getClinicRoles = async (req, res) => {
  const { id } = req.params;
  try {
    if (req.user.role !== 'admin') {
      const [owns] = await pool.query('SELECT id FROM clinics WHERE id = ? AND owner_doctor_id = ?', [id, req.user.id]);
      if (!owns.length) return res.status(403).json({ error: 'Unauthorized' });
    }

    const [roles] = await pool.query(
      `SELECT r.id, r.name, r.description,
              GROUP_CONCAT(p.code) as permissions
       FROM org_roles r
       LEFT JOIN org_role_permissions rp ON rp.org_role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
       WHERE r.org_type = 'clinic' AND r.org_id = ?
       GROUP BY r.id
       ORDER BY r.name`,
      [id]
    );
    const mapped = roles.map((r) => ({ ...r, permissions: r.permissions ? r.permissions.split(',') : [] }));
    res.json({ roles: mapped });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Create clinic role with permissions
exports.createClinicRole = async (req, res) => {
  const { id } = req.params;
  const { name, description, permissions } = req.body;
  try {
    if (!name) return res.status(400).json({ error: 'Role name required' });
    if (req.user.role !== 'admin') {
      const [owns] = await pool.query('SELECT id FROM clinics WHERE id = ? AND owner_doctor_id = ?', [id, req.user.id]);
      if (!owns.length) return res.status(403).json({ error: 'Unauthorized' });
    }

    const [result] = await pool.query(
      'INSERT INTO org_roles (org_type, org_id, name, description, created_by) VALUES (?, ?, ?, ?, ?)',
      ['clinic', id, name, description || null, req.user.id]
    );
    const roleId = result.insertId;

    if (Array.isArray(permissions) && permissions.length) {
      const [permRows] = await pool.query(
        'SELECT id FROM permissions WHERE code IN (?)',
        [permissions]
      );
      if (permRows.length) {
        const rows = permRows.map((p) => [roleId, p.id]);
        await pool.query('INSERT INTO org_role_permissions (org_role_id, permission_id) VALUES ?', [rows]);
      }
    }

    res.status(201).json({ message: 'Role created', role_id: roleId });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Update clinic role permissions
exports.updateClinicRolePermissions = async (req, res) => {
  const { id, roleId } = req.params;
  const { permissions } = req.body;
  try {
    if (req.user.role !== 'admin') {
      const [owns] = await pool.query('SELECT id FROM clinics WHERE id = ? AND owner_doctor_id = ?', [id, req.user.id]);
      if (!owns.length) return res.status(403).json({ error: 'Unauthorized' });
    }

    const [roleRows] = await pool.query(
      'SELECT id FROM org_roles WHERE id = ? AND org_type = ? AND org_id = ?',
      [roleId, 'clinic', id]
    );
    if (!roleRows.length) return res.status(404).json({ error: 'Role not found' });

    await pool.query('DELETE FROM org_role_permissions WHERE org_role_id = ?', [roleId]);
    if (Array.isArray(permissions) && permissions.length) {
      const [permRows] = await pool.query('SELECT id FROM permissions WHERE code IN (?)', [permissions]);
      if (permRows.length) {
        const rows = permRows.map((p) => [roleId, p.id]);
        await pool.query('INSERT INTO org_role_permissions (org_role_id, permission_id) VALUES ?', [rows]);
      }
    }
    res.json({ message: 'Role permissions updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Assign clinic role to a receptionist
exports.assignClinicRole = async (req, res) => {
  const { id, roleId } = req.params;
  const { user_id } = req.body;
  try {
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    if (req.user.role !== 'admin') {
      const [owns] = await pool.query('SELECT id FROM clinics WHERE id = ? AND owner_doctor_id = ?', [id, req.user.id]);
      if (!owns.length) return res.status(403).json({ error: 'Unauthorized' });
    }

    const [roleRows] = await pool.query(
      'SELECT id FROM org_roles WHERE id = ? AND org_type = ? AND org_id = ?',
      [roleId, 'clinic', id]
    );
    if (!roleRows.length) return res.status(404).json({ error: 'Role not found' });

    const [rp] = await pool.query(
      'SELECT id FROM receptionist_profiles WHERE user_id = ? AND clinic_id = ?',
      [user_id, id]
    );
    if (!rp.length) return res.status(400).json({ error: 'User is not a receptionist of this clinic' });

    await pool.query('INSERT IGNORE INTO org_user_roles (user_id, org_role_id) VALUES (?, ?)', [user_id, roleId]);
    res.json({ message: 'Role assigned' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Get all clinics (public search)
exports.searchClinics = async (req, res) => {
  const { city, name, latitude, longitude, radius_km } = req.query;
  const lat = Number.parseFloat(latitude);
  const lng = Number.parseFloat(longitude);
  const radius = Number.parseFloat(radius_km) || 10;
  const useGeo = Number.isFinite(lat) && Number.isFinite(lng);
  const distanceExpr = `6371 * acos(
    cos(radians(?)) * cos(radians(c.latitude)) * cos(radians(c.longitude) - radians(?)) +
    sin(radians(?)) * sin(radians(c.latitude))
  )`;
  try {
    let query = `
      SELECT c.id, c.name, c.address, c.city, c.state, c.phone, c.logo, c.latitude, c.longitude,
             cp.photos
             ${useGeo ? `, (${distanceExpr}) as distance_km` : ''}
             , u.name as doctor_name, dp.specialization
      FROM clinics c
      JOIN users u ON c.owner_doctor_id = u.id
      LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
      LEFT JOIN (
        SELECT clinic_id, GROUP_CONCAT(photo_path) as photos
        FROM clinic_photos
        GROUP BY clinic_id
      ) cp ON cp.clinic_id = c.id
      WHERE c.is_verified = 1 AND c.is_active = 1
    `;
    const params = [];
    if (useGeo) {
      query += ' AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL';
    }
    if (city) { query += ' AND c.city LIKE ?'; params.push(`%${city}%`); }
    if (name) { query += ' AND c.name LIKE ?'; params.push(`%${name}%`); }
    if (useGeo) {
      params.push(lat, lng, lat);
      query += ' HAVING distance_km <= ?';
      params.push(radius);
      query += ' ORDER BY distance_km ASC, c.name';
    } else {
      query += ' ORDER BY c.name';
    }
    const [clinics] = await pool.query(query, params);
    const mapped = clinics.map((c) => ({ ...c, photos: c.photos ? c.photos.split(',') : [] }));
    res.json({ clinics: mapped });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Upload clinic photos
exports.addClinicPhotos = async (req, res) => {
  const { id } = req.params;
  const doctorId = req.user.id;
  try {
    const [clinic] = await pool.query('SELECT id FROM clinics WHERE id = ? AND owner_doctor_id = ?', [id, doctorId]);
    if (!clinic.length) return res.status(403).json({ error: 'Unauthorized' });

    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'No photos uploaded' });

    const rows = files.map((file) => ([id, `/public/clinics/${file.filename}`]));
    await pool.query('INSERT INTO clinic_photos (clinic_id, photo_path) VALUES ?', [rows]);
    res.status(201).json({ message: 'Clinic photos uploaded' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Request admin verification (clinic)
exports.requestVerification = async (req, res) => {
  const { id } = req.params;
  try {
    const [clinics] = await pool.query(
      'SELECT id, name, registration_number, certificate_path, is_verified FROM clinics WHERE id = ? AND owner_doctor_id = ?',
      [id, req.user.id]
    );
    if (!clinics.length) return res.status(404).json({ error: 'Clinic not found' });
    const clinic = clinics[0];
    if (clinic.is_verified) return res.status(400).json({ error: 'Already verified' });
    if (!clinic.registration_number) return res.status(400).json({ error: 'Registration number is required' });
    if (!clinic.certificate_path) return res.status(400).json({ error: 'Upload clinic certificate first' });

    await notifyAdminsVerification(`Clinic verification requested: ${clinic.name}`, clinic.id);
    res.json({ message: 'Verification request sent to admin' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// List clinic receptionists
exports.getClinicReceptionists = async (req, res) => {
  const { id } = req.params;
  try {
    if (req.user.role !== 'admin') {
      const [owns] = await pool.query('SELECT id FROM clinics WHERE id = ? AND owner_doctor_id = ?', [id, req.user.id]);
      if (!owns.length) return res.status(403).json({ error: 'Unauthorized' });
    }

    const [rows] = await pool.query(
      `SELECT rp.user_id, u.name, u.phone, u.email,
              GROUP_CONCAT(DISTINCT org.name ORDER BY org.name SEPARATOR ', ') as assigned_roles
       FROM receptionist_profiles rp
       JOIN users u ON u.id = rp.user_id
       LEFT JOIN org_user_roles our ON our.user_id = u.id
       LEFT JOIN org_roles org ON org.id = our.org_role_id AND org.org_type = 'clinic' AND org.org_id = rp.clinic_id
       WHERE rp.clinic_id = ?
       GROUP BY rp.user_id, u.name, u.phone, u.email
       ORDER BY u.name`,
      [id]
    );
    res.json({ receptionists: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
