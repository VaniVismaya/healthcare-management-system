export const ROLE_PLAN_FIELDS = {
  doctor: {
    title: 'Doctor',
    limitFields: [
      { key: 'clinics_limit', label: 'Clinic Limit' },
      { key: 'guest_doctors_limit', label: 'Guest Doctors Limit' },
      { key: 'staff_limit', label: 'Staff Limit' },
      { key: 'appointments_per_month', label: 'Appointments / Month' },
      { key: 'articles_per_month', label: 'Articles / Month' },
    ],
    moduleFields: [
      { key: 'clinic_management', label: 'Clinic Management' },
      { key: 'schedule_management', label: 'Schedule Management' },
      { key: 'e_prescriptions', label: 'E-Prescriptions' },
      { key: 'lab_orders', label: 'Lab Orders' },
      { key: 'video_consultation', label: 'Video Consultation' },
      { key: 'priority_booking', label: 'Priority Consultation Fees' },
      { key: 'guest_doctors', label: 'Guest Doctors' },
      { key: 'staff_roles', label: 'Staff Roles' },
      { key: 'articles', label: 'Articles / Blogs' },
    ],
  },
  laboratory: {
    title: 'Laboratory',
    limitFields: [
      { key: 'tests_limit', label: 'Tests Limit' },
      { key: 'departments_limit', label: 'Departments Limit' },
      { key: 'staff_limit', label: 'Staff Limit' },
      { key: 'reports_per_month', label: 'Reports / Month' },
      { key: 'branches_limit', label: 'Branches Limit' },
      { key: 'home_collections_per_month', label: 'Home Collections / Month' },
    ],
    moduleFields: [
      { key: 'test_catalog', label: 'Test Catalog' },
      { key: 'report_upload', label: 'Report Upload' },
      { key: 'order_management', label: 'Order Management' },
      { key: 'home_sample_collection', label: 'Home Sample Collection' },
      { key: 'department_split', label: 'Department Workflow' },
      { key: 'multi_staff', label: 'Multi Staff Access' },
      { key: 'abnormal_flags', label: 'Normal / Abnormal Flags' },
    ],
  },
  pharmacist: {
    title: 'Pharmacist',
    limitFields: [
      { key: 'medicines_limit', label: 'Medicines Limit' },
      { key: 'staff_limit', label: 'Staff Limit' },
      { key: 'prescriptions_per_month', label: 'Prescriptions / Month' },
      { key: 'branches_limit', label: 'Branches Limit' },
    ],
    moduleFields: [
      { key: 'inventory_management', label: 'Inventory Management' },
      { key: 'prescription_fulfillment', label: 'Prescription Fulfillment' },
      { key: 'stock_alerts', label: 'Stock Alerts' },
      { key: 'barcode_support', label: 'Barcode Support' },
      { key: 'multi_staff', label: 'Multi Staff Access' },
    ],
  },
  patient: {
    title: 'Patient',
    limitFields: [
      { key: 'appointments_per_month', label: 'Bookings / Month' },
      { key: 'family_profiles_limit', label: 'Family Profiles Limit' },
      { key: 'insurance_policies_limit', label: 'Insurance Policies Limit' },
      { key: 'medical_record_downloads_limit', label: 'Medical Record Downloads' },
    ],
    moduleFields: [
      { key: 'appointment_booking', label: 'Appointment Booking' },
      { key: 'video_consultation_booking', label: 'Video Consultation Booking' },
      { key: 'prescriptions', label: 'Prescription History' },
      { key: 'lab_orders', label: 'Lab Orders' },
      { key: 'insurance_vault', label: 'Insurance Vault' },
    ],
  },
};

export const formatLimitValue = (value) => {
  if (value === -1 || value === '-1') return 'Unlimited';
  if (value === null || value === undefined || value === '') return '-';
  return value;
};
