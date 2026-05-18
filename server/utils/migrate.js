const { pool } = require('../config/database');
const { ensureDemoAccounts } = require('./demoAccounts');
require('dotenv').config();

const migrations = [
  // ============ USERS & ROLES ============
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    role ENUM('admin','doctor','patient','laboratory','pharmacist','receptionist') NOT NULL,
    profile_image VARCHAR(500),
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_phone_verified BOOLEAN DEFAULT FALSE,
    subscription_plan ENUM('free','basic','premium','enterprise') DEFAULT 'free',
    subscription_expires_at DATETIME,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  // Allow email-only registration (phone can be null)
  `ALTER TABLE users MODIFY phone VARCHAR(20) UNIQUE`,

  // ============ ROLES & PERMISSIONS ============
  `CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_system BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
  )`,

  // ============ ORG ROLES (PER-CLINIC/LAB/PHARMACY) ============
  `CREATE TABLE IF NOT EXISTS org_roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    org_type ENUM('clinic','laboratory','pharmacy') NOT NULL,
    org_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    created_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_org_role (org_type, org_id, name),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS org_role_permissions (
    org_role_id INT NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (org_role_id, permission_id),
    FOREIGN KEY (org_role_id) REFERENCES org_roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS org_user_roles (
    user_id INT NOT NULL,
    org_role_id INT NOT NULL,
    PRIMARY KEY (user_id, org_role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (org_role_id) REFERENCES org_roles(id) ON DELETE CASCADE
  )`,

  `INSERT IGNORE INTO roles (name, description, is_system) VALUES
    ('admin', 'System administrator', 1),
    ('doctor', 'Doctor', 1),
    ('patient', 'Patient', 1),
    ('laboratory', 'Laboratory', 1),
    ('pharmacist', 'Pharmacist', 1),
    ('receptionist', 'Receptionist', 1)`,

    `INSERT IGNORE INTO permissions (code, description) VALUES
      ('admin.dashboard.view', 'View admin dashboard'),
      ('admin.users.view', 'View users list'),
      ('admin.users.verify', 'Verify users'),
      ('admin.users.toggle', 'Activate or deactivate users'),
      ('admin.clinics.view', 'View clinics list'),
      ('admin.clinics.verify', 'Verify clinics'),
      ('admin.audit.view', 'View audit logs'),
      ('admin.reports.view', 'View reports'),
      ('admin.pending.view', 'View pending verifications'),
      ('admin.messages.view', 'View contact messages'),
      ('admin.messages.reply', 'Reply to contact messages'),
      ('admin.plans.manage', 'Manage subscription plans'),
      ('admin.announcements.manage', 'Manage announcements'),
      ('admin.departments.manage', 'Manage departments'),

    ('doctor.profile.edit', 'Edit doctor profile'),
    ('doctor.schedule.manage', 'Manage doctor schedule'),
    ('doctor.appointments.view', 'View doctor appointments'),
    ('doctor.appointments.manage', 'Update appointment status'),
    ('doctor.prescriptions.manage', 'Create prescriptions'),
    ('doctor.clinics.manage', 'Manage clinics'),
    ('doctor.patients.view', 'View patient details'),

    ('patient.profile.edit', 'Edit patient profile'),
    ('patient.appointments.book', 'Book appointments'),
    ('patient.appointments.view', 'View appointments'),

    ('lab.profile.edit', 'Edit lab profile'),
    ('lab.tests.manage', 'Manage lab tests'),
    ('lab.orders.manage', 'Manage lab orders'),
    ('lab.reports.manage', 'Upload lab reports'),

    ('pharmacy.profile.edit', 'Edit pharmacy profile'),
    ('pharmacy.medicines.manage', 'Manage medicines'),
    ('pharmacy.stock.manage', 'Manage stock'),

    ('receptionist.appointments.manage', 'Manage clinic appointments'),
    ('receptionist.patients.checkin', 'Check-in patients')`,

  `INSERT IGNORE INTO role_permissions (role_id, permission_id)
   SELECT r.id, p.id FROM roles r JOIN permissions p
   WHERE r.name = 'admin' AND p.code IN (
     'admin.dashboard.view','admin.users.view','admin.users.verify','admin.users.toggle','admin.clinics.view',
     'admin.clinics.verify','admin.audit.view','admin.reports.view','admin.pending.view','admin.messages.view',
       'admin.messages.reply','admin.plans.manage','admin.announcements.manage','admin.departments.manage',
     'doctor.profile.edit','doctor.schedule.manage','doctor.appointments.view','doctor.appointments.manage',
     'doctor.prescriptions.manage','doctor.clinics.manage','doctor.patients.view',
     'patient.profile.edit','patient.appointments.book','patient.appointments.view',
     'lab.profile.edit','lab.tests.manage','lab.orders.manage','lab.reports.manage',
     'pharmacy.profile.edit','pharmacy.medicines.manage','pharmacy.stock.manage',
     'receptionist.appointments.manage','receptionist.patients.checkin'
   )`,

  `INSERT IGNORE INTO role_permissions (role_id, permission_id)
   SELECT r.id, p.id FROM roles r JOIN permissions p
   WHERE r.name = 'doctor' AND p.code IN (
     'doctor.profile.edit','doctor.schedule.manage','doctor.appointments.view',
     'doctor.appointments.manage','doctor.prescriptions.manage','doctor.clinics.manage','doctor.patients.view'
   )`,

  `INSERT IGNORE INTO role_permissions (role_id, permission_id)
   SELECT r.id, p.id FROM roles r JOIN permissions p
   WHERE r.name = 'patient' AND p.code IN (
     'patient.profile.edit','patient.appointments.book','patient.appointments.view'
   )`,

  `INSERT IGNORE INTO role_permissions (role_id, permission_id)
   SELECT r.id, p.id FROM roles r JOIN permissions p
   WHERE r.name = 'laboratory' AND p.code IN (
     'lab.profile.edit','lab.tests.manage','lab.orders.manage','lab.reports.manage'
   )`,

  `INSERT IGNORE INTO role_permissions (role_id, permission_id)
   SELECT r.id, p.id FROM roles r JOIN permissions p
   WHERE r.name = 'pharmacist' AND p.code IN (
     'pharmacy.profile.edit','pharmacy.medicines.manage','pharmacy.stock.manage'
   )`,

  `INSERT IGNORE INTO role_permissions (role_id, permission_id)
   SELECT r.id, p.id FROM roles r JOIN permissions p
   WHERE r.name = 'receptionist' AND p.code IN (
     'receptionist.appointments.manage','receptionist.patients.checkin'
   )`,

  // ============ OTP VERIFICATION ============
  `CREATE TABLE IF NOT EXISTS otp_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    purpose ENUM('registration','login','reset_password') NOT NULL,
    expires_at DATETIME NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // ============ CLINICS ============
  `CREATE TABLE IF NOT EXISTS clinics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE DEFAULT (UUID()),
    owner_doctor_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    registration_number VARCHAR(100),
    certificate_path VARCHAR(500),
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    phone VARCHAR(20),
    email VARCHAR(255),
    logo VARCHAR(500),
    description TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    admin_remarks TEXT,
    verified_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_doctor_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  // ============ DOCTOR PROFILES ============
  `CREATE TABLE IF NOT EXISTS doctor_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    clinic_id INT,
    specialization VARCHAR(255) NOT NULL,
    qualification VARCHAR(500) NOT NULL,
    medical_license_number VARCHAR(100) NOT NULL,
    license_certificate_path VARCHAR(500),
    experience_years INT DEFAULT 0,
    consultation_fee DECIMAL(10,2) DEFAULT 0,
    bio TEXT,
    languages VARCHAR(500),
    is_guest_doctor BOOLEAN DEFAULT FALSE,
    main_doctor_id INT,
    is_verified BOOLEAN DEFAULT FALSE,
    admin_remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE SET NULL,
    FOREIGN KEY (main_doctor_id) REFERENCES users(id) ON DELETE SET NULL
  )`,

  // ============ DOCTOR SCHEDULES ============
    `CREATE TABLE IF NOT EXISTS doctor_schedules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      doctor_id INT NOT NULL,
      clinic_id INT NOT NULL,
      override_date DATE NULL,
      day_of_week TINYINT NOT NULL COMMENT '0=Sunday,1=Monday,...,6=Saturday',
      session_label VARCHAR(50) NOT NULL DEFAULT 'Session',
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
    slot_duration_minutes INT DEFAULT 15,
    max_patients_per_slot INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
  )`,

  // ============ DOCTOR LEAVES ============
  `CREATE TABLE IF NOT EXISTS doctor_leaves (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id INT NOT NULL,
    clinic_id INT,
    leave_date DATE NOT NULL,
    leave_type ENUM('full_day','morning','evening') DEFAULT 'full_day',
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  // ============ PATIENT PROFILES ============
  `CREATE TABLE IF NOT EXISTS patient_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    date_of_birth DATE,
    gender ENUM('male','female','other'),
    blood_group VARCHAR(5),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    allergies TEXT,
    chronic_conditions TEXT,
    insurance_provider VARCHAR(255),
    insurance_number VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  // ============ APPOINTMENTS ============
  `CREATE TABLE IF NOT EXISTS appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE DEFAULT (UUID()),
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    clinic_id INT NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    slot_number INT NOT NULL,
    queue_number INT,
    session_id INT,
    priority_level ENUM('normal','priority') DEFAULT 'normal',
    status ENUM('pending','confirmed','checked_in','in_consultation','completed','cancelled','no_show') DEFAULT 'pending',
    type ENUM('scheduled','walk_in') DEFAULT 'scheduled',
    reason_for_visit TEXT,
    notes TEXT,
    checked_in_at DATETIME,
    checked_out_at DATETIME,
    consultation_fee DECIMAL(10,2),
    is_paid BOOLEAN DEFAULT FALSE,
    payment_mode ENUM('cash','online','insurance'),
    consultation_mode ENUM('in_person','video') DEFAULT 'in_person',
    video_provider VARCHAR(50),
    video_meeting_url VARCHAR(500),
    video_host_url VARCHAR(500),
    booked_by ENUM('patient','receptionist','doctor') DEFAULT 'patient',
    booked_by_user_id INT,
    cancelled_by INT,
    cancellation_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES users(id),
    FOREIGN KEY (doctor_id) REFERENCES users(id),
    FOREIGN KEY (clinic_id) REFERENCES clinics(id)
  )`,

  `SELECT 1`,

  // ============ PRESCRIPTIONS ============
  `CREATE TABLE IF NOT EXISTS prescriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE DEFAULT (UUID()),
    appointment_id INT NOT NULL,
    doctor_id INT NOT NULL,
    patient_id INT NOT NULL,
    pharmacist_id INT,
    diagnosis TEXT,
    notes TEXT,
    follow_up_date DATE,
    is_dispensed BOOLEAN DEFAULT FALSE,
    dispensed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id),
    FOREIGN KEY (doctor_id) REFERENCES users(id),
    FOREIGN KEY (patient_id) REFERENCES users(id)
  )`,

  // ============ PRESCRIPTION MEDICINES ============
  `CREATE TABLE IF NOT EXISTS prescription_medicines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prescription_id INT NOT NULL,
    medicine_id INT,
    medicine_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100),
    frequency VARCHAR(50) COMMENT '1-0-1, 1-1-1, etc',
    morning TINYINT(1) DEFAULT 0,
    afternoon TINYINT(1) DEFAULT 0,
    evening TINYINT(1) DEFAULT 0,
    before_food BOOLEAN DEFAULT FALSE,
    duration_days INT,
    quantity INT,
    instructions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE
  )`,

  // ============ LABORATORY PROFILES ============
  `CREATE TABLE IF NOT EXISTS laboratory_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    lab_name VARCHAR(255) NOT NULL,
    registration_number VARCHAR(100),
    certificate_path VARCHAR(500),
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    phone VARCHAR(20),
    email VARCHAR(255),
    logo VARCHAR(500),
    working_hours_start TIME,
    working_hours_end TIME,
    working_days VARCHAR(100),
    is_verified BOOLEAN DEFAULT FALSE,
    admin_remarks TEXT,
    verified_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  // ============ LAB DEPARTMENTS ============
  `CREATE TABLE IF NOT EXISTS lab_departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lab_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_lab_dept (lab_id, name),
    FOREIGN KEY (lab_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS lab_staff_departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staff_user_id INT NOT NULL,
    lab_id INT NOT NULL,
    department_id INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_staff_dept (staff_user_id, department_id),
    FOREIGN KEY (staff_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (lab_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES lab_departments(id) ON DELETE CASCADE
  )`,

  // ============ LAB TESTS ============
  `CREATE TABLE IF NOT EXISTS lab_tests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    laboratory_id INT NOT NULL,
    lab_department_id INT,
    test_name VARCHAR(255) NOT NULL,
    test_code VARCHAR(50),
    category VARCHAR(100),
    description TEXT,
    normal_range VARCHAR(255),
    price DECIMAL(10,2) NOT NULL,
    discounted_price DECIMAL(10,2),
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    preparation_instructions TEXT,
    turnaround_hours INT DEFAULT 24,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (laboratory_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (lab_department_id) REFERENCES lab_departments(id) ON DELETE SET NULL
  )`,

  // ============ LAB TEST PACKAGES ============
  `CREATE TABLE IF NOT EXISTS lab_test_packages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    laboratory_id INT NOT NULL,
    package_name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    discounted_price DECIMAL(10,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (laboratory_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS lab_package_tests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    package_id INT NOT NULL,
    test_id INT NOT NULL,
    FOREIGN KEY (package_id) REFERENCES lab_test_packages(id) ON DELETE CASCADE,
    FOREIGN KEY (test_id) REFERENCES lab_tests(id) ON DELETE CASCADE
  )`,

  // ============ LAB ORDERS ============
  `CREATE TABLE IF NOT EXISTS lab_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE DEFAULT (UUID()),
    appointment_id INT,
    doctor_id INT NOT NULL,
    patient_id INT NOT NULL,
    laboratory_id INT,
    order_type ENUM('assigned','manual') DEFAULT 'assigned',
    manual_tests TEXT COMMENT 'JSON for manually typed tests',
    status ENUM('pending','accepted','sample_collected','processing','completed','cancelled') DEFAULT 'pending',
    total_amount DECIMAL(10,2),
    payment_status ENUM('pending','paid','direct') DEFAULT 'pending',
    payment_mode ENUM('online','direct_lab'),
    sample_collected_at DATETIME,
    collection_required TINYINT(1) DEFAULT 0,
    collection_date DATE,
    collection_time VARCHAR(10),
    collection_address TEXT,
    collection_notes TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id),
    FOREIGN KEY (doctor_id) REFERENCES users(id),
    FOREIGN KEY (patient_id) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS lab_order_tests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lab_order_id INT NOT NULL,
    test_id INT NOT NULL,
    is_completed TINYINT(1) DEFAULT 0,
    price DECIMAL(10,2),
    FOREIGN KEY (lab_order_id) REFERENCES lab_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (test_id) REFERENCES lab_tests(id) ON DELETE CASCADE
  )`,

  // ============ LAB REPORTS ============
  `CREATE TABLE IF NOT EXISTS lab_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE DEFAULT (UUID()),
    lab_order_id INT NOT NULL,
    test_id INT,
    report_title VARCHAR(255),
    report_file_path VARCHAR(500) NOT NULL,
    remarks TEXT,
    result_value VARCHAR(50),
    result_unit VARCHAR(20),
    result_flag ENUM('normal','abnormal','high','low'),
    normal_range_snapshot VARCHAR(255),
    uploaded_by INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lab_order_id) REFERENCES lab_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS lab_report_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lab_report_id INT NOT NULL,
    test_id INT,
    result_name VARCHAR(255) NOT NULL,
    result_value VARCHAR(50),
    result_unit VARCHAR(20),
    normal_range VARCHAR(255),
    result_flag ENUM('normal','abnormal','high','low'),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lab_report_id) REFERENCES lab_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (test_id) REFERENCES lab_tests(id) ON DELETE SET NULL
  )`,

  // ============ PHARMACIST PROFILES ============
  `CREATE TABLE IF NOT EXISTS pharmacist_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    pharmacy_name VARCHAR(255) NOT NULL,
    license_number VARCHAR(100) NOT NULL,
    license_certificate_path VARCHAR(500),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    phone VARCHAR(20),
    gstin VARCHAR(20),
    is_verified BOOLEAN DEFAULT FALSE,
    admin_remarks TEXT,
    verified_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  // ============ MEDICINES ============
  `CREATE TABLE IF NOT EXISTS medicines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pharmacist_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255),
    brand_name VARCHAR(255),
    manufacturer VARCHAR(255),
    composition VARCHAR(500),
    category VARCHAR(100),
    dosage_form ENUM('tablet','capsule','syrup','injection','cream','drops','inhaler','patch','other') DEFAULT 'tablet',
    strength VARCHAR(100),
    unit VARCHAR(50),
    price DECIMAL(10,2) NOT NULL,
    mrp DECIMAL(10,2),
    requires_prescription BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (pharmacist_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  // ============ MEDICINE STOCK ============
  `CREATE TABLE IF NOT EXISTS medicine_stock (
    id INT AUTO_INCREMENT PRIMARY KEY,
    medicine_id INT NOT NULL,
    batch_number VARCHAR(100),
    quantity INT NOT NULL DEFAULT 0,
    low_stock_alert INT DEFAULT 10,
    expiry_date DATE,
    purchase_price DECIMAL(10,2),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
  )`,

  // ============ STOCK MOVEMENTS ============
  `CREATE TABLE IF NOT EXISTS stock_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    medicine_id INT NOT NULL,
    movement_type ENUM('in','out','adjustment','expired') NOT NULL,
    quantity INT NOT NULL,
    reference_id INT COMMENT 'prescription_id or purchase_order_id',
    reference_type VARCHAR(50),
    notes TEXT,
    created_by INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medicine_id) REFERENCES medicines(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`,

  // ============ RECEPTIONIST PROFILES ============
  `CREATE TABLE IF NOT EXISTS receptionist_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    clinic_id INT NOT NULL,
    doctor_id INT NOT NULL COMMENT 'assigned main doctor',
    employee_id VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  // ============ NOTIFICATIONS ============
  `CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('appointment','lab_order','prescription','stock_alert','system','payment','verification') NOT NULL,
    reference_id INT,
    reference_type VARCHAR(50),
    is_read BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  // ============ SYSTEM ANNOUNCEMENTS ============
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
  )`,

  // ============ PATIENT VITALS ============
  `CREATE TABLE IF NOT EXISTS patient_vitals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT NOT NULL,
    patient_id INT NOT NULL,
    blood_pressure VARCHAR(20),
    pulse_rate INT,
    temperature DECIMAL(4,1),
    weight DECIMAL(5,2),
    height DECIMAL(5,2),
    bmi DECIMAL(4,1),
    oxygen_saturation INT,
    notes TEXT,
    recorded_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id),
    FOREIGN KEY (patient_id) REFERENCES users(id)
  )`,

  // ============ INSURANCE POLICIES (KYC) ============
  `CREATE TABLE IF NOT EXISTS insurance_policies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    provider VARCHAR(255) NOT NULL,
    policy_number VARCHAR(100) NOT NULL,
    plan_name VARCHAR(255),
    valid_from DATE,
    valid_to DATE,
    kyc_doc_path VARCHAR(500),
    status ENUM('pending','verified','rejected') DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  // ============ SHIFT HANDOVER NOTES ============
  `CREATE TABLE IF NOT EXISTS shift_handover_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinic_id INT,
    created_by INT NOT NULL,
    role_label VARCHAR(50) DEFAULT 'receptionist',
    shift_date DATE NOT NULL,
    shift_type ENUM('morning','afternoon','evening','night') DEFAULT 'morning',
    notes TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
  )`,

  // ============ SUBSCRIPTION PLANS ============
  `CREATE TABLE IF NOT EXISTS subscription_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role ENUM('doctor','laboratory','pharmacist','all') DEFAULT 'all',
    price DECIMAL(10,2) NOT NULL,
    duration_days INT NOT NULL,
    max_appointments INT,
    features JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS subscription_plan_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    role VARCHAR(30) NOT NULL,
    requested_title VARCHAR(150),
    message TEXT,
    status ENUM('pending','accepted','contacted','rejected') DEFAULT 'pending',
    admin_notes TEXT,
    handled_by INT,
    handled_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (handled_by) REFERENCES users(id) ON DELETE SET NULL
  )`,

  // ============ CONTACT MESSAGES ============
  `CREATE TABLE IF NOT EXISTS contact_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    subject VARCHAR(500),
    message TEXT NOT NULL,
    status ENUM('new','in_progress','resolved') DEFAULT 'new',
    admin_reply TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // ============ AUDIT LOGS ============
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  )`,

  // ============ CATEGORIES / DEPARTMENTS ============
  `CREATE TABLE IF NOT EXISTS medical_departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // Insert default departments
  `INSERT IGNORE INTO medical_departments (id, name, description, icon) VALUES
    (1, 'General Medicine', 'General health issues', 'stethoscope'),
    (2, 'Cardiology', 'Heart and cardiovascular system', 'heart'),
    (3, 'Dermatology', 'Skin conditions', 'sun'),
    (4, 'Orthopedics', 'Bones and joints', 'activity'),
    (5, 'Gynecology', 'Women health', 'user'),
    (6, 'Pediatrics', 'Child health', 'smile'),
    (7, 'Neurology', 'Brain and nervous system', 'brain'),
    (8, 'Ophthalmology', 'Eyes', 'eye'),
    (9, 'ENT', 'Ear, Nose & Throat', 'wind'),
    (10, 'Psychiatry', 'Mental health', 'cloud'),
    (11, 'Gastroenterology', 'Digestive system', 'zap'),
    (12, 'Endocrinology', 'Hormonal disorders', 'thermometer'),
    (13, 'Oncology', 'Cancer treatment', 'shield'),
    (14, 'Urology', 'Urinary system', 'droplet'),
    (15, 'Pulmonology', 'Lungs and respiratory', 'wind')`,

  // Link doctors to departments
  `CREATE TABLE IF NOT EXISTS doctor_departments (
    doctor_id INT NOT NULL,
    department_id INT NOT NULL,
    PRIMARY KEY (doctor_id, department_id),
    FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES medical_departments(id) ON DELETE CASCADE
  )`,

  // ============ BLOG POSTS ============
  `CREATE TABLE IF NOT EXISTS blog_posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE DEFAULT (UUID()),
    author_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    summary TEXT,
    content MEDIUMTEXT NOT NULL,
    category VARCHAR(100),
    cover_image VARCHAR(500),
    status ENUM('draft','pending','approved','rejected') DEFAULT 'pending',
    admin_remarks TEXT,
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  // ============ CLINIC PHOTOS ============
  `CREATE TABLE IF NOT EXISTS clinic_photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinic_id INT NOT NULL,
    photo_path VARCHAR(500) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
  )`,

  // ============ LAB PHOTOS ============
  `CREATE TABLE IF NOT EXISTS lab_photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lab_id INT NOT NULL,
    photo_path VARCHAR(500) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lab_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  // ============ PHARMACY PHOTOS ============
  `CREATE TABLE IF NOT EXISTS pharmacy_photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pharmacist_id INT NOT NULL,
    photo_path VARCHAR(500) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pharmacist_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  // ============ SYSTEM SETTINGS ============
  `CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(64) PRIMARY KEY,
    setting_value VARCHAR(255),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  // Booking fee / payment fields on appointments (MySQL 8+ supports IF NOT EXISTS)
  `CREATE TABLE IF NOT EXISTS payment_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(8) DEFAULT 'INR',
    status ENUM('created','paid','failed','cancelled') DEFAULT 'created',
    gateway VARCHAR(20) DEFAULT 'paytm',
    gateway_order_id VARCHAR(64),
    gateway_payment_id VARCHAR(64),
    gateway_signature VARCHAR(255),
    appointment_id INT,
    queue_number INT,
    transaction_id VARCHAR(64),
    appointment_payload LONGTEXT,
    callback_payload LONGTEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  ];

async function runMigrations() {
  console.log('Starting database migrations...\n');

  const ensureIndex = async (tableName, indexName, createSql) => {
    const [[existing]] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND INDEX_NAME = ?`,
      [tableName, indexName]
    );

    if (!existing.count) {
      await pool.query(createSql);
    }
  };
  
  // First create DB if not exists
  const rootPool = require('mysql2/promise').createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: 1
  });

  try {
    await rootPool.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'healthcare_db'}\``);
    console.log(`✅ Database '${process.env.DB_NAME || 'healthcare_db'}' ready\n`);
    await rootPool.end();
  } catch (err) {
    console.error('Error creating database:', err.message);
    process.exit(1);
  }

  for (let i = 0; i < migrations.length; i++) {
    try {
      await pool.query(migrations[i]);
      const tableName = migrations[i].match(/TABLE IF NOT EXISTS (\w+)/)?.[1] || 
                        migrations[i].match(/INSERT IGNORE INTO (\w+)/)?.[1] ||
                        `step_${i + 1}`;
      console.log(`  ✅ ${tableName}`);
    } catch (error) {
      console.error(`  ❌ Migration ${i + 1} failed:`, error.message);
    }
  }

  // Ensure role_id exists and is backfilled (idempotent)
  try {
    const [[roleIdCol]] = await pool.query(
      `SELECT COUNT(*) as count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role_id'`
    );
    if (!roleIdCol.count) {
      await pool.query('ALTER TABLE users ADD COLUMN role_id INT NULL');
    }

    const [[roleCol]] = await pool.query(
      `SELECT COUNT(*) as count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'`
    );
    if (roleCol.count) {
      await pool.query(
        `UPDATE users u
         JOIN roles r ON r.name = u.role
         SET u.role_id = r.id
         WHERE u.role_id IS NULL`
      );
    }

    const [[fk]] = await pool.query(
      `SELECT COUNT(*) as count
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND CONSTRAINT_NAME = 'fk_users_role_id'`
    );
    if (!fk.count) {
      await pool.query(
        'ALTER TABLE users ADD CONSTRAINT fk_users_role_id FOREIGN KEY (role_id) REFERENCES roles(id)'
      );
    }
  } catch (err) {
    console.error('Error normalizing roles:', err.message);
  }

  // Ensure video columns on appointments (idempotent)
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'appointments'
          AND COLUMN_NAME IN ('consultation_mode','video_provider','video_meeting_url','video_host_url')`
    );
    const existing = new Set(cols.map((c) => c.COLUMN_NAME));
    if (!existing.has('consultation_mode')) {
      await pool.query(`ALTER TABLE appointments ADD COLUMN consultation_mode ENUM('in_person','video') DEFAULT 'in_person'`);
    }
    if (!existing.has('video_provider')) {
      await pool.query(`ALTER TABLE appointments ADD COLUMN video_provider VARCHAR(50)`);
    }
    if (!existing.has('video_meeting_url')) {
      await pool.query(`ALTER TABLE appointments ADD COLUMN video_meeting_url VARCHAR(500)`);
    }
    if (!existing.has('video_host_url')) {
      await pool.query(`ALTER TABLE appointments ADD COLUMN video_host_url VARCHAR(500)`);
    }
  } catch (err) {
    console.error('Error normalizing appointment video columns:', err.message);
  }

  // Ensure payment columns on appointments (idempotent)
  try {
    const [payCols] = await pool.query(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'appointments'
         AND COLUMN_NAME IN ('booking_fee','payment_status','payment_reference')`
    );
    const paySet = new Set(payCols.map((c) => c.COLUMN_NAME));
    if (!paySet.has('booking_fee')) {
      await pool.query(`ALTER TABLE appointments ADD COLUMN booking_fee DECIMAL(10,2) DEFAULT 0`);
    }
    if (!paySet.has('payment_status')) {
      await pool.query(`ALTER TABLE appointments ADD COLUMN payment_status VARCHAR(20) DEFAULT 'unpaid'`);
    }
    if (!paySet.has('payment_reference')) {
      await pool.query(`ALTER TABLE appointments ADD COLUMN payment_reference VARCHAR(128)`);
    }
  } catch (err) {
    console.error('Error normalizing appointment payment columns:', err.message);
  }

  // Ensure session-based columns (idempotent)
  try {
    const [schedCols] = await pool.query(
      `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'doctor_schedules'
          AND COLUMN_NAME IN ('session_label', 'override_date')`
      );
      const schedSet = new Set(schedCols.map((c) => c.COLUMN_NAME));
      if (!schedSet.has('session_label')) {
        await pool.query(`ALTER TABLE doctor_schedules ADD COLUMN session_label VARCHAR(50) NOT NULL DEFAULT 'Session'`);
      }
      if (!schedSet.has('override_date')) {
        await pool.query(`ALTER TABLE doctor_schedules ADD COLUMN override_date DATE NULL AFTER clinic_id`);
      }

    const [apptCols] = await pool.query(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'appointments'
         AND COLUMN_NAME IN ('session_id','priority_level')`
    );
    const apptSet = new Set(apptCols.map((c) => c.COLUMN_NAME));
    if (!apptSet.has('session_id')) {
      await pool.query(`ALTER TABLE appointments ADD COLUMN session_id INT NULL`);
    }
    if (!apptSet.has('priority_level')) {
      await pool.query(`ALTER TABLE appointments ADD COLUMN priority_level ENUM('normal','priority') DEFAULT 'normal'`);
    }
  } catch (err) {
    console.error('Error normalizing session columns:', err.message);
  }

  // Ensure lab_order_tests completion flag
  try {
    const [lotCols] = await pool.query(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'lab_order_tests'
         AND COLUMN_NAME IN ('is_completed')`
    );
    const lotSet = new Set(lotCols.map((c) => c.COLUMN_NAME));
    if (!lotSet.has('is_completed')) {
      await pool.query(`ALTER TABLE lab_order_tests ADD COLUMN is_completed TINYINT(1) DEFAULT 0`);
    }
  } catch (err) {
    console.error('Error normalizing lab_order_tests columns:', err.message);
  }

  // Ensure payment_orders gateway columns
  try {
    const [payCols] = await pool.query(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'payment_orders'
         AND COLUMN_NAME IN ('gateway_order_id','gateway_payment_id','gateway_signature')`
    );
    const paySet = new Set(payCols.map((c) => c.COLUMN_NAME));
    if (!paySet.has('gateway_order_id')) {
      await pool.query(`ALTER TABLE payment_orders ADD COLUMN gateway_order_id VARCHAR(64)`);
    }
    if (!paySet.has('gateway_payment_id')) {
      await pool.query(`ALTER TABLE payment_orders ADD COLUMN gateway_payment_id VARCHAR(64)`);
    }
    if (!paySet.has('gateway_signature')) {
      await pool.query(`ALTER TABLE payment_orders ADD COLUMN gateway_signature VARCHAR(255)`);
    }
  } catch (err) {
    console.error('Error normalizing payment_orders columns:', err.message);
  }

  // Ensure lab_orders home collection fields
  try {
    const [orderCols] = await pool.query(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'lab_orders'
         AND COLUMN_NAME IN ('collection_required','collection_date','collection_time','collection_address','collection_notes')`
    );
    const orderSet = new Set(orderCols.map((c) => c.COLUMN_NAME));
    if (!orderSet.has('collection_required')) {
      await pool.query(`ALTER TABLE lab_orders ADD COLUMN collection_required TINYINT(1) DEFAULT 0`);
    }
    if (!orderSet.has('collection_date')) {
      await pool.query(`ALTER TABLE lab_orders ADD COLUMN collection_date DATE`);
    }
    if (!orderSet.has('collection_time')) {
      await pool.query(`ALTER TABLE lab_orders ADD COLUMN collection_time VARCHAR(10)`);
    }
    if (!orderSet.has('collection_address')) {
      await pool.query(`ALTER TABLE lab_orders ADD COLUMN collection_address TEXT`);
    }
    if (!orderSet.has('collection_notes')) {
      await pool.query(`ALTER TABLE lab_orders ADD COLUMN collection_notes TEXT`);
    }
  } catch (err) {
    console.error('Error normalizing lab_orders columns:', err.message);
  }

  // Ensure lab_reports result flag fields
  try {
    const [reportCols] = await pool.query(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'lab_reports'
         AND COLUMN_NAME IN ('result_value','result_unit','result_flag','normal_range_snapshot')`
    );
    const reportSet = new Set(reportCols.map((c) => c.COLUMN_NAME));
    if (!reportSet.has('result_value')) {
      await pool.query(`ALTER TABLE lab_reports ADD COLUMN result_value VARCHAR(50)`);
    }
    if (!reportSet.has('result_unit')) {
      await pool.query(`ALTER TABLE lab_reports ADD COLUMN result_unit VARCHAR(20)`);
    }
    if (!reportSet.has('result_flag')) {
      await pool.query(`ALTER TABLE lab_reports ADD COLUMN result_flag ENUM('normal','abnormal','high','low')`);
    }
    if (!reportSet.has('normal_range_snapshot')) {
      await pool.query(`ALTER TABLE lab_reports ADD COLUMN normal_range_snapshot VARCHAR(255)`);
    }
  } catch (err) {
    console.error('Error normalizing lab_reports columns:', err.message);
  }

  // Ensure lab departments + summary results
  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS lab_departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lab_id INT NOT NULL,
        name VARCHAR(150) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_lab_dept (lab_id, name),
        FOREIGN KEY (lab_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    );

    await pool.query(
      `CREATE TABLE IF NOT EXISTS lab_staff_departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        staff_user_id INT NOT NULL,
        lab_id INT NOT NULL,
        department_id INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_staff_dept (staff_user_id, department_id),
        FOREIGN KEY (staff_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (lab_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (department_id) REFERENCES lab_departments(id) ON DELETE CASCADE
      )`
    );

    const [labTestCols] = await pool.query(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'lab_tests'
         AND COLUMN_NAME = 'lab_department_id'`
    );
    if (!labTestCols.length) {
      await pool.query(`ALTER TABLE lab_tests ADD COLUMN lab_department_id INT NULL`);
    }

    const [[fkDept]] = await pool.query(
      `SELECT COUNT(*) as count
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'lab_tests'
         AND CONSTRAINT_NAME = 'fk_lab_tests_department'`
    );
    if (!fkDept.count) {
      await pool.query(
        `ALTER TABLE lab_tests
         ADD CONSTRAINT fk_lab_tests_department FOREIGN KEY (lab_department_id) REFERENCES lab_departments(id) ON DELETE SET NULL`
      );
    }

    await pool.query(
      `CREATE TABLE IF NOT EXISTS lab_report_results (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lab_report_id INT NOT NULL,
        test_id INT,
        result_name VARCHAR(255) NOT NULL,
        result_value VARCHAR(50),
        result_unit VARCHAR(20),
        normal_range VARCHAR(255),
        result_flag ENUM('normal','abnormal','high','low'),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lab_report_id) REFERENCES lab_reports(id) ON DELETE CASCADE,
        FOREIGN KEY (test_id) REFERENCES lab_tests(id) ON DELETE SET NULL
      )`
    );
  } catch (err) {
    console.error('Error normalizing lab departments/results:', err.message);
  }

  // Ensure specialization + education masters and doctor profile metadata
  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS medical_specializations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    );

    await pool.query(
      `CREATE TABLE IF NOT EXISTS medical_educations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    );

    await pool.query(
      `INSERT IGNORE INTO medical_specializations (name, description) VALUES
       ('General Physician', 'Primary care and general medicine'),
       ('Cardiologist', 'Heart and cardiovascular care'),
       ('Dermatologist', 'Skin, hair, and nail care'),
       ('Endocrinologist', 'Hormonal and metabolic disorders'),
       ('ENT Specialist', 'Ear, nose, and throat care'),
       ('Gastroenterologist', 'Digestive system care'),
       ('Gynecologist', 'Women and reproductive health'),
       ('Neurologist', 'Brain and nervous system care'),
       ('Oncologist', 'Cancer care and oncology'),
       ('Ophthalmologist', 'Eye care'),
       ('Orthopedic Specialist', 'Bones, joints, and muscles'),
       ('Pediatrician', 'Child health and pediatrics'),
       ('Psychiatrist', 'Mental health and psychiatry'),
       ('Pulmonologist', 'Respiratory and lung care'),
       ('Urologist', 'Urinary and male reproductive care')`
    );

    await pool.query(
      `INSERT IGNORE INTO medical_educations (name, description) VALUES
       ('MBBS', 'Bachelor of Medicine, Bachelor of Surgery'),
       ('MD', 'Doctor of Medicine'),
       ('MS', 'Master of Surgery'),
       ('DM', 'Doctorate of Medicine super-specialty'),
       ('DNB', 'Diplomate of National Board'),
       ('MCh', 'Master of Chirurgiae'),
       ('BDS', 'Bachelor of Dental Surgery'),
       ('MDS', 'Master of Dental Surgery'),
       ('BAMS', 'Bachelor of Ayurvedic Medicine and Surgery'),
       ('BHMS', 'Bachelor of Homeopathic Medicine and Surgery'),
       ('BUMS', 'Bachelor of Unani Medicine and Surgery'),
       ('PharmD', 'Doctor of Pharmacy')`
    );

    await pool.query(
      `CREATE TABLE IF NOT EXISTS doctor_specialization_certificates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        specialization_id INT NOT NULL,
        certificate_path VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_doctor_specialization_certificate (user_id, specialization_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (specialization_id) REFERENCES medical_specializations(id) ON DELETE CASCADE
      )`
    );

    await pool.query(
      `CREATE TABLE IF NOT EXISTS doctor_education_certificates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        education_id INT NOT NULL,
        certificate_path VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_doctor_education_certificate (user_id, education_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (education_id) REFERENCES medical_educations(id) ON DELETE CASCADE
      )`
    );

    const requiredColumns = [
      { name: 'primary_specialization_id', sql: 'ALTER TABLE doctor_profiles ADD COLUMN primary_specialization_id INT NULL' },
      { name: 'additional_specialization_ids', sql: 'ALTER TABLE doctor_profiles ADD COLUMN additional_specialization_ids TEXT NULL' },
      { name: 'education_ids', sql: 'ALTER TABLE doctor_profiles ADD COLUMN education_ids TEXT NULL' },
    ];

    for (const column of requiredColumns) {
      const [rows] = await pool.query(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'doctor_profiles'
           AND COLUMN_NAME = ?`,
        [column.name]
      );
      if (!rows.length) {
        await pool.query(column.sql);
      }
    }

    const specializationPairs = [
      ['General Medicine', 'General Physician'],
      ['Cardiology', 'Cardiologist'],
      ['Dermatology', 'Dermatologist'],
      ['Endocrinology', 'Endocrinologist'],
      ['ENT', 'ENT Specialist'],
      ['Gastroenterology', 'Gastroenterologist'],
      ['Gynecology', 'Gynecologist'],
      ['Neurology', 'Neurologist'],
      ['Oncology', 'Oncologist'],
      ['Ophthalmology', 'Ophthalmologist'],
      ['Orthopedics', 'Orthopedic Specialist'],
      ['Pediatrics', 'Pediatrician'],
      ['Psychiatry', 'Psychiatrist'],
      ['Pulmonology', 'Pulmonologist'],
      ['Urology', 'Urologist'],
    ];

    for (const [legacyName, newName] of specializationPairs) {
      await pool.query(
        'UPDATE doctor_profiles SET specialization = ? WHERE specialization = ?',
        [newName, legacyName]
      );
    }

    await pool.query(
      `UPDATE doctor_profiles dp
       JOIN medical_specializations ms ON ms.name = dp.specialization
       SET dp.primary_specialization_id = ms.id
       WHERE dp.primary_specialization_id IS NULL AND dp.specialization IS NOT NULL`
    );
  } catch (err) {
    console.error('Error normalizing doctor master data:', err.message);
  }

  try {
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

    await pool.query(
      `INSERT INTO doctor_consultation_fees (
         doctor_id, clinic_id, department_id, consultation_type, priority_level, new_patient_fee, follow_up_fee, currency, is_active
       )
       SELECT dp.user_id, dp.clinic_id, 0, 'in_person', 'normal', dp.consultation_fee, NULL, 'INR', 1
       FROM doctor_profiles dp
       WHERE dp.clinic_id IS NOT NULL
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
         )`
    );
  } catch (err) {
    console.error('Error preparing doctor consultation fees:', err.message);
  }

  try {
    const [userPlanCols] = await pool.query(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND COLUMN_NAME IN ('subscription_plan', 'current_plan_id', 'subscription_started_at')`
    );
    const userPlanSet = new Set(userPlanCols.map((col) => col.COLUMN_NAME));

    if (userPlanSet.has('subscription_plan')) {
      await pool.query(`ALTER TABLE users MODIFY subscription_plan VARCHAR(100) NULL`);
    }
    if (!userPlanSet.has('current_plan_id')) {
      await pool.query(`ALTER TABLE users ADD COLUMN current_plan_id INT NULL AFTER subscription_plan`);
    }
    if (!userPlanSet.has('subscription_started_at')) {
      await pool.query(`ALTER TABLE users ADD COLUMN subscription_started_at DATETIME NULL AFTER current_plan_id`);
    }

    const [[userPlanFk]] = await pool.query(
      `SELECT COUNT(*) as count
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND CONSTRAINT_NAME = 'fk_users_current_plan_id'`
    );
    if (!userPlanFk.count) {
      await pool.query(
        `ALTER TABLE users
         ADD CONSTRAINT fk_users_current_plan_id
         FOREIGN KEY (current_plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL`
      );
    }

    const [planCols] = await pool.query(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'subscription_plans'
         AND COLUMN_NAME IN ('code', 'description', 'plan_type', 'target_user_id', 'is_default', 'display_order', 'modules', 'limits')`
    );
    const planSet = new Set(planCols.map((col) => col.COLUMN_NAME));
    if (!planSet.has('code')) {
      await pool.query(`ALTER TABLE subscription_plans ADD COLUMN code VARCHAR(120) NULL AFTER name`);
    }
    if (!planSet.has('description')) {
      await pool.query(`ALTER TABLE subscription_plans ADD COLUMN description TEXT NULL AFTER code`);
    }
    if (!planSet.has('plan_type')) {
      await pool.query(`ALTER TABLE subscription_plans ADD COLUMN plan_type ENUM('standard','custom') DEFAULT 'standard' AFTER role`);
    }
    if (!planSet.has('target_user_id')) {
      await pool.query(`ALTER TABLE subscription_plans ADD COLUMN target_user_id INT NULL AFTER plan_type`);
    }
    if (!planSet.has('is_default')) {
      await pool.query(`ALTER TABLE subscription_plans ADD COLUMN is_default TINYINT(1) DEFAULT 0 AFTER target_user_id`);
    }
    if (!planSet.has('display_order')) {
      await pool.query(`ALTER TABLE subscription_plans ADD COLUMN display_order INT DEFAULT 0 AFTER is_default`);
    }
    if (!planSet.has('modules')) {
      await pool.query(`ALTER TABLE subscription_plans ADD COLUMN modules JSON NULL AFTER features`);
    }
    if (!planSet.has('limits')) {
      await pool.query(`ALTER TABLE subscription_plans ADD COLUMN limits JSON NULL AFTER modules`);
    }

    await pool.query(`ALTER TABLE subscription_plans MODIFY role VARCHAR(30) NOT NULL`);
    await pool.query(`ALTER TABLE subscription_plans MODIFY duration_days INT NOT NULL DEFAULT -1`);
    await pool.query(`ALTER TABLE subscription_plans MODIFY max_appointments INT NULL`);

    const [[planCodeIdx]] = await pool.query(
      `SELECT COUNT(*) as count
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'subscription_plans'
         AND INDEX_NAME = 'uniq_subscription_plan_code'`
    );
    if (!planCodeIdx.count) {
      await pool.query(`ALTER TABLE subscription_plans ADD UNIQUE KEY uniq_subscription_plan_code (code)`);
    }

    const [[planUserFk]] = await pool.query(
      `SELECT COUNT(*) as count
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'subscription_plans'
         AND CONSTRAINT_NAME = 'fk_subscription_plans_target_user'`
    );
    if (!planUserFk.count) {
      await pool.query(
        `ALTER TABLE subscription_plans
         ADD CONSTRAINT fk_subscription_plans_target_user
         FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL`
      );
    }

    await pool.query(
      `UPDATE subscription_plans
       SET code = CONCAT(LOWER(role), '_plan_', id)
       WHERE code IS NULL OR TRIM(code) = ''`
    );

    const defaultPlans = [
      {
        role: 'patient',
        code: 'patient_free',
        name: 'Free',
        description: 'Default free plan for patients.',
        features: ['Book appointments', 'Prescription access', 'Lab order tracking'],
        modules: { appointment_booking: true, prescriptions: true, lab_orders: true, insurance_vault: true },
        limits: { appointments_per_month: -1, family_profiles_limit: 1, insurance_policies_limit: 1, medical_record_downloads_limit: -1 },
      },
      {
        role: 'doctor',
        code: 'doctor_free',
        name: 'Free',
        description: 'Default free plan for doctors.',
        features: ['Basic clinic profile', 'Schedule management', 'Prescription writing'],
        modules: { clinic_management: true, schedule_management: true, e_prescriptions: true, lab_orders: true, video_consultation: false, guest_doctors: false, staff_roles: false, articles: false },
        limits: { clinics_limit: 1, guest_doctors_limit: 0, staff_limit: 0, appointments_per_month: 100, articles_per_month: 0 },
      },
      {
        role: 'laboratory',
        code: 'laboratory_free',
        name: 'Free',
        description: 'Default free plan for laboratories.',
        features: ['Basic test catalog', 'Report uploads', 'Order management'],
        modules: { test_catalog: true, report_upload: true, order_management: true, home_sample_collection: false, department_split: false, multi_staff: false },
        limits: { tests_limit: 25, departments_limit: 1, staff_limit: 0, reports_per_month: 200, branches_limit: 1 },
      },
      {
        role: 'pharmacist',
        code: 'pharmacist_free',
        name: 'Free',
        description: 'Default free plan for pharmacies.',
        features: ['Inventory basics', 'Prescription fulfillment', 'Stock alerts'],
        modules: { inventory_management: true, prescription_fulfillment: true, stock_alerts: true, barcode_support: false, multi_staff: false },
        limits: { medicines_limit: 200, staff_limit: 0, prescriptions_per_month: 300, branches_limit: 1 },
      },
    ];

    for (const plan of defaultPlans) {
      await pool.query(
        `INSERT INTO subscription_plans (
           name, code, description, role, plan_type, is_default, display_order, price, duration_days,
           max_appointments, features, modules, limits, is_active
         )
         SELECT ?, ?, ?, ?, 'standard', 1, 0, 0, -1, ?, ?, ?, ?, 1
         FROM DUAL
         WHERE NOT EXISTS (
           SELECT 1 FROM subscription_plans WHERE code = ?
         )`,
        [
          plan.name,
          plan.code,
          plan.description,
          plan.role,
          plan.limits.appointments_per_month ?? null,
          JSON.stringify(plan.features),
          JSON.stringify(plan.modules),
          JSON.stringify(plan.limits),
          plan.code,
        ]
      );
    }

    await pool.query(
      `UPDATE users u
       JOIN roles r ON r.id = u.role_id
       JOIN subscription_plans sp ON sp.role = r.name AND sp.is_default = 1 AND sp.is_active = 1
       SET u.current_plan_id = sp.id,
           u.subscription_plan = sp.name,
           u.subscription_started_at = COALESCE(u.subscription_started_at, NOW()),
           u.subscription_expires_at = CASE
             WHEN sp.duration_days = -1 THEN NULL
             ELSE DATE_ADD(COALESCE(u.created_at, NOW()), INTERVAL sp.duration_days DAY)
           END
       WHERE u.current_plan_id IS NULL
         AND r.name IN ('patient', 'doctor', 'laboratory', 'pharmacist')`
    );

    await pool.query(
      `UPDATE users u
       JOIN subscription_plans sp ON sp.id = u.current_plan_id
       SET u.subscription_plan = sp.name
       WHERE u.current_plan_id IS NOT NULL`
    );
  } catch (err) {
    console.error('Error normalizing subscription plans:', err.message);
  }

  // Add performance indexes without changing application flow
  try {
    await ensureIndex('users', 'idx_users_role_active_verified', `CREATE INDEX idx_users_role_active_verified ON users (role_id, is_active, is_verified)`);
    await ensureIndex('users', 'idx_users_created_at', `CREATE INDEX idx_users_created_at ON users (created_at)`);

    await ensureIndex('clinics', 'idx_clinics_owner_status', `CREATE INDEX idx_clinics_owner_status ON clinics (owner_doctor_id, is_active, is_verified)`);
    await ensureIndex('clinics', 'idx_clinics_city_state', `CREATE INDEX idx_clinics_city_state ON clinics (city, state)`);

    await ensureIndex('doctor_profiles', 'idx_doctor_profiles_clinic_verified', `CREATE INDEX idx_doctor_profiles_clinic_verified ON doctor_profiles (clinic_id, is_verified)`);
    await ensureIndex('doctor_profiles', 'idx_doctor_profiles_primary_specialization', `CREATE INDEX idx_doctor_profiles_primary_specialization ON doctor_profiles (primary_specialization_id)`);

    await ensureIndex('doctor_schedules', 'idx_doctor_schedules_lookup', `CREATE INDEX idx_doctor_schedules_lookup ON doctor_schedules (doctor_id, clinic_id, override_date, day_of_week, is_active, start_time)`);
    await ensureIndex('doctor_leaves', 'idx_doctor_leaves_lookup', `CREATE INDEX idx_doctor_leaves_lookup ON doctor_leaves (doctor_id, clinic_id, leave_date)`);

    await ensureIndex('appointments', 'idx_appointments_doctor_date_status', `CREATE INDEX idx_appointments_doctor_date_status ON appointments (doctor_id, clinic_id, appointment_date, status)`);
    await ensureIndex('appointments', 'idx_appointments_patient_date_status', `CREATE INDEX idx_appointments_patient_date_status ON appointments (patient_id, appointment_date, status)`);
    await ensureIndex('appointments', 'idx_appointments_session_date_status', `CREATE INDEX idx_appointments_session_date_status ON appointments (session_id, appointment_date, status)`);

    await ensureIndex('prescriptions', 'idx_prescriptions_patient_created', `CREATE INDEX idx_prescriptions_patient_created ON prescriptions (patient_id, created_at)`);
    await ensureIndex('prescriptions', 'idx_prescriptions_doctor_created', `CREATE INDEX idx_prescriptions_doctor_created ON prescriptions (doctor_id, created_at)`);

    await ensureIndex('lab_orders', 'idx_lab_orders_patient_status_created', `CREATE INDEX idx_lab_orders_patient_status_created ON lab_orders (patient_id, status, created_at)`);
    await ensureIndex('lab_orders', 'idx_lab_orders_lab_status_created', `CREATE INDEX idx_lab_orders_lab_status_created ON lab_orders (laboratory_id, status, created_at)`);
    await ensureIndex('lab_orders', 'idx_lab_orders_doctor_status_created', `CREATE INDEX idx_lab_orders_doctor_status_created ON lab_orders (doctor_id, status, created_at)`);

    await ensureIndex('notifications', 'idx_notifications_user_read_created', `CREATE INDEX idx_notifications_user_read_created ON notifications (user_id, is_read, created_at)`);

    await ensureIndex('clinic_photos', 'idx_clinic_photos_clinic_created', `CREATE INDEX idx_clinic_photos_clinic_created ON clinic_photos (clinic_id, created_at)`);
    await ensureIndex('lab_photos', 'idx_lab_photos_lab_created', `CREATE INDEX idx_lab_photos_lab_created ON lab_photos (lab_id, created_at)`);
    await ensureIndex('pharmacy_photos', 'idx_pharmacy_photos_user_created', `CREATE INDEX idx_pharmacy_photos_user_created ON pharmacy_photos (pharmacist_id, created_at)`);

    await ensureIndex('doctor_consultation_fees', 'idx_doctor_consultation_lookup', `CREATE INDEX idx_doctor_consultation_lookup ON doctor_consultation_fees (doctor_id, clinic_id, department_id, consultation_type, priority_level, is_active)`);
    await ensureIndex('subscription_plans', 'idx_subscription_plans_role_active', `CREATE INDEX idx_subscription_plans_role_active ON subscription_plans (role, is_active, is_default, plan_type)`);
    const [announcementPlatformColumn] = await pool.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'system_announcements' AND COLUMN_NAME = 'target_platform'`);
    if (!announcementPlatformColumn.length) {
      await pool.query(`ALTER TABLE system_announcements ADD COLUMN target_platform ENUM('all','web','mobile') DEFAULT 'all' AFTER target_role`);
    }

    await ensureIndex('subscription_plan_requests', 'idx_subscription_plan_requests_status', `CREATE INDEX idx_subscription_plan_requests_status ON subscription_plan_requests (status, role, created_at)`);
    await ensureIndex('subscription_plan_requests', 'idx_subscription_plan_requests_user', `CREATE INDEX idx_subscription_plan_requests_user ON subscription_plan_requests (user_id, status, created_at)`);
  } catch (err) {
    console.error('Error adding performance indexes:', err.message);
  }

  // Create admin user
  const bcrypt = require('bcryptjs');
  try {
    const [existing] = await pool.query(
      `SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'admin'`
    );
    if (existing.length === 0) {
      const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123456', 12);
      await pool.query(
        'INSERT INTO users (name, email, phone, password_hash, role_id, is_verified, is_phone_verified, is_active) VALUES (?, ?, ?, ?, (SELECT id FROM roles WHERE name = ?), ?, ?, ?)',
        [process.env.ADMIN_NAME || 'Super Admin', process.env.ADMIN_EMAIL || 'admin@medicare.com',
         process.env.ADMIN_PHONE || '+919999999999', hash, 'admin', true, true, true]
      );
      console.log('\n✅ Default admin user created');
      console.log(`   Email: ${process.env.ADMIN_EMAIL || 'admin@medicare.com'}`);
      console.log(`   Password: ${process.env.ADMIN_PASSWORD || 'Admin@123456'}`);
    }
  } catch (err) {
    console.error('Error creating admin:', err.message);
  }

  // Seed sample data (only if no non-admin users)
  try {
    const [[{ count }]] = await pool.query(
      `SELECT COUNT(*) as count
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE r.name != 'admin'`
    );
    if (count === 0) {
      const date = new Date();
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const today = `${yyyy}-${mm}-${dd}`;
      const dow = date.getDay();

      const doctorPass = await bcrypt.hash('Doctor@123', 12);
      const patientPass = await bcrypt.hash('Patient@123', 12);
      const labPass = await bcrypt.hash('Lab@123', 12);
      const pharmPass = await bcrypt.hash('Pharm@123', 12);
      const recepPass = await bcrypt.hash('Recep@123', 12);

      const [docRes] = await pool.query(
        'INSERT INTO users (name, email, phone, password_hash, role_id, profile_image, is_verified, is_phone_verified, is_active) VALUES (?, ?, ?, ?, (SELECT id FROM roles WHERE name = ?), ?, ?, ?, ?)',
        ['Dr. Raji Kumar', 'raji1@example.com', '+919000000001', doctorPass, 'doctor', '/public/sample/doctor1.jpg', true, true, true]
      );
      const doctorId = docRes.insertId;

      const [clinicRes] = await pool.query(
        `INSERT INTO clinics (owner_doctor_id, name, registration_number, certificate_path, address, city, state, pincode, latitude, longitude, phone, email, is_verified, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [doctorId, 'Raji Heart Clinic', 'CLINIC-001', '/public/sample/certs/clinic1.pdf', '12, MG Road', 'Bengaluru', 'Karnataka', '560001', 12.971599, 77.594566, '+919000000001', 'clinic@medicarepro.com', true, true]
      );
      const clinicId = clinicRes.insertId;

      await pool.query(
        `INSERT INTO doctor_profiles (user_id, clinic_id, specialization, qualification, medical_license_number, license_certificate_path, experience_years, consultation_fee, bio, languages, is_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [doctorId, clinicId, 'Cardiology', 'MBBS, MD', 'MED-RAJI-1234', '/public/sample/certs/doctor1.pdf', 8, 500, 'Senior cardiologist with 8 years of experience.', 'English, Hindi', true]
      );

      const [patientRes] = await pool.query(
        'INSERT INTO users (name, email, phone, password_hash, role_id, is_verified, is_phone_verified, is_active) VALUES (?, ?, ?, ?, (SELECT id FROM roles WHERE name = ?), ?, ?, ?)',
        ['Anita Sharma', 'anita@example.com', '+919000000010', patientPass, 'patient', true, true, true]
      );
      const patientId = patientRes.insertId;
      await pool.query(
        `INSERT INTO patient_profiles (user_id, date_of_birth, gender, blood_group, allergies)
         VALUES (?, ?, ?, ?, ?)`,
        [patientId, '1995-06-12', 'female', 'O+', 'None']
      );

      const [labRes] = await pool.query(
        'INSERT INTO users (name, email, phone, password_hash, role_id, is_verified, is_phone_verified, is_active) VALUES (?, ?, ?, ?, (SELECT id FROM roles WHERE name = ?), ?, ?, ?)',
        ['City Lab', 'lab@example.com', '+919000000020', labPass, 'laboratory', true, true, true]
      );
      const labId = labRes.insertId;
      await pool.query(
        `INSERT INTO laboratory_profiles (user_id, lab_name, registration_number, certificate_path, address, city, state, pincode, latitude, longitude, phone, email, working_hours_start, working_hours_end, working_days, is_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [labId, 'City Diagnostics', 'LAB-001', '/public/sample/certs/lab1.pdf', '45, Park Street', 'Bengaluru', 'Karnataka', '560001', 12.9711, 77.5940, '+919000000020', 'lab@example.com', '08:00:00', '20:00:00', 'Mon-Sat', true]
      );
      await pool.query(
        `INSERT INTO lab_tests (laboratory_id, test_name, test_code, category, description, price, discounted_price, discount_percentage, preparation_instructions, turnaround_hours)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [labId, 'Complete Blood Count', 'CBC', 'General', 'Basic blood health panel', 350, 300, 15, 'No fasting required', 12]
      );

      const [pharmRes] = await pool.query(
        'INSERT INTO users (name, email, phone, password_hash, role_id, is_verified, is_phone_verified, is_active) VALUES (?, ?, ?, ?, (SELECT id FROM roles WHERE name = ?), ?, ?, ?)',
        ['MediCare Pharmacy', 'pharm@example.com', '+919000000030', pharmPass, 'pharmacist', true, true, true]
      );
      const pharmId = pharmRes.insertId;
      await pool.query(
        `INSERT INTO pharmacist_profiles (user_id, pharmacy_name, license_number, license_certificate_path, address, city, state, pincode, phone, gstin, is_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [pharmId, 'MediCare Pharmacy', 'PHARM-001', '/public/sample/certs/pharm1.pdf', '22, Residency Road', 'Bengaluru', 'Karnataka', '560025', '+919000000030', '29ABCDE1234F1Z5', true]
      );
      const [medRes] = await pool.query(
        `INSERT INTO medicines (pharmacist_id, name, generic_name, brand_name, manufacturer, composition, category, dosage_form, strength, unit, price, mrp, requires_prescription)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [pharmId, 'Paracetamol', 'Acetaminophen', 'Dolo 650', 'ABC Pharma', 'Paracetamol 650mg', 'Pain Relief', 'tablet', '650', 'mg', 25, 30, true]
      );
      const medicineId = medRes.insertId;
      await pool.query(
        `INSERT INTO medicine_stock (medicine_id, quantity, batch_number, expiry_date, purchase_price, low_stock_alert)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [medicineId, 100, 'BATCH-001', '2027-12-31', 18, 10]
      );

      const [recepRes] = await pool.query(
        'INSERT INTO users (name, email, phone, password_hash, role_id, is_verified, is_phone_verified, is_active) VALUES (?, ?, ?, ?, (SELECT id FROM roles WHERE name = ?), ?, ?, ?)',
        ['Clinic Reception', 'reception@example.com', '+919000000040', recepPass, 'receptionist', true, true, true]
      );
      const recepId = recepRes.insertId;
      await pool.query(
        'INSERT INTO receptionist_profiles (user_id, clinic_id, doctor_id) VALUES (?, ?, ?)',
        [recepId, clinicId, doctorId]
      );

      await pool.query(
        `INSERT INTO doctor_schedules (doctor_id, clinic_id, day_of_week, session_label, start_time, end_time, slot_duration_minutes, max_patients_per_slot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [doctorId, clinicId, dow, 'Morning', '09:00:00', '12:00:00', 10, 30]
      );

      await pool.query(
        `INSERT INTO appointments (patient_id, doctor_id, clinic_id, appointment_date, appointment_time, slot_number, queue_number, status, type, reason_for_visit, booked_by, booked_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [patientId, doctorId, clinicId, today, '09:00:00', 1, 1, 'confirmed', 'scheduled', 'General checkup', 'patient', patientId]
      );

      console.log('\nâœ… Sample data inserted (doctor, patient, lab, pharmacy, clinic, receptionist, appointment)');
      console.log('   Doctor login: +919000000001 / Doctor@123');
      console.log('   Patient login: +919000000010 / Patient@123');
      console.log('   Lab login: +919000000020 / Lab@123');
      console.log('   Pharmacy login: +919000000030 / Pharm@123');
      console.log('   Receptionist login: +919000000040 / Recep@123');
    }
  } catch (err) {
    console.error('Error inserting sample data:', err.message);
  }

  try {
    await ensureDemoAccounts(console);
  } catch (err) {
    console.error('Error preparing demo accounts:', err.message);
  }

  console.log('\n All migrations completed successfully!');
  process.exit(0);
}

runMigrations().catch(console.error);
