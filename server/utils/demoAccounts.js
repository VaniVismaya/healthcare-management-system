const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { assignPlanToUser, getDefaultPlanForRole } = require('./subscription');
const { DEMO_ADMIN } = require('./demoConfig');

const DEMO_PASSWORDS = {
  admin: 'Admin@123456',
  doctor: 'Doctor@123',
  patient: 'Patient@123',
  laboratory: 'Lab@123',
  pharmacist: 'Pharm@123',
  receptionist: 'Recep@123',
};

const DEMO_ACCOUNTS = {
  admin: {
    role: 'admin',
    name: process.env.ADMIN_NAME || 'Super Admin',
    email: process.env.ADMIN_EMAIL || 'admin@medicare.com',
    phone: process.env.ADMIN_PHONE || '+919999999999',
    password: process.env.ADMIN_PASSWORD || DEMO_PASSWORDS.admin,
  },
  demoAdmin: {
    role: DEMO_ADMIN.role,
    name: DEMO_ADMIN.name,
    email: DEMO_ADMIN.email,
    phone: DEMO_ADMIN.phone,
    password: DEMO_ADMIN.password,
  },
  doctor: {
    role: 'doctor',
    name: 'Dr. Raji Kumar',
    email: 'demo.doctor@medicarepro.local',
    phone: '+919000000001',
    password: DEMO_PASSWORDS.doctor,
  },
  patient: {
    role: 'patient',
    name: 'Anita Sharma',
    email: 'demo.patient@medicarepro.local',
    phone: '+919000000010',
    password: DEMO_PASSWORDS.patient,
  },
  laboratory: {
    role: 'laboratory',
    name: 'City Diagnostics',
    email: 'demo.lab@medicarepro.local',
    phone: '+919000000020',
    password: DEMO_PASSWORDS.laboratory,
  },
  pharmacist: {
    role: 'pharmacist',
    name: 'MediCare Pharmacy',
    email: 'demo.pharmacy@medicarepro.local',
    phone: '+919000000030',
    password: DEMO_PASSWORDS.pharmacist,
  },
  receptionist: {
    role: 'receptionist',
    name: 'Clinic Reception',
    email: 'demo.reception@medicarepro.local',
    phone: '+919000000040',
    password: DEMO_PASSWORDS.receptionist,
  },
};

const DEMO_SUPPORT_PATIENTS = [
  {
    role: 'patient',
    name: 'Rahul Verma',
    email: 'demo.patient2@medicarepro.local',
    phone: '+919000000011',
    password: DEMO_PASSWORDS.patient,
    profile: { date_of_birth: '1991-03-18', gender: 'male', blood_group: 'A+', allergies: 'Dust allergy' },
  },
  {
    role: 'patient',
    name: 'Neha Iyer',
    email: 'demo.patient3@medicarepro.local',
    phone: '+919000000012',
    password: DEMO_PASSWORDS.patient,
    profile: { date_of_birth: '1988-11-02', gender: 'female', blood_group: 'B+', allergies: 'Penicillin' },
  },
];

const DEMO_SUPPORT_DOCTORS = [
  {
    account: {
      role: 'doctor',
      name: 'Dr. Meera Nair',
      email: 'demo.doctor2@medicarepro.local',
      phone: '+919000000002',
      password: DEMO_PASSWORDS.doctor,
    },
    clinic: {
      registration_number: 'DEMO-CLINIC-002',
      name: 'Sunrise Skin & Wellness',
      address: '88, Indiranagar 100 Feet Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560038',
      latitude: 12.9719,
      longitude: 77.6412,
      phone: '+919000000002',
      email: 'clinic2@medicarepro.local',
    },
    profile: {
      specialization: 'Dermatology',
      qualification: 'MBBS, MD Dermatology',
      medical_license_number: 'MED-MEERA-2201',
      experience_years: 11,
      consultation_fee: 700,
      bio: 'Dermatologist focused on acne care, pigmentation, and preventive skin health.',
      languages: 'English, Hindi, Malayalam',
    },
    schedule: {
      session_label: 'Afternoon',
      start_time: '14:00:00',
      end_time: '18:00:00',
      slot_duration_minutes: 15,
      max_patients_per_slot: 18,
    },
  },
  {
    account: {
      role: 'doctor',
      name: 'Dr. Arjun Rao',
      email: 'demo.doctor3@medicarepro.local',
      phone: '+919000000003',
      password: DEMO_PASSWORDS.doctor,
    },
    clinic: {
      registration_number: 'DEMO-CLINIC-003',
      name: 'Little Steps Child Care',
      address: '21, Jayanagar 4th Block',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560011',
      latitude: 12.9250,
      longitude: 77.5938,
      phone: '+919000000003',
      email: 'clinic3@medicarepro.local',
    },
    profile: {
      specialization: 'Pediatrics',
      qualification: 'MBBS, DCH',
      medical_license_number: 'MED-ARJUN-3390',
      experience_years: 9,
      consultation_fee: 600,
      bio: 'Pediatrician for vaccinations, fever care, nutrition, and routine child wellness.',
      languages: 'English, Hindi, Kannada',
    },
    schedule: {
      session_label: 'Morning',
      start_time: '10:00:00',
      end_time: '13:00:00',
      slot_duration_minutes: 15,
      max_patients_per_slot: 16,
    },
  },
  {
    account: {
      role: 'doctor',
      name: 'Dr. Kavya Shah',
      email: 'demo.doctor4@medicarepro.local',
      phone: '+919000000004',
      password: DEMO_PASSWORDS.doctor,
    },
    clinic: {
      registration_number: 'DEMO-CLINIC-004',
      name: 'Motion Ortho Care',
      address: '5, Residency Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560025',
      latitude: 12.9658,
      longitude: 77.6044,
      phone: '+919000000004',
      email: 'clinic4@medicarepro.local',
    },
    profile: {
      specialization: 'Orthopedics',
      qualification: 'MBBS, MS Orthopedics',
      medical_license_number: 'MED-KAVYA-4412',
      experience_years: 13,
      consultation_fee: 850,
      bio: 'Orthopedic specialist for sports injuries, joint pain, and fracture follow-up.',
      languages: 'English, Hindi, Gujarati',
    },
    schedule: {
      session_label: 'Evening',
      start_time: '17:00:00',
      end_time: '20:00:00',
      slot_duration_minutes: 20,
      max_patients_per_slot: 12,
    },
  },
  {
    account: {
      role: 'doctor',
      name: 'Dr. Sameer Kulkarni',
      email: 'demo.doctor5@medicarepro.local',
      phone: '+919000000005',
      password: DEMO_PASSWORDS.doctor,
    },
    clinic: {
      registration_number: 'DEMO-CLINIC-005',
      name: 'CarePoint Family Clinic',
      address: '42, Whitefield Main Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560066',
      latitude: 12.9698,
      longitude: 77.7500,
      phone: '+919000000005',
      email: 'clinic5@medicarepro.local',
    },
    profile: {
      specialization: 'General Physician',
      qualification: 'MBBS, MD Internal Medicine',
      medical_license_number: 'MED-SAMEER-5520',
      experience_years: 15,
      consultation_fee: 500,
      bio: 'Family physician for preventive care, diabetes follow-up, and acute illness management.',
      languages: 'English, Hindi, Marathi',
    },
    schedule: {
      session_label: 'Morning',
      start_time: '08:30:00',
      end_time: '12:30:00',
      slot_duration_minutes: 10,
      max_patients_per_slot: 24,
    },
  },
];

const formatDateOffset = (offsetDays) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

const ensureNotification = async (userId, title, message, type, referenceId = null, referenceType = null) => {
  const [existing] = await pool.query(
    `SELECT id
     FROM notifications
     WHERE user_id = ? AND title = ? AND type = ? AND COALESCE(reference_id, 0) = COALESCE(?, 0)
     LIMIT 1`,
    [userId, title, type, referenceId]
  );
  if (existing.length) return existing[0].id;

  const [result] = await pool.query(
    `INSERT INTO notifications (user_id, title, message, type, reference_id, reference_type)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, title, message, type, referenceId, referenceType]
  );
  return result.insertId;
};

const ensureUser = async ({ name, email, phone, password, role }) => {
  const passwordHash = await bcrypt.hash(password, 12);
  const [existing] = await pool.query(
    `SELECT id
     FROM users
     WHERE phone = ? OR email = ?
     LIMIT 1`,
    [phone || null, email || null]
  );

  if (existing.length) {
    const userId = existing[0].id;
    await pool.query(
      `UPDATE users
       SET name = ?,
           email = ?,
           phone = ?,
           password_hash = ?,
           role_id = (SELECT id FROM roles WHERE name = ?),
           is_verified = 1,
           is_phone_verified = 1,
           is_active = 1
       WHERE id = ?`,
      [name, email || null, phone || null, passwordHash, role, userId]
    );
    return userId;
  }

  const [result] = await pool.query(
    `INSERT INTO users (name, email, phone, password_hash, role_id, is_verified, is_phone_verified, is_active)
     VALUES (?, ?, ?, ?, (SELECT id FROM roles WHERE name = ?), 1, 1, 1)`,
    [name, email || null, phone || null, passwordHash, role]
  );

  return result.insertId;
};

const ensureDefaultPlan = async (userId, role) => {
  if (!['doctor', 'patient', 'laboratory', 'pharmacist'].includes(role)) return;
  const plan = await getDefaultPlanForRole(pool, role);
  if (plan) {
    await assignPlanToUser(pool, userId, plan.id);
  }
};

const ensureClinic = async (doctorId) => {
  const registrationNumber = 'DEMO-CLINIC-001';
  const [existing] = await pool.query(
    'SELECT id FROM clinics WHERE registration_number = ? LIMIT 1',
    [registrationNumber]
  );

  if (existing.length) {
    const clinicId = existing[0].id;
    await pool.query(
      `UPDATE clinics
       SET owner_doctor_id = ?, name = ?, address = ?, city = ?, state = ?, pincode = ?, phone = ?, email = ?, is_verified = 1, is_active = 1
       WHERE id = ?`,
      [doctorId, 'Raji Heart Clinic', '12, MG Road', 'Bengaluru', 'Karnataka', '560001', '+919000000001', 'clinic@medicarepro.local', clinicId]
    );
    return clinicId;
  }

  const [result] = await pool.query(
    `INSERT INTO clinics (
       owner_doctor_id, name, registration_number, address, city, state, pincode, latitude, longitude, phone, email, is_verified, is_active
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
    [doctorId, 'Raji Heart Clinic', registrationNumber, '12, MG Road', 'Bengaluru', 'Karnataka', '560001', 12.971599, 77.594566, '+919000000001', 'clinic@medicarepro.local']
  );

  return result.insertId;
};

const ensureDoctorClinic = async (doctorId, clinic) => {
  const [existing] = await pool.query(
    'SELECT id FROM clinics WHERE registration_number = ? LIMIT 1',
    [clinic.registration_number]
  );

  if (existing.length) {
    const clinicId = existing[0].id;
    await pool.query(
      `UPDATE clinics
       SET owner_doctor_id = ?, name = ?, address = ?, city = ?, state = ?, pincode = ?, latitude = ?, longitude = ?, phone = ?, email = ?, is_verified = 1, is_active = 1
       WHERE id = ?`,
      [
        doctorId,
        clinic.name,
        clinic.address,
        clinic.city,
        clinic.state,
        clinic.pincode,
        clinic.latitude,
        clinic.longitude,
        clinic.phone,
        clinic.email,
        clinicId,
      ]
    );
    return clinicId;
  }

  const [result] = await pool.query(
    `INSERT INTO clinics (
       owner_doctor_id, name, registration_number, address, city, state, pincode, latitude, longitude, phone, email, is_verified, is_active
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
    [
      doctorId,
      clinic.name,
      clinic.registration_number,
      clinic.address,
      clinic.city,
      clinic.state,
      clinic.pincode,
      clinic.latitude,
      clinic.longitude,
      clinic.phone,
      clinic.email,
    ]
  );

  return result.insertId;
};

const ensureDoctorProfile = async (userId, clinicId) => {
  const [existing] = await pool.query('SELECT id FROM doctor_profiles WHERE user_id = ? LIMIT 1', [userId]);
  if (existing.length) {
    await pool.query(
      `UPDATE doctor_profiles
       SET clinic_id = ?, specialization = ?, qualification = ?, medical_license_number = ?, experience_years = ?, consultation_fee = ?, bio = ?, languages = ?, is_verified = 1
       WHERE user_id = ?`,
      [clinicId, 'Cardiology', 'MBBS, MD', 'MED-RAJI-1234', 8, 500, 'Senior cardiologist with 8 years of experience.', 'English, Hindi', userId]
    );
    return;
  }

  await pool.query(
    `INSERT INTO doctor_profiles (
       user_id, clinic_id, specialization, qualification, medical_license_number, experience_years, consultation_fee, bio, languages, is_verified
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [userId, clinicId, 'Cardiology', 'MBBS, MD', 'MED-RAJI-1234', 8, 500, 'Senior cardiologist with 8 years of experience.', 'English, Hindi']
  );
};

const ensureDoctorProfileData = async (userId, clinicId, profile) => {
  const [existing] = await pool.query('SELECT id FROM doctor_profiles WHERE user_id = ? LIMIT 1', [userId]);
  const values = [
    clinicId,
    profile.specialization,
    profile.qualification,
    profile.medical_license_number,
    profile.experience_years,
    profile.consultation_fee,
    profile.bio,
    profile.languages,
    userId,
  ];

  if (existing.length) {
    await pool.query(
      `UPDATE doctor_profiles
       SET clinic_id = ?, specialization = ?, qualification = ?, medical_license_number = ?, experience_years = ?, consultation_fee = ?, bio = ?, languages = ?, is_verified = 1
       WHERE user_id = ?`,
      values
    );
    return;
  }

  await pool.query(
    `INSERT INTO doctor_profiles (
       user_id, clinic_id, specialization, qualification, medical_license_number, experience_years, consultation_fee, bio, languages, is_verified
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      userId,
      clinicId,
      profile.specialization,
      profile.qualification,
      profile.medical_license_number,
      profile.experience_years,
      profile.consultation_fee,
      profile.bio,
      profile.languages,
    ]
  );
};

const ensurePatientProfile = async (userId, profile = {}) => {
  const values = {
    date_of_birth: profile.date_of_birth || '1995-06-12',
    gender: profile.gender || 'female',
    blood_group: profile.blood_group || 'O+',
    allergies: profile.allergies || 'None',
  };
  const [existing] = await pool.query('SELECT id FROM patient_profiles WHERE user_id = ? LIMIT 1', [userId]);
  if (existing.length) {
    await pool.query(
      `UPDATE patient_profiles
       SET date_of_birth = ?, gender = ?, blood_group = ?, allergies = ?
       WHERE user_id = ?`,
      [values.date_of_birth, values.gender, values.blood_group, values.allergies, userId]
    );
    return;
  }

  await pool.query(
    `INSERT INTO patient_profiles (user_id, date_of_birth, gender, blood_group, allergies)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, values.date_of_birth, values.gender, values.blood_group, values.allergies]
  );
};

const ensureLabProfile = async (userId) => {
  const [existing] = await pool.query('SELECT id FROM laboratory_profiles WHERE user_id = ? LIMIT 1', [userId]);
  if (existing.length) {
    await pool.query(
      `UPDATE laboratory_profiles
       SET lab_name = ?, registration_number = ?, address = ?, city = ?, state = ?, pincode = ?, latitude = ?, longitude = ?, phone = ?, email = ?, working_hours_start = ?, working_hours_end = ?, working_days = ?, is_verified = 1
       WHERE user_id = ?`,
      ['City Diagnostics', 'LAB-001', '45, Park Street', 'Bengaluru', 'Karnataka', '560001', 12.9711, 77.5940, '+919000000020', 'demo.lab@medicarepro.local', '08:00:00', '20:00:00', 'Mon-Sat', userId]
    );
  } else {
    await pool.query(
      `INSERT INTO laboratory_profiles (
         user_id, lab_name, registration_number, address, city, state, pincode, latitude, longitude, phone, email, working_hours_start, working_hours_end, working_days, is_verified
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [userId, 'City Diagnostics', 'LAB-001', '45, Park Street', 'Bengaluru', 'Karnataka', '560001', 12.9711, 77.5940, '+919000000020', 'demo.lab@medicarepro.local', '08:00:00', '20:00:00', 'Mon-Sat']
    );
  }

  const tests = [
    ['Complete Blood Count', 'CBC', 'General', 'Basic blood health panel', 350, 300, 15, 'No fasting required', 12],
    ['Lipid Profile', 'LIPID', 'Cardiology', 'Cholesterol and triglyceride screening', 900, 750, 17, 'Fasting for 10 hours recommended', 18],
    ['Thyroid Panel', 'THYROID', 'Hormone', 'Thyroid function test panel', 800, 680, 15, 'Morning sample preferred', 24],
  ];

  for (const [testName, testCode, category, description, price, discountedPrice, discountPercentage, prep, turnaroundHours] of tests) {
    const [testExisting] = await pool.query(
      'SELECT id FROM lab_tests WHERE laboratory_id = ? AND test_code = ? LIMIT 1',
      [userId, testCode]
    );
    if (testExisting.length) {
      await pool.query(
        `UPDATE lab_tests
         SET test_name = ?, category = ?, description = ?, price = ?, discounted_price = ?, discount_percentage = ?, preparation_instructions = ?, turnaround_hours = ?, is_active = 1
         WHERE id = ?`,
        [testName, category, description, price, discountedPrice, discountPercentage, prep, turnaroundHours, testExisting[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO lab_tests (
           laboratory_id, test_name, test_code, category, description, price, discounted_price, discount_percentage, preparation_instructions, turnaround_hours
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, testName, testCode, category, description, price, discountedPrice, discountPercentage, prep, turnaroundHours]
      );
    }
  }
};

const ensureMedicineWithStock = async (pharmacistId, medicine) => {
  const [medicineExisting] = await pool.query(
    'SELECT id FROM medicines WHERE pharmacist_id = ? AND name = ? LIMIT 1',
    [pharmacistId, medicine.name]
  );

  let medicineId = medicineExisting[0]?.id;
  if (!medicineId) {
    const [medResult] = await pool.query(
      `INSERT INTO medicines (
         pharmacist_id, name, generic_name, brand_name, manufacturer, composition, category, dosage_form, strength, unit, price, mrp, requires_prescription
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pharmacistId,
        medicine.name,
        medicine.generic_name,
        medicine.brand_name,
        medicine.manufacturer,
        medicine.composition,
        medicine.category,
        medicine.dosage_form,
        medicine.strength,
        medicine.unit,
        medicine.price,
        medicine.mrp,
        medicine.requires_prescription,
      ]
    );
    medicineId = medResult.insertId;
  } else {
    await pool.query(
      `UPDATE medicines
       SET generic_name = ?, brand_name = ?, manufacturer = ?, composition = ?, category = ?, dosage_form = ?, strength = ?, unit = ?, price = ?, mrp = ?, requires_prescription = ?, is_active = 1
       WHERE id = ?`,
      [
        medicine.generic_name,
        medicine.brand_name,
        medicine.manufacturer,
        medicine.composition,
        medicine.category,
        medicine.dosage_form,
        medicine.strength,
        medicine.unit,
        medicine.price,
        medicine.mrp,
        medicine.requires_prescription,
        medicineId,
      ]
    );
  }

  const [stockExisting] = await pool.query('SELECT id FROM medicine_stock WHERE medicine_id = ? LIMIT 1', [medicineId]);
  if (stockExisting.length) {
    await pool.query(
      `UPDATE medicine_stock
       SET quantity = ?, batch_number = ?, expiry_date = ?, purchase_price = ?, low_stock_alert = ?
       WHERE medicine_id = ?`,
      [medicine.quantity, medicine.batch_number, medicine.expiry_date, medicine.purchase_price, medicine.low_stock_alert, medicineId]
    );
  } else {
    await pool.query(
      `INSERT INTO medicine_stock (medicine_id, quantity, batch_number, expiry_date, purchase_price, low_stock_alert)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [medicineId, medicine.quantity, medicine.batch_number, medicine.expiry_date, medicine.purchase_price, medicine.low_stock_alert]
    );
  }

  return medicineId;
};

const ensurePharmacistProfile = async (userId) => {
  const [existing] = await pool.query('SELECT id FROM pharmacist_profiles WHERE user_id = ? LIMIT 1', [userId]);
  if (existing.length) {
    await pool.query(
      `UPDATE pharmacist_profiles
       SET pharmacy_name = ?, license_number = ?, address = ?, city = ?, state = ?, pincode = ?, phone = ?, gstin = ?, is_verified = 1
       WHERE user_id = ?`,
      ['MediCare Pharmacy', 'PHARM-001', '22, Residency Road', 'Bengaluru', 'Karnataka', '560025', '+919000000030', '29ABCDE1234F1Z5', userId]
    );
  } else {
    await pool.query(
      `INSERT INTO pharmacist_profiles (
         user_id, pharmacy_name, license_number, address, city, state, pincode, phone, gstin, is_verified
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [userId, 'MediCare Pharmacy', 'PHARM-001', '22, Residency Road', 'Bengaluru', 'Karnataka', '560025', '+919000000030', '29ABCDE1234F1Z5']
    );
  }

  const medicines = [
    {
      name: 'Paracetamol',
      generic_name: 'Acetaminophen',
      brand_name: 'Dolo 650',
      manufacturer: 'ABC Pharma',
      composition: 'Paracetamol 650mg',
      category: 'Pain Relief',
      dosage_form: 'tablet',
      strength: '650',
      unit: 'mg',
      price: 25,
      mrp: 30,
      requires_prescription: 1,
      quantity: 100,
      batch_number: 'BATCH-001',
      expiry_date: '2027-12-31',
      purchase_price: 18,
      low_stock_alert: 10,
    },
    {
      name: 'Azithromycin',
      generic_name: 'Azithromycin',
      brand_name: 'Azimax 500',
      manufacturer: 'Zen Pharma',
      composition: 'Azithromycin 500mg',
      category: 'Antibiotic',
      dosage_form: 'tablet',
      strength: '500',
      unit: 'mg',
      price: 82,
      mrp: 95,
      requires_prescription: 1,
      quantity: 8,
      batch_number: 'BATCH-LOW-01',
      expiry_date: '2027-10-30',
      purchase_price: 63,
      low_stock_alert: 10,
    },
    {
      name: 'Vitamin D3',
      generic_name: 'Cholecalciferol',
      brand_name: 'CalD3',
      manufacturer: 'Sun Labs',
      composition: 'Vitamin D3 60000 IU',
      category: 'Supplements',
      dosage_form: 'capsule',
      strength: '60000',
      unit: 'IU',
      price: 40,
      mrp: 48,
      requires_prescription: 0,
      quantity: 0,
      batch_number: 'BATCH-OOS-01',
      expiry_date: '2027-08-15',
      purchase_price: 29,
      low_stock_alert: 5,
    },
    {
      name: 'Pantoprazole',
      generic_name: 'Pantoprazole',
      brand_name: 'Pantocid',
      manufacturer: 'HealthPlus',
      composition: 'Pantoprazole 40mg',
      category: 'Gastro',
      dosage_form: 'tablet',
      strength: '40',
      unit: 'mg',
      price: 54,
      mrp: 62,
      requires_prescription: 1,
      quantity: 42,
      batch_number: 'BATCH-REG-02',
      expiry_date: '2028-01-20',
      purchase_price: 37,
      low_stock_alert: 10,
    },
  ];

  for (const medicine of medicines) {
    await ensureMedicineWithStock(userId, medicine);
  }
};

const ensureReceptionistProfile = async (userId, clinicId, doctorId) => {
  const [existing] = await pool.query('SELECT id FROM receptionist_profiles WHERE user_id = ? LIMIT 1', [userId]);
  if (existing.length) {
    await pool.query(
      'UPDATE receptionist_profiles SET clinic_id = ?, doctor_id = ? WHERE user_id = ?',
      [clinicId, doctorId, userId]
    );
    return;
  }

  await pool.query(
    'INSERT INTO receptionist_profiles (user_id, clinic_id, doctor_id) VALUES (?, ?, ?)',
    [userId, clinicId, doctorId]
  );
};

const ensureDoctorSchedule = async (doctorId, clinicId) => {
  const dayOfWeek = new Date().getDay();
  const [existing] = await pool.query(
    `SELECT id
     FROM doctor_schedules
     WHERE doctor_id = ? AND clinic_id = ? AND day_of_week = ? AND session_label = ?
     LIMIT 1`,
    [doctorId, clinicId, dayOfWeek, 'Morning']
  );
  if (!existing.length) {
    await pool.query(
      `INSERT INTO doctor_schedules (
         doctor_id, clinic_id, day_of_week, session_label, start_time, end_time, slot_duration_minutes, max_patients_per_slot
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [doctorId, clinicId, dayOfWeek, 'Morning', '09:00:00', '12:00:00', 10, 30]
    );
  }
};

const ensureDoctorScheduleData = async (doctorId, clinicId, schedule) => {
  const dayOfWeek = new Date().getDay();
  const [existing] = await pool.query(
    `SELECT id
     FROM doctor_schedules
     WHERE doctor_id = ? AND clinic_id = ? AND day_of_week = ? AND session_label = ?
     LIMIT 1`,
    [doctorId, clinicId, dayOfWeek, schedule.session_label]
  );

  if (existing.length) {
    await pool.query(
      `UPDATE doctor_schedules
       SET start_time = ?, end_time = ?, slot_duration_minutes = ?, max_patients_per_slot = ?, is_active = 1
       WHERE id = ?`,
      [schedule.start_time, schedule.end_time, schedule.slot_duration_minutes, schedule.max_patients_per_slot, existing[0].id]
    );
    return existing[0].id;
  }

  const [result] = await pool.query(
    `INSERT INTO doctor_schedules (
       doctor_id, clinic_id, day_of_week, session_label, start_time, end_time, slot_duration_minutes, max_patients_per_slot
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [doctorId, clinicId, dayOfWeek, schedule.session_label, schedule.start_time, schedule.end_time, schedule.slot_duration_minutes, schedule.max_patients_per_slot]
  );
  return result.insertId;
};

const ensureAppointment = async (patientId, doctorId, clinicId, config = {}) => {
  const appointmentDate = config.appointment_date || formatDateOffset(0);
  const appointmentTime = config.appointment_time || '09:00:00';
  const slotNumber = config.slot_number || 1;
  const queueNumber = config.queue_number || slotNumber;
  const status = config.status || 'confirmed';
  const type = config.type || 'scheduled';
  const reasonForVisit = config.reason_for_visit || 'General checkup';
  const bookedBy = config.booked_by || 'patient';
  const bookedByUserId = config.booked_by_user_id || patientId;
  const priorityLevel = config.priority_level || 'normal';
  const notes = config.notes || null;
  const [existing] = await pool.query(
    `SELECT id
     FROM appointments
     WHERE patient_id = ? AND doctor_id = ? AND clinic_id = ? AND appointment_date = ? AND appointment_time = ?
     LIMIT 1`,
    [patientId, doctorId, clinicId, appointmentDate, appointmentTime]
  );

  if (existing.length) {
    await pool.query(
      `UPDATE appointments
       SET slot_number = ?, queue_number = ?, status = ?, type = ?, reason_for_visit = ?, booked_by = ?, booked_by_user_id = ?, priority_level = ?, notes = ?
       WHERE id = ?`,
      [slotNumber, queueNumber, status, type, reasonForVisit, bookedBy, bookedByUserId, priorityLevel, notes, existing[0].id]
    );
    return existing[0].id;
  }

  const [result] = await pool.query(
    `INSERT INTO appointments (
       patient_id, doctor_id, clinic_id, appointment_date, appointment_time, slot_number, queue_number, priority_level, status, type, reason_for_visit, notes, booked_by, booked_by_user_id
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [patientId, doctorId, clinicId, appointmentDate, appointmentTime, slotNumber, queueNumber, priorityLevel, status, type, reasonForVisit, notes, bookedBy, bookedByUserId]
  );
  return result.insertId;
};

const ensureLabOrder = async ({
  appointmentId = null,
  doctorId,
  patientId,
  laboratoryId,
  status = 'pending',
  totalAmount = 0,
  noteKey,
  testIds = [],
}) => {
  const [existing] = await pool.query(
    `SELECT id
     FROM lab_orders
     WHERE doctor_id = ? AND patient_id = ? AND laboratory_id = ? AND notes = ?
     LIMIT 1`,
    [doctorId, patientId, laboratoryId, noteKey]
  );

  let orderId = existing[0]?.id;
  if (!orderId) {
    const [result] = await pool.query(
      `INSERT INTO lab_orders (
         appointment_id, doctor_id, patient_id, laboratory_id, order_type, status, total_amount, payment_status, notes
       )
       VALUES (?, ?, ?, ?, 'assigned', ?, ?, 'paid', ?)`,
      [appointmentId, doctorId, patientId, laboratoryId, status, totalAmount, noteKey]
    );
    orderId = result.insertId;
  } else {
    await pool.query(
      `UPDATE lab_orders
       SET appointment_id = ?, status = ?, total_amount = ?, payment_status = 'paid'
       WHERE id = ?`,
      [appointmentId, status, totalAmount, orderId]
    );
  }

  if (testIds.length) {
    for (const testId of testIds) {
      const [testExisting] = await pool.query(
        'SELECT id FROM lab_order_tests WHERE lab_order_id = ? AND test_id = ? LIMIT 1',
        [orderId, testId]
      );
      if (!testExisting.length) {
        await pool.query(
          'INSERT INTO lab_order_tests (lab_order_id, test_id, is_completed) VALUES (?, ?, ?)',
          [orderId, testId, status === 'completed' ? 1 : 0]
        );
      } else {
        await pool.query(
          'UPDATE lab_order_tests SET is_completed = ? WHERE id = ?',
          [status === 'completed' ? 1 : 0, testExisting[0].id]
        );
      }
    }
  }

  return orderId;
};

const ensurePrescription = async ({
  appointmentId,
  doctorId,
  patientId,
  pharmacistId,
  diagnosis,
  notes,
  followUpDate,
  isDispensed = false,
  medicines = [],
}) => {
  const [existing] = await pool.query(
    'SELECT id FROM prescriptions WHERE appointment_id = ? LIMIT 1',
    [appointmentId]
  );

  let prescriptionId = existing[0]?.id;
  if (!prescriptionId) {
    const [result] = await pool.query(
      `INSERT INTO prescriptions (
         appointment_id, doctor_id, patient_id, pharmacist_id, diagnosis, notes, follow_up_date, is_dispensed
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [appointmentId, doctorId, patientId, pharmacistId, diagnosis, notes, followUpDate, isDispensed ? 1 : 0]
    );
    prescriptionId = result.insertId;
  } else {
    await pool.query(
      `UPDATE prescriptions
       SET pharmacist_id = ?, diagnosis = ?, notes = ?, follow_up_date = ?, is_dispensed = ?
       WHERE id = ?`,
      [pharmacistId, diagnosis, notes, followUpDate, isDispensed ? 1 : 0, prescriptionId]
    );
  }

  for (const medicine of medicines) {
    const [medExisting] = await pool.query(
      `SELECT id
       FROM prescription_medicines
       WHERE prescription_id = ? AND medicine_name = ?
       LIMIT 1`,
      [prescriptionId, medicine.medicine_name]
    );
    if (medExisting.length) continue;

    await pool.query(
      `INSERT INTO prescription_medicines (
         prescription_id, medicine_id, medicine_name, dosage, frequency, morning, afternoon, evening, before_food, duration_days, quantity, instructions
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        prescriptionId,
        medicine.medicine_id || null,
        medicine.medicine_name,
        medicine.dosage,
        medicine.frequency,
        medicine.morning || 0,
        medicine.afternoon || 0,
        medicine.evening || 0,
        medicine.before_food ? 1 : 0,
        medicine.duration_days,
        medicine.quantity,
        medicine.instructions || null,
      ]
    );
  }

  return prescriptionId;
};

const ensureRichDemoData = async ({
  adminId,
  demoAdminId,
  doctorId,
  patientId,
  supportPatientIds,
  labId,
  pharmacistId,
  receptionistId,
  clinicId,
}) => {
  const [labTests] = await pool.query(
    'SELECT id, test_code, price, discounted_price FROM lab_tests WHERE laboratory_id = ? ORDER BY id ASC',
    [labId]
  );
  const testByCode = Object.fromEntries(labTests.map((row) => [row.test_code, row]));

  const appointments = {
    todayConfirmed: await ensureAppointment(patientId, doctorId, clinicId, {
      appointment_date: formatDateOffset(0),
      appointment_time: '09:00:00',
      slot_number: 1,
      queue_number: 1,
      status: 'confirmed',
      reason_for_visit: 'Follow-up cardiac consultation',
      notes: 'Demo dashboard appointment',
    }),
    todayCheckedIn: await ensureAppointment(supportPatientIds[0], doctorId, clinicId, {
      appointment_date: formatDateOffset(0),
      appointment_time: '09:20:00',
      slot_number: 2,
      queue_number: 2,
      status: 'checked_in',
      reason_for_visit: 'Chest pain screening',
      booked_by: 'receptionist',
      booked_by_user_id: receptionistId,
      notes: 'Demo dashboard checked-in visit',
    }),
    todayCompleted: await ensureAppointment(supportPatientIds[1], doctorId, clinicId, {
      appointment_date: formatDateOffset(0),
      appointment_time: '09:40:00',
      slot_number: 3,
      queue_number: 3,
      status: 'completed',
      reason_for_visit: 'Blood pressure review',
      notes: 'Demo dashboard completed visit',
    }),
    tomorrowUpcoming: await ensureAppointment(patientId, doctorId, clinicId, {
      appointment_date: formatDateOffset(1),
      appointment_time: '10:15:00',
      slot_number: 1,
      queue_number: 1,
      status: 'confirmed',
      reason_for_visit: 'Video review for lab results',
      notes: 'Demo upcoming appointment',
    }),
    tomorrowPending: await ensureAppointment(supportPatientIds[0], doctorId, clinicId, {
      appointment_date: formatDateOffset(1),
      appointment_time: '10:40:00',
      slot_number: 2,
      queue_number: 2,
      status: 'pending',
      reason_for_visit: 'New patient consultation',
      notes: 'Demo pending appointment',
    }),
    yesterdayCompleted: await ensureAppointment(patientId, doctorId, clinicId, {
      appointment_date: formatDateOffset(-1),
      appointment_time: '11:00:00',
      slot_number: 4,
      queue_number: 4,
      status: 'completed',
      reason_for_visit: 'Routine cardiac wellness review',
      notes: 'Demo historical completed appointment',
    }),
  };

  const pendingLabAmount = [testByCode.CBC, testByCode.LIPID]
    .filter(Boolean)
    .reduce((sum, test) => sum + Number(test.discounted_price ?? test.price ?? 0), 0);
  const completedLabAmount = [testByCode.THYROID]
    .filter(Boolean)
    .reduce((sum, test) => sum + Number(test.discounted_price ?? test.price ?? 0), 0);

  const pendingLabOrderId = await ensureLabOrder({
    appointmentId: appointments.todayConfirmed,
    doctorId,
    patientId,
    laboratoryId: labId,
    status: 'pending',
    totalAmount: pendingLabAmount,
    noteKey: 'DEMO-LAB-PENDING',
    testIds: [testByCode.CBC?.id, testByCode.LIPID?.id].filter(Boolean),
  });
  const acceptedLabOrderId = await ensureLabOrder({
    appointmentId: appointments.todayCheckedIn,
    doctorId,
    patientId: supportPatientIds[0],
    laboratoryId: labId,
    status: 'accepted',
    totalAmount: pendingLabAmount,
    noteKey: 'DEMO-LAB-ACCEPTED',
    testIds: [testByCode.CBC?.id, testByCode.LIPID?.id].filter(Boolean),
  });
  const completedLabOrderId = await ensureLabOrder({
    appointmentId: appointments.yesterdayCompleted,
    doctorId,
    patientId,
    laboratoryId: labId,
    status: 'completed',
    totalAmount: completedLabAmount,
    noteKey: 'DEMO-LAB-COMPLETED',
    testIds: [testByCode.THYROID?.id].filter(Boolean),
  });

  const [pharmacyMeds] = await pool.query(
    'SELECT id, name FROM medicines WHERE pharmacist_id = ?',
    [pharmacistId]
  );
  const pharmacyMedMap = Object.fromEntries(pharmacyMeds.map((row) => [row.name, row.id]));

  const mainPrescriptionId = await ensurePrescription({
    appointmentId: appointments.yesterdayCompleted,
    doctorId,
    patientId,
    pharmacistId,
    diagnosis: 'Borderline hypertension with mild acidity',
    notes: 'Continue medication and review after one week.',
    followUpDate: formatDateOffset(7),
    medicines: [
      {
        medicine_id: pharmacyMedMap.Pantoprazole || null,
        medicine_name: 'Pantoprazole',
        dosage: '40 mg',
        frequency: '1-0-0',
        morning: 1,
        duration_days: 10,
        quantity: 10,
        instructions: 'Before breakfast',
      },
      {
        medicine_id: pharmacyMedMap.Paracetamol || null,
        medicine_name: 'Paracetamol',
        dosage: '650 mg',
        frequency: '1-0-1',
        morning: 1,
        evening: 1,
        duration_days: 5,
        quantity: 10,
        instructions: 'After food if headache or body pain persists',
      },
    ],
  });

  const supportPrescriptionId = await ensurePrescription({
    appointmentId: appointments.todayCompleted,
    doctorId,
    patientId: supportPatientIds[1],
    pharmacistId,
    diagnosis: 'Seasonal infection',
    notes: 'Finish antibiotic course and hydrate well.',
    followUpDate: formatDateOffset(5),
    medicines: [
      {
        medicine_id: pharmacyMedMap.Azithromycin || null,
        medicine_name: 'Azithromycin',
        dosage: '500 mg',
        frequency: '1-0-0',
        morning: 1,
        duration_days: 3,
        quantity: 3,
        instructions: 'After lunch',
      },
    ],
  });

  await ensureNotification(adminId, 'Platform Demo Snapshot Ready', 'The seeded demo environment has rich records across appointments, labs, prescriptions, and stock.', 'system');
  await ensureNotification(demoAdminId, 'Read-only Review Workspace', 'Explore dashboards, users, clinics, reports, and content with refreshed demo data.', 'system');
  await ensureNotification(doctorId, 'Today\'s Clinic Queue', 'You have confirmed, checked-in, and completed appointments ready for review.', 'appointment', appointments.todayConfirmed, 'appointment');
  await ensureNotification(doctorId, 'Pending Lab Follow-ups', 'Two active lab orders are available on your dashboard.', 'lab_order', pendingLabOrderId, 'lab_order');
  await ensureNotification(patientId, 'Next Visit Scheduled', 'Your follow-up appointment is confirmed for tomorrow morning.', 'appointment', appointments.tomorrowUpcoming, 'appointment');
  await ensureNotification(patientId, 'Lab Report Updated', 'A completed thyroid panel is now visible in your recent lab orders.', 'lab_order', completedLabOrderId, 'lab_order');
  await ensureNotification(labId, 'Incoming Test Queue', 'New pending and accepted lab orders were added for demo review.', 'lab_order', acceptedLabOrderId, 'lab_order');
  await ensureNotification(pharmacistId, 'Prescription Pickup Queue', 'Two prescriptions are waiting in the pharmacy workflow.', 'prescription', supportPrescriptionId, 'prescription');
  await ensureNotification(pharmacistId, 'Stock Alert', 'Vitamin D3 is out of stock and Azithromycin is below threshold.', 'stock_alert');
  await ensureNotification(receptionistId, 'Front Desk Queue Ready', 'Today\'s appointment board includes pending, checked-in, and completed visits.', 'appointment', appointments.todayCheckedIn, 'appointment');
  await ensureNotification(supportPatientIds[0], 'Lab Sample Assigned', 'Your doctor assigned new tests to City Diagnostics.', 'lab_order', acceptedLabOrderId, 'lab_order');
  await ensureNotification(supportPatientIds[1], 'Prescription Ready', 'Your doctor prepared a prescription after today\'s consultation.', 'prescription', supportPrescriptionId, 'prescription');

  return {
    appointmentIds: appointments,
    pendingLabOrderId,
    completedLabOrderId,
    mainPrescriptionId,
    supportPrescriptionId,
  };
};

const ensureDemoAccounts = async (logger = console) => {
  const adminId = await ensureUser(DEMO_ACCOUNTS.admin);
  const demoAdminId = await ensureUser(DEMO_ACCOUNTS.demoAdmin);
  const doctorId = await ensureUser(DEMO_ACCOUNTS.doctor);
  const patientId = await ensureUser(DEMO_ACCOUNTS.patient);
  const labId = await ensureUser(DEMO_ACCOUNTS.laboratory);
  const pharmacistId = await ensureUser(DEMO_ACCOUNTS.pharmacist);
  const receptionistId = await ensureUser(DEMO_ACCOUNTS.receptionist);
  const supportPatientIds = [];
  const supportDoctorIds = [];

  for (const supportPatient of DEMO_SUPPORT_PATIENTS) {
    const supportPatientId = await ensureUser(supportPatient);
    supportPatientIds.push(supportPatientId);
    await ensurePatientProfile(supportPatientId, supportPatient.profile);
  }

  await ensureDefaultPlan(doctorId, 'doctor');
  await ensureDefaultPlan(patientId, 'patient');
  await ensureDefaultPlan(labId, 'laboratory');
  await ensureDefaultPlan(pharmacistId, 'pharmacist');

  const clinicId = await ensureClinic(doctorId);
  await ensureDoctorProfile(doctorId, clinicId);
  await ensurePatientProfile(patientId);
  await ensureLabProfile(labId);
  await ensurePharmacistProfile(pharmacistId);
  await ensureReceptionistProfile(receptionistId, clinicId, doctorId);
  await ensureDoctorSchedule(doctorId, clinicId);
  await ensureAppointment(patientId, doctorId, clinicId);

  for (const demoDoctor of DEMO_SUPPORT_DOCTORS) {
    const supportDoctorId = await ensureUser(demoDoctor.account);
    supportDoctorIds.push(supportDoctorId);
    await ensureDefaultPlan(supportDoctorId, 'doctor');
    const supportClinicId = await ensureDoctorClinic(supportDoctorId, demoDoctor.clinic);
    await ensureDoctorProfileData(supportDoctorId, supportClinicId, demoDoctor.profile);
    await ensureDoctorScheduleData(supportDoctorId, supportClinicId, demoDoctor.schedule);
  }

  await ensureRichDemoData({
    adminId,
    demoAdminId,
    doctorId,
    patientId,
    supportPatientIds,
    supportDoctorIds,
    labId,
    pharmacistId,
    receptionistId,
    clinicId,
  });

  logger.log('\nDemo accounts are ready for live review:');
  logger.log(`   Demo Admin: ${DEMO_ACCOUNTS.demoAdmin.phone} / ${DEMO_ACCOUNTS.demoAdmin.password}`);
  logger.log(`   Real Admin: ${DEMO_ACCOUNTS.admin.phone} / ${DEMO_ACCOUNTS.admin.password}`);
  logger.log(`   Doctor: ${DEMO_ACCOUNTS.doctor.phone} / ${DEMO_ACCOUNTS.doctor.password}`);
  logger.log(`   Patient: ${DEMO_ACCOUNTS.patient.phone} / ${DEMO_ACCOUNTS.patient.password}`);
  logger.log(`   Lab: ${DEMO_ACCOUNTS.laboratory.phone} / ${DEMO_ACCOUNTS.laboratory.password}`);
  logger.log(`   Pharmacy: ${DEMO_ACCOUNTS.pharmacist.phone} / ${DEMO_ACCOUNTS.pharmacist.password}`);
  logger.log(`   Receptionist: ${DEMO_ACCOUNTS.receptionist.phone} / ${DEMO_ACCOUNTS.receptionist.password}`);

  return {
    adminId,
    demoAdminId,
    doctorId,
    patientId,
    supportPatientIds,
    supportDoctorIds,
    labId,
    pharmacistId,
    receptionistId,
    clinicId,
  };
};

if (require.main === module) {
  ensureDemoAccounts()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Failed to prepare demo accounts:', err.message);
      process.exit(1);
    });
}

module.exports = {
  DEMO_ACCOUNTS,
  ensureDemoAccounts,
};
