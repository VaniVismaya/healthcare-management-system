const { pool } = require('../config/database');
const { sendNotification } = require('../utils/notification');
const bcrypt = require('bcryptjs');
const { enforcePlanRule, SubscriptionLimitError } = require('../utils/subscriptionLimits');

const normalizePath = (p) => (p ? p.replace(/\\/g, '/') : p);

const resolvePharmacyOwner = async (userId) => {
  const [[profile]] = await pool.query(
    'SELECT user_id FROM pharmacist_profiles WHERE user_id = ?',
    [userId]
  );
  if (profile) return { ownerId: userId, isOwner: true };

  const [[org]] = await pool.query(
    `SELECT r.org_id
     FROM org_user_roles ur
     JOIN org_roles r ON ur.org_role_id = r.id
     WHERE ur.user_id = ? AND r.org_type = 'pharmacy'
     LIMIT 1`,
    [userId]
  );
  if (!org) return { ownerId: null, isOwner: false };
  return { ownerId: org.org_id, isOwner: false };
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

// Search pharmacies (public)
exports.searchPharmacies = async (req, res) => {
  const { city, name, latitude, longitude, radius_km } = req.query;
  const lat = Number.parseFloat(latitude);
  const lng = Number.parseFloat(longitude);
  const radius = Number.parseFloat(radius_km) || 10;
  const useGeo = Number.isFinite(lat) && Number.isFinite(lng);
  const distanceExpr = `6371 * acos(
    cos(radians(?)) * cos(radians(pp.latitude)) * cos(radians(pp.longitude) - radians(?)) +
    sin(radians(?)) * sin(radians(pp.latitude))
  )`;
  try {
    let query = `SELECT u.id, u.name, u.profile_image, pp.pharmacy_name, pp.address, pp.city, pp.state, pp.pincode,
      pp.phone, pp.gstin, pp.latitude, pp.longitude,
      pph.photos
      ${useGeo ? `, (${distanceExpr}) as distance_km` : ''}
      FROM users u JOIN pharmacist_profiles pp ON u.id = pp.user_id
      LEFT JOIN (
        SELECT pharmacist_id, GROUP_CONCAT(photo_path) as photos
        FROM pharmacy_photos
        GROUP BY pharmacist_id
      ) pph ON pph.pharmacist_id = u.id
      WHERE u.is_verified = 1 AND u.is_active = 1 AND pp.is_verified = 1`;
    const params = [];
    if (useGeo) {
      query += ' AND pp.latitude IS NOT NULL AND pp.longitude IS NOT NULL';
    }
    if (city) { query += ' AND pp.city LIKE ?'; params.push(`%${city}%`); }
    if (name) { query += ' AND (pp.pharmacy_name LIKE ? OR u.name LIKE ?)'; params.push(`%${name}%`, `%${name}%`); }
    if (useGeo) {
      params.push(lat, lng, lat);
      query += ' HAVING distance_km <= ?';
      params.push(radius);
      query += ' ORDER BY distance_km ASC, pp.pharmacy_name';
    } else {
      query += ' ORDER BY pp.pharmacy_name';
    }
    const [pharmacies] = await pool.query(query, params);
    const mapped = pharmacies.map((p) => ({ ...p, photos: p.photos ? p.photos.split(',') : [] }));
    res.json({ pharmacies: mapped });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Setup pharmacist profile
exports.setupProfile = async (req, res) => {
  const { pharmacy_name, license_number, address, city, state, pincode, latitude, longitude, phone, gstin } = req.body;
  const userId = req.user.id;
  try {
    const { isOwner } = await resolvePharmacyOwner(userId);
    if (!isOwner) return res.status(403).json({ error: 'Only pharmacy owner can update profile' });
    if (!license_number) return res.status(400).json({ error: 'License number is required' });
    const [[user]] = await pool.query('SELECT phone FROM users WHERE id = ?', [userId]);
    const contactPhone = (user?.phone || phone || '').trim() || null;
    if (!contactPhone) return res.status(400).json({ error: 'Phone number is required' });
    const certPath = normalizePath(req.files?.license_certificate?.[0]?.path) || null;
    const [existing] = await pool.query('SELECT id, pharmacy_name, license_number, license_certificate_path, is_verified FROM pharmacist_profiles WHERE user_id = ?', [userId]);
    const [[existingUser]] = await pool.query('SELECT is_verified FROM users WHERE id = ?', [userId]);
    if (!certPath && (!existing.length || !existing[0]?.license_certificate_path)) {
      return res.status(400).json({ error: 'License certificate is required' });
    }
    const wasVerified = !!(existingUser?.is_verified && existing[0]?.is_verified);
    const mandatoryChanged = existing.length
      && (
        String(existing[0].pharmacy_name || '') !== String(pharmacy_name || '') ||
        String(existing[0].license_number || '') !== String(license_number || '') ||
        !!certPath
      );
    
    if (existing.length) {
      const existingCert = existing[0].license_certificate_path || null;
      await pool.query(
        `UPDATE pharmacist_profiles SET pharmacy_name=?, license_number=?, license_certificate_path=?, address=?, city=?, state=?, pincode=?, latitude=?, longitude=?, phone=?, gstin=?, is_verified=? WHERE user_id=?`,
        [pharmacy_name, license_number, certPath || existingCert, address, city, state, pincode, latitude, longitude, contactPhone, gstin, (wasVerified && mandatoryChanged) ? 0 : existing[0].is_verified, userId]
      );
      if (wasVerified && mandatoryChanged) {
        await pool.query('UPDATE users SET is_verified = 0 WHERE id = ?', [userId]);
      }
    } else {
      await pool.query(
        `INSERT INTO pharmacist_profiles (user_id, pharmacy_name, license_number, license_certificate_path, address, city, state, pincode, latitude, longitude, phone, gstin)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, pharmacy_name, license_number, certPath, address, city, state, pincode, latitude, longitude, contactPhone, gstin]
      );
    }
    res.json({ message: 'Pharmacy profile updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Get pharmacist profile
exports.getProfile = async (req, res) => {
  try {
    const { ownerId } = await resolvePharmacyOwner(req.user.id);
    if (!ownerId) return res.status(403).json({ error: 'Pharmacy access denied' });
    const [profiles] = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.profile_image, pp.*,
              COALESCE(pp.phone, u.phone) as phone
       FROM users u LEFT JOIN pharmacist_profiles pp ON u.id = pp.user_id WHERE u.id = ?`,
      [ownerId]
    );
    if (!profiles.length) return res.status(404).json({ error: 'Profile not found' });
    const [photos] = await pool.query(
      'SELECT photo_path FROM pharmacy_photos WHERE pharmacist_id = ? ORDER BY created_at DESC',
      [ownerId]
    );
    res.json({ pharmacist: { ...profiles[0], photos: photos.map((p) => p.photo_path) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Upload pharmacy photos
exports.addPharmacyPhotos = async (req, res) => {
  try {
    const { ownerId, isOwner } = await resolvePharmacyOwner(req.user.id);
    if (!ownerId || !isOwner) return res.status(403).json({ error: 'Only pharmacy owner can upload photos' });
    const pharmacistId = ownerId;
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'No photos uploaded' });
    const rows = files.map((file) => ([pharmacistId, `/public/pharmacies/${file.filename}`]));
    await pool.query('INSERT INTO pharmacy_photos (pharmacist_id, photo_path) VALUES ?', [rows]);
    res.status(201).json({ message: 'Pharmacy photos uploaded' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Request admin verification (pharmacist)
exports.requestVerification = async (req, res) => {
  const userId = req.user.id;
  try {
    const { isOwner } = await resolvePharmacyOwner(userId);
    if (!isOwner) return res.status(403).json({ error: 'Only pharmacy owner can request verification' });
    const [[user]] = await pool.query('SELECT name, is_verified FROM users WHERE id = ?', [userId]);
    const [[profile]] = await pool.query(
      'SELECT pharmacy_name, license_number, license_certificate_path, is_verified FROM pharmacist_profiles WHERE user_id = ?',
      [userId]
    );
    if (!user || !profile) return res.status(404).json({ error: 'Profile not found' });
    if (user.is_verified || profile.is_verified) return res.status(400).json({ error: 'Already verified' });
    if (!profile.pharmacy_name || !profile.license_number) {
      return res.status(400).json({ error: 'Complete pharmacy name and license number first' });
    }
    if (!profile.license_certificate_path) {
      return res.status(400).json({ error: 'Upload license certificate first' });
    }
    await notifyAdmins(`Pharmacy verification requested: ${user.name}`, userId);
    res.json({ message: 'Verification request sent to admin' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add medicine
exports.addMedicine = async (req, res) => {
  const { name, generic_name, brand_name, manufacturer, composition, category, dosage_form, strength, unit, price, mrp, requires_prescription } = req.body;
  try {
    const { ownerId } = await resolvePharmacyOwner(req.user.id);
    if (!ownerId) return res.status(403).json({ error: 'Pharmacy access denied' });
    const [result] = await pool.query(
      `INSERT INTO medicines (pharmacist_id, name, generic_name, brand_name, manufacturer, composition, category, dosage_form, strength, unit, price, mrp, requires_prescription)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ownerId, name, generic_name, brand_name, manufacturer, composition, category, dosage_form || 'tablet', strength, unit, price, mrp || null, requires_prescription !== false]
    );
    res.status(201).json({ medicine_id: result.insertId, message: 'Medicine added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Search medicines (for doctors autocomplete)
exports.searchMedicines = async (req, res) => {
  const { q } = req.query;
  try {
    const [medicines] = await pool.query(
      `SELECT m.id, m.name, m.generic_name, m.brand_name, m.strength, m.dosage_form, m.category,
              COALESCE(ms.quantity, 0) as stock_quantity, u.id as pharmacist_id, pp.pharmacy_name
       FROM medicines m
       JOIN users u ON m.pharmacist_id = u.id
       LEFT JOIN pharmacist_profiles pp ON u.id = pp.user_id
       LEFT JOIN (
         SELECT medicine_id, MAX(quantity) as quantity
         FROM medicine_stock
         GROUP BY medicine_id
       ) ms ON m.id = ms.medicine_id
       WHERE m.is_active = 1 AND u.is_verified = 1
         AND COALESCE(ms.quantity, 0) > 0
         AND (m.name LIKE ? OR m.generic_name LIKE ? OR m.brand_name LIKE ? OR m.strength LIKE ?)
       ORDER BY stock_quantity DESC, m.name
       LIMIT 20`,
      [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`]
    );
    res.json({ medicines });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Get all medicines for pharmacist
exports.getMedicines = async (req, res) => {
  try {
    const { ownerId } = await resolvePharmacyOwner(req.user.id);
    if (!ownerId) return res.status(403).json({ error: 'Pharmacy access denied' });
    const [medicines] = await pool.query(
      `SELECT m.*, ms.quantity as stock_quantity, ms.low_stock_alert, ms.expiry_date, ms.batch_number
       FROM medicines m
       LEFT JOIN medicine_stock ms ON m.id = ms.medicine_id
       WHERE m.pharmacist_id = ? AND m.is_active = 1
       ORDER BY m.name`,
      [ownerId]
    );
    res.json({ medicines });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Update stock
exports.updateStock = async (req, res) => {
  const { medicine_id, quantity, batch_number, expiry_date, purchase_price, low_stock_alert, movement_type } = req.body;

  try {
    const { ownerId } = await resolvePharmacyOwner(req.user.id);
    if (!ownerId) return res.status(403).json({ error: 'Pharmacy access denied' });
    const [existing] = await pool.query('SELECT * FROM medicine_stock WHERE medicine_id = ?', [medicine_id]);
    
    if (existing.length) {
      const newQty = movement_type === 'in' ? existing[0].quantity + quantity : existing[0].quantity - quantity;
      await pool.query(
        'UPDATE medicine_stock SET quantity=?, batch_number=?, expiry_date=?, purchase_price=?, low_stock_alert=? WHERE medicine_id=?',
        [newQty, batch_number || existing[0].batch_number, expiry_date || existing[0].expiry_date,
         purchase_price || existing[0].purchase_price, low_stock_alert || existing[0].low_stock_alert, medicine_id]
      );
    } else {
      await pool.query(
        'INSERT INTO medicine_stock (medicine_id, quantity, batch_number, expiry_date, purchase_price, low_stock_alert) VALUES (?, ?, ?, ?, ?, ?)',
        [medicine_id, quantity, batch_number, expiry_date, purchase_price, low_stock_alert || 10]
      );
    }

    // Log movement
    await pool.query(
      'INSERT INTO stock_movements (medicine_id, movement_type, quantity, created_by) VALUES (?, ?, ?, ?)',
      [medicine_id, movement_type || 'in', quantity, req.user.id]
    );

    // Check low stock
    const [stock] = await pool.query('SELECT quantity, low_stock_alert FROM medicine_stock WHERE medicine_id = ?', [medicine_id]);
    if (stock.length && stock[0].quantity <= stock[0].low_stock_alert) {
      const [med] = await pool.query('SELECT name FROM medicines WHERE id = ?', [medicine_id]);
      await sendNotification(req.user.id, 'Low Stock Alert',
        `${med[0]?.name} is running low. Current stock: ${stock[0].quantity}`, 'stock_alert', medicine_id, 'medicine');
    }

    res.json({ message: 'Stock updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Get stock alerts
exports.getStockAlerts = async (req, res) => {
  try {
    const { ownerId } = await resolvePharmacyOwner(req.user.id);
    if (!ownerId) return res.status(403).json({ error: 'Pharmacy access denied' });
    const [alerts] = await pool.query(
      `SELECT m.id, m.name, m.strength, m.dosage_form, ms.quantity, ms.low_stock_alert, ms.expiry_date,
              CASE WHEN ms.quantity = 0 THEN 'out_of_stock'
                   WHEN ms.quantity <= ms.low_stock_alert THEN 'low_stock'
                   WHEN ms.expiry_date < DATE_ADD(NOW(), INTERVAL 30 DAY) THEN 'expiring_soon'
                   ELSE 'ok' END as alert_type
       FROM medicines m
       LEFT JOIN medicine_stock ms ON m.id = ms.medicine_id
       WHERE m.pharmacist_id = ? AND m.is_active = 1
         AND (ms.quantity <= ms.low_stock_alert OR ms.expiry_date < DATE_ADD(NOW(), INTERVAL 30 DAY) OR ms.quantity = 0)
       ORDER BY ms.quantity ASC`,
      [ownerId]
    );
    res.json({ alerts });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    const { ownerId } = await resolvePharmacyOwner(req.user.id);
    if (!ownerId) return res.status(403).json({ error: 'Pharmacy access denied' });
    const [[totalMeds]] = await pool.query('SELECT COUNT(*) as count FROM medicines WHERE pharmacist_id = ? AND is_active = 1', [ownerId]);
    const [[outOfStock]] = await pool.query(
      'SELECT COUNT(*) as count FROM medicine_stock ms JOIN medicines m ON ms.medicine_id = m.id WHERE m.pharmacist_id = ? AND ms.quantity = 0', [ownerId]
    );
    const [[lowStock]] = await pool.query(
      'SELECT COUNT(*) as count FROM medicine_stock ms JOIN medicines m ON ms.medicine_id = m.id WHERE m.pharmacist_id = ? AND ms.quantity > 0 AND ms.quantity <= ms.low_stock_alert', [ownerId]
    );
    const [[pendingPrescriptions]] = await pool.query(
      'SELECT COUNT(*) as count FROM prescriptions WHERE pharmacist_id = ? AND is_dispensed = 0', [ownerId]
    );

    res.json({ total_medicines: totalMeds.count, out_of_stock: outOfStock.count, low_stock: lowStock.count, pending_prescriptions: pendingPrescriptions.count });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Create pharmacy staff account
exports.createStaff = async (req, res) => {
  const { name, phone, email, password, org_role_id } = req.body;
  try {
    const { ownerId, isOwner } = await resolvePharmacyOwner(req.user.id);
    if (!ownerId || !isOwner) return res.status(403).json({ error: 'Only pharmacy owner can add staff' });
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });
    if (!org_role_id) return res.status(400).json({ error: 'Select a role for staff' });

    const conditions = [];
    const params = [];
    if (phone) { conditions.push('u.phone = ?'); params.push(phone); }
    if (email) { conditions.push('u.email = ?'); params.push(email); }

    let userId;
    let tempPassword = null;
    if (conditions.length) {
      const [existing] = await pool.query(
        `SELECT u.id, r.name as role
         FROM users u JOIN roles r ON u.role_id = r.id
         WHERE ${conditions.join(' OR ')}
         LIMIT 1`,
        params
      );
      if (existing.length) {
        if (existing[0].role !== 'pharmacist') {
          return res.status(400).json({ error: 'User exists with a different role' });
        }
        userId = existing[0].id;
      }
    }

    if (!userId) {
      const bcryptPass = password || Math.random().toString(36).slice(-8);
      if (!password) tempPassword = bcryptPass;
      const hash = await bcrypt.hash(bcryptPass, 12);
      const [result] = await pool.query(
        'INSERT INTO users (name, email, phone, password_hash, role_id, is_verified) VALUES (?, ?, ?, ?, (SELECT id FROM roles WHERE name = ?), ?)',
        [name, email || null, phone || null, hash, 'pharmacist', 1]
      );
      userId = result.insertId;
    }

    const [roleRows] = await pool.query(
      'SELECT id FROM org_roles WHERE id = ? AND org_type = ? AND org_id = ?',
      [org_role_id, 'pharmacy', ownerId]
    );
    if (!roleRows.length) return res.status(400).json({ error: 'Invalid role selected' });

    await pool.query('INSERT IGNORE INTO org_user_roles (user_id, org_role_id) VALUES (?, ?)', [userId, org_role_id]);

    res.status(201).json({ message: 'Staff account created', user_id: userId, temp_password: tempPassword });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
