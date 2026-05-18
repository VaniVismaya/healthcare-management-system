const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { sendOTP, verifyOTP } = require('../utils/otp');
const { sendNotification } = require('../utils/notification');
const { verifyFirebaseIdToken, isFirebaseEnabled } = require('../utils/firebaseAdmin');
const { parseIdList, resolveDoctorProfileFields } = require('../utils/doctorProfileData');
const { assignPlanToUser, getDefaultPlanForRole, formatPlanRow } = require('../utils/subscription');
const { isDemoAdmin } = require('../utils/demoConfig');

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

const normalizePhone = (phone) => {
  if (!phone) return phone;
  const cleaned = String(phone).trim().replace(/[\s\-()]/g, '');
  if (!cleaned) return cleaned;
  if (cleaned.startsWith('+')) return cleaned;
  if (/^\d{10}$/.test(cleaned)) return `+91${cleaned}`;
  if (/^91\d{10}$/.test(cleaned)) return `+${cleaned}`;
  return cleaned;
};

const normalizeEmail = (email) => {
  if (!email) return null;
  return String(email).trim().toLowerCase();
};

const isEmail = (value) => /\S+@\S+\.\S+/.test(String(value || '').trim());

const resolveIdentifier = (identifier) => {
  if (!identifier) return { type: null, value: null };
  if (isEmail(identifier)) {
    return { type: 'email', value: normalizeEmail(identifier) };
  }
  return { type: 'phone', value: normalizePhone(identifier) };
};

const generateTokens = (user) => {
  const access = jwt.sign(
    { id: user.id, role: user.role, uuid: user.uuid },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
  const refresh = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
  );
  return { access, refresh };
};

const withDemoFlags = (user) => {
  if (!user) return user;
  return {
    ...user,
    is_demo_admin: isDemoAdmin(user),
  };
};

const getFirebasePhone = async (firebaseIdToken) => {
  if (!firebaseIdToken) return null;
  const decoded = await verifyFirebaseIdToken(firebaseIdToken);
  if (!decoded) return null;
  const phone = decoded.phone_number || decoded.phoneNumber;
  return phone ? normalizePhone(phone) : null;
};

// Send OTP for registration/login
exports.sendOtp = async (req, res) => {
  const { phone, purpose } = req.body;
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return res.status(400).json({ error: 'Phone number required' });

  try {
    if (isFirebaseEnabled()) {
      return res.json({ message: 'Use Firebase OTP on client', phone: normalizedPhone, provider: 'firebase' });
    }
    const otp = await sendOTP(normalizedPhone, purpose || 'login');
    res.json({ message: 'OTP sent successfully', phone: normalizedPhone });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send OTP: ' + err.message });
  }
};

// Verify OTP
exports.verifyOtp = async (req, res) => {
  const { phone, otp, firebase_id_token } = req.body;
  let normalizedPhone = normalizePhone(phone);
  if (firebase_id_token) {
    const firebasePhone = await getFirebasePhone(firebase_id_token);
    if (!firebasePhone) return res.status(400).json({ error: 'Invalid Firebase token' });
    if (normalizedPhone && normalizedPhone !== firebasePhone) {
      return res.status(400).json({ error: 'Phone does not match Firebase token' });
    }
    normalizedPhone = firebasePhone;
  }
  if (!normalizedPhone) return res.status(400).json({ error: 'Phone number required' });
  try {
    if (!firebase_id_token) {
      const valid = await verifyOTP(normalizedPhone, otp);
      if (!valid) return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Mark phone as verified
    await pool.query('UPDATE users SET is_phone_verified = 1 WHERE phone = ?', [normalizedPhone]);
    res.json({ message: 'OTP verified successfully', phone: normalizedPhone });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Register
exports.register = async (req, res) => {
  const {
    name, email, phone, password, role,
    firebase_id_token,
    // Doctor
    specialization, qualification, medical_license_number, experience_years,
    primary_specialization_id, additional_specialization_ids, education_ids, department_ids,
    // Laboratory
    lab_name, registration_number, address, city, state, pincode, lab_phone,
    // Pharmacist
    pharmacy_name, license_number, gstin, pharmacy_phone,
    // Patient
    date_of_birth, gender, blood_group, allergies
  } = req.body;
  let normalizedPhone = normalizePhone(phone);
  let firebaseVerified = false;
  if (firebase_id_token) {
    const firebasePhone = await getFirebasePhone(firebase_id_token);
    if (!firebasePhone) return res.status(400).json({ error: 'Invalid Firebase token' });
    if (normalizedPhone && normalizedPhone !== firebasePhone) {
      return res.status(400).json({ error: 'Phone does not match Firebase token' });
    }
    normalizedPhone = firebasePhone;
    firebaseVerified = true;
  }
  const normalizedEmail = normalizeEmail(email);

  if (!['doctor', 'patient', 'laboratory', 'pharmacist'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (!normalizedPhone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  if (role === 'doctor') {
    const resolvedDoctorData = await resolveDoctorProfileFields(pool, {
      specialization,
      qualification,
      primary_specialization_id,
      additional_specialization_ids,
      education_ids,
    });
    req.resolvedDoctorData = resolvedDoctorData;
    if (!resolvedDoctorData.specialization || !resolvedDoctorData.qualification || !medical_license_number) {
      return res.status(400).json({ error: 'Primary specialization, education, and license number are required' });
    }
  }
  if (role === 'laboratory') {
    if (!lab_name || !registration_number || !address || !city || !state || !pincode) {
      return res.status(400).json({ error: 'Lab name, registration number, address, city, state, and pincode are required' });
    }
  }
  if (role === 'pharmacist') {
    if (!pharmacy_name || !license_number) {
      return res.status(400).json({ error: 'Pharmacy name and license number are required' });
    }
  }

  try {
    if (normalizedPhone) {
      const [existingPhone] = await pool.query('SELECT id FROM users WHERE phone = ?', [normalizedPhone]);
      if (existingPhone.length) return res.status(409).json({ error: 'Phone already registered' });
    }
    if (normalizedEmail) {
      const [existingEmail] = await pool.query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
      if (existingEmail.length) return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, phone, password_hash, role_id) VALUES (?, ?, ?, ?, (SELECT id FROM roles WHERE name = ?))',
      [name, normalizedEmail || null, normalizedPhone || null, hash, role]
    );

    const userId = result.insertId;

    // Create role-specific profile
    if (role === 'patient') {
      await pool.query(
        'INSERT INTO patient_profiles (user_id, date_of_birth, gender, blood_group, allergies) VALUES (?, ?, ?, ?, ?)',
        [userId, date_of_birth || null, gender || null, blood_group || null, allergies || null]
      );
      // Patients auto-verified after phone verification
      await pool.query('UPDATE users SET is_verified = 1 WHERE id = ?', [userId]);
    }

    if (role === 'doctor') {
      const resolvedDoctorData = req.resolvedDoctorData || await resolveDoctorProfileFields(pool, {
        specialization,
        qualification,
        primary_specialization_id,
        additional_specialization_ids,
        education_ids,
      });
      await pool.query(
        `INSERT INTO doctor_profiles (
           user_id, specialization, qualification, medical_license_number, experience_years,
           primary_specialization_id, additional_specialization_ids, education_ids
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          resolvedDoctorData.specialization,
          resolvedDoctorData.qualification,
          medical_license_number,
          experience_years || 0,
          resolvedDoctorData.primarySpecializationId,
          JSON.stringify(resolvedDoctorData.additionalSpecializationIds || []),
          JSON.stringify(resolvedDoctorData.educationIds || []),
        ]
      );

      const departmentIds = parseIdList(department_ids);
      for (const departmentId of departmentIds) {
        await pool.query(
          'INSERT IGNORE INTO doctor_departments (doctor_id, department_id) VALUES (?, ?)',
          [userId, departmentId]
        );
      }
    }

    if (role === 'laboratory') {
      await pool.query(
        `INSERT INTO laboratory_profiles (user_id, lab_name, registration_number, address, city, state, pincode, phone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, lab_name, registration_number, address, city, state, pincode, lab_phone || null]
      );
    }

    if (role === 'pharmacist') {
      await pool.query(
        `INSERT INTO pharmacist_profiles (user_id, pharmacy_name, license_number, phone, gstin)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, pharmacy_name, license_number, pharmacy_phone || null, gstin || null]
      );
    }

    if (firebaseVerified && normalizedPhone) {
      await pool.query('UPDATE users SET is_phone_verified = 1 WHERE id = ?', [userId]);
    }

    if (['doctor', 'patient', 'laboratory', 'pharmacist'].includes(role)) {
      const defaultPlan = await getDefaultPlanForRole(pool, role);
      if (defaultPlan) {
        await assignPlanToUser(pool, userId, defaultPlan.id);
      }
    }

    // Notify admin for verification
    if (['doctor', 'laboratory', 'pharmacist'].includes(role)) {
      const [admins] = await pool.query(
        `SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'admin'`
      );
      for (const admin of admins) {
        await sendNotification(admin.id, 'New Registration', 
          `New ${role} registered: ${name}. Verification required.`, 'verification', userId, 'user');
      }
    }

    const [user] = await pool.query(
      `SELECT u.id, u.uuid, u.name, u.email, u.phone, r.name as role, u.is_verified, u.is_active,
              u.current_plan_id, u.subscription_plan, u.subscription_expires_at,
              sp.id as plan_id, sp.name as plan_name, sp.code as plan_code, sp.role as plan_role,
              sp.price as plan_price, sp.duration_days as plan_duration_days, sp.features as plan_features,
              sp.modules as plan_modules, sp.limits as plan_limits
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN subscription_plans sp ON sp.id = u.current_plan_id
       WHERE u.id = ?`,
      [userId]
    );

    const tokens = generateTokens(user[0]);
    const safeUser = withDemoFlags({
      ...user[0],
      current_plan: user[0].plan_id
        ? formatPlanRow({
            id: user[0].plan_id,
            name: user[0].plan_name,
            code: user[0].plan_code,
            role: user[0].plan_role,
            price: user[0].plan_price,
            duration_days: user[0].plan_duration_days,
            features: user[0].plan_features,
            modules: user[0].plan_modules,
            limits: user[0].plan_limits,
          })
        : null,
    });
    res.status(201).json({ message: 'Registration successful', user: safeUser, tokens });

    const io = req.app.get('io');
    await notifyAdmins(io, 'registration');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Login with password
exports.login = async (req, res) => {
  const { phone, password, role } = req.body;
  const { type, value } = resolveIdentifier(phone);
  if (!value) return res.status(400).json({ error: 'Phone number required' });
  if (type === 'email') return res.status(400).json({ error: 'Phone number required' });
  try {
    const [users] = await pool.query(
      `SELECT u.*, r.name as role,
              sp.id as plan_id, sp.name as plan_name, sp.code as plan_code, sp.role as plan_role,
              sp.price as plan_price, sp.duration_days as plan_duration_days,
              sp.features as plan_features, sp.modules as plan_modules, sp.limits as plan_limits
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN subscription_plans sp ON sp.id = u.current_plan_id
       WHERE ${type === 'email' ? 'u.email' : 'u.phone'} = ?`,
      [value]
    );
    if (!users.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = users[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is blocked. Please contact support team.' });
    }
    if (role && user.role !== role) {
      return res.status(401).json({ error: 'Selected role does not match account' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    const tokens = generateTokens(user);
    const { password_hash, ...baseUser } = user;
    baseUser.current_plan = baseUser.current_plan_id
      ? formatPlanRow({
          id: baseUser.plan_id,
          name: baseUser.plan_name,
          code: baseUser.plan_code,
          role: baseUser.plan_role,
          price: baseUser.plan_price,
          duration_days: baseUser.plan_duration_days,
          features: baseUser.plan_features,
          modules: baseUser.plan_modules,
          limits: baseUser.plan_limits,
        })
      : null;
    const safeUser = withDemoFlags(baseUser);
    res.json({ message: 'Login successful', user: safeUser, tokens });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Login with OTP
exports.loginWithOtp = async (req, res) => {
  const { phone, otp, role, firebase_id_token } = req.body;
  const { type, value } = resolveIdentifier(phone);
  if (type === 'email') return res.status(400).json({ error: 'Phone number required' });
  let normalizedPhone = value;
  try {
    if (firebase_id_token) {
      const firebasePhone = await getFirebasePhone(firebase_id_token);
      if (!firebasePhone) return res.status(400).json({ error: 'Invalid Firebase token' });
      if (normalizedPhone && normalizedPhone !== firebasePhone) {
        return res.status(400).json({ error: 'Phone does not match Firebase token' });
      }
      normalizedPhone = firebasePhone;
    } else {
      const valid = await verifyOTP(normalizedPhone, otp);
      if (!valid) return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const [users] = await pool.query(
      `SELECT u.*, r.name as role,
              sp.id as plan_id, sp.name as plan_name, sp.code as plan_code, sp.role as plan_role,
              sp.price as plan_price, sp.duration_days as plan_duration_days,
              sp.features as plan_features, sp.modules as plan_modules, sp.limits as plan_limits
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN subscription_plans sp ON sp.id = u.current_plan_id
       WHERE u.phone = ?`,
      [normalizedPhone]
    );
    if (!users.length) return res.status(404).json({ error: 'User not found', code: 'NOT_REGISTERED' });
    if (!users[0].is_active) {
      return res.status(403).json({ error: 'Account is blocked. Please contact support team.' });
    }
    if (role && users[0].role !== role) {
      return res.status(401).json({ error: 'Selected role does not match account' });
    }

    await pool.query('UPDATE users SET last_login = NOW(), is_phone_verified = 1 WHERE id = ?', [users[0].id]);

    const tokens = generateTokens(users[0]);
    const { password_hash, ...baseUser } = users[0];
    baseUser.current_plan = baseUser.current_plan_id
      ? formatPlanRow({
          id: baseUser.plan_id,
          name: baseUser.plan_name,
          code: baseUser.plan_code,
          role: baseUser.plan_role,
          price: baseUser.plan_price,
          duration_days: baseUser.plan_duration_days,
          features: baseUser.plan_features,
          modules: baseUser.plan_modules,
          limits: baseUser.plan_limits,
        })
      : null;
    const safeUser = withDemoFlags(baseUser);
    res.json({ message: 'Login successful', user: safeUser, tokens });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Refresh token
exports.refreshToken = async (req, res) => {
  const { refresh_token } = req.body;
  try {
    const decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);
    const [users] = await pool.query(
      `SELECT u.*, r.name as role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
      [decoded.id]
    );
    if (!users.length) return res.status(401).json({ error: 'Invalid refresh token' });
    
    const tokens = generateTokens(users[0]);
    res.json({ tokens });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

// Get current user
exports.getMe = async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.uuid, u.name, u.email, u.phone, r.name as role, u.profile_image,
              u.is_verified, u.is_active, u.subscription_plan, u.current_plan_id, u.subscription_expires_at, u.last_login,
              sp.id as plan_id, sp.name as plan_name, sp.code as plan_code, sp.role as plan_role,
              sp.price as plan_price, sp.duration_days as plan_duration_days, sp.features as plan_features,
              sp.modules as plan_modules, sp.limits as plan_limits
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN subscription_plans sp ON sp.id = u.current_plan_id
       WHERE u.id = ?`,
      [req.user.id]
    );
    const currentPlan = users[0]?.plan_id
      ? formatPlanRow({
          id: users[0].plan_id,
          name: users[0].plan_name,
          code: users[0].plan_code,
          role: users[0].plan_role,
          price: users[0].plan_price,
          duration_days: users[0].plan_duration_days,
          features: users[0].plan_features,
          modules: users[0].plan_modules,
          limits: users[0].plan_limits,
        })
      : null;
    res.json({ user: withDemoFlags({ ...users[0], current_plan: currentPlan }) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  try {
    const [users] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const valid = await bcrypt.compare(current_password, users[0].password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password incorrect' });

    const hash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
