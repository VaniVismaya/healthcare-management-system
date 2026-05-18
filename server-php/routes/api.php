<?php
require_once __DIR__ . '/../config/bootstrap.php';
require_once __DIR__ . '/../app/Services/Helpers.php';
require_once __DIR__ . '/../app/Controllers/AuthController.php';
require_once __DIR__ . '/../app/Controllers/DoctorController.php';
require_once __DIR__ . '/../app/Controllers/AppointmentController.php';
require_once __DIR__ . '/../app/Controllers/LabController.php';
require_once __DIR__ . '/../app/Controllers/PrescriptionController.php';
require_once __DIR__ . '/../app/Controllers/LabReportController.php';
require_once __DIR__ . '/../app/Controllers/PharmacistController.php';
require_once __DIR__ . '/../app/Controllers/ReceptionistController.php';
require_once __DIR__ . '/../app/Controllers/DoctorScheduleController.php';
require_once __DIR__ . '/../app/Controllers/DoctorLeaveController.php';
require_once __DIR__ . '/../app/Controllers/NotificationController.php';
require_once __DIR__ . '/../app/Controllers/AdminController.php';
require_once __DIR__ . '/../app/Controllers/PatientController.php';
require_once __DIR__ . '/../app/Controllers/ClinicController.php';
require_once __DIR__ . '/../app/Controllers/GuestDoctorController.php';
require_once __DIR__ . '/../app/Controllers/AdminMessagesController.php';
require_once __DIR__ . '/../app/Controllers/AdminAnnouncementsController.php';
require_once __DIR__ . '/../app/Controllers/DoctorProfileController.php';
require_once __DIR__ . '/../app/Controllers/AdminStatsController.php';
require_once __DIR__ . '/../app/Controllers/OrgRoleController.php';
require_once __DIR__ . '/../app/Controllers/VitalsController.php';
require_once __DIR__ . '/../app/Controllers/AiController.php';
require_once __DIR__ . '/../app/Controllers/AnnouncementController.php';
require_once __DIR__ . '/../app/Controllers/ContactController.php';
require_once __DIR__ . '/../app/Controllers/BlogController.php';
require_once __DIR__ . '/../app/Controllers/AuditLogsController.php';
require_once __DIR__ . '/../app/Controllers/PaymentController.php';

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

if ($path === '/api/health') json_response(['status' => 'ok']);

if ($path === '/api/auth/register' && $method === 'POST') AuthController::register();
if ($path === '/api/auth/login' && $method === 'POST') AuthController::login();
if ($path === '/api/auth/login-otp' && $method === 'POST') AuthController::loginOtp();
if ($path === '/api/ai/suggest' && $method === 'POST') AiController::suggest();
if ($path === '/api/announcements' && $method === 'GET') AnnouncementController::list();
if ($path === '/api/contact' && $method === 'POST') ContactController::create();
if ($path === '/api/blog' && $method === 'GET') BlogController::listPublic();
if ($path === '/api/blog' && $method === 'POST') BlogController::create();
if ($path === '/api/blog/my' && $method === 'GET') BlogController::myPosts();
if ($path === '/api/admin/blogs' && $method === 'GET') BlogController::adminList();
if (preg_match('~^/api/admin/blogs/(\\d+)$~', $path, $m) && in_array($method, ['PATCH','POST'])) {
  BlogController::adminUpdate($m[1]);
}

if ($path === '/api/doctors/search' && $method === 'GET') DoctorController::search();
if (preg_match('~^/api/doctor/patients/(\\d+)$~', $path, $m) && $method === 'GET') {
  DoctorController::patientDetails($m[1]);
}
if ($path === '/api/appointments/slots' && $method === 'GET') AppointmentController::slots();
if ($path === '/api/appointments/booking-fee' && $method === 'GET') AppointmentController::bookingFee();
if ($path === '/api/appointments/book' && $method === 'POST') AppointmentController::book();
if ($path === '/api/appointments' && $method === 'GET') AppointmentController::list();
if (preg_match('~^/api/appointments/(\\d+)/qr$~', $path, $m) && $method === 'GET') {
  AppointmentController::qrToken($m[1]);
}
if ($path === '/api/appointments/qr/checkin' && $method === 'POST') {
  AppointmentController::checkInByQr();
}
if (preg_match('~^/api/appointments/(\\d+)/queue$~', $path, $m) && $method === 'GET') {
  AppointmentController::queueStatus($m[1]);
}
if (preg_match('~^/api/appointments/(\\d+)/video$~', $path, $m) && in_array($method, ['PATCH','POST'])) {
  AppointmentController::updateVideo($m[1]);
}
if (preg_match('~^/api/appointments/(\\d+)/status$~', $path, $m) && in_array($method, ['PATCH','POST'])) {
  AppointmentController::updateStatus($m[1]);
}

if ($path === '/api/labs' && $method === 'GET') LabController::listLabs();
if ($path === '/api/lab/tests' && $method === 'GET') LabController::tests();
if ($path === '/api/lab/orders' && $method === 'POST') LabController::createOrder();
if ($path === '/api/lab/orders' && $method === 'GET') LabController::listOrders();
if (preg_match('~^/api/lab/orders/(\\d+)/tests$~', $path, $m) && in_array($method, ['PATCH','POST'])) {
  LabController::updateOrderTests($m[1]);
}
if ($path === '/api/lab/profile' && $method === 'GET') LabController::profile();
if ($path === '/api/lab/profile' && in_array($method, ['PATCH','POST'])) LabController::updateProfile();
if ($path === '/api/lab/departments' && $method === 'GET') LabController::departments();
if ($path === '/api/lab/departments' && $method === 'POST') LabController::createDepartment();
if ($path === '/api/lab/my-tests' && $method === 'GET') LabController::myTests();
if ($path === '/api/lab/tests' && $method === 'POST') LabController::createTest();
if (preg_match('~^/api/lab/tests/(\\d+)$~', $path, $m) && in_array($method, ['PATCH','POST'])) {
  LabController::updateTest($m[1]);
}
if ($path === '/api/lab/packages' && $method === 'GET') LabController::myPackages();
if ($path === '/api/lab/packages' && $method === 'POST') LabController::createPackage();
if (preg_match('~^/api/lab/packages/(\\d+)$~', $path, $m) && in_array($method, ['PATCH','POST'])) {
  LabController::updatePackage($m[1]);
}
if ($path === '/api/lab/reports' && $method === 'POST') LabReportController::upload();
if ($path === '/api/lab/reports' && $method === 'GET') LabReportController::list();

if ($path === '/api/prescriptions' && $method === 'POST') PrescriptionController::create();
if ($path === '/api/prescriptions' && $method === 'GET') PrescriptionController::list();

if ($path === '/api/pharmacy/prescriptions' && $method === 'GET') PharmacistController::listPrescriptions();
if ($path === '/api/pharmacy/medicines' && $method === 'GET') PharmacistController::listMedicines();
if ($path === '/api/pharmacy/medicines' && $method === 'POST') PharmacistController::createMedicine();
if ($path === '/api/pharmacy/profile' && $method === 'GET') PharmacistController::profile();
if ($path === '/api/pharmacy/profile' && in_array($method, ['PATCH','POST'])) PharmacistController::updateProfile();
if ($path === '/api/pharmacies' && $method === 'GET') PharmacistController::listPharmacies();
if (preg_match('~^/api/pharmacy/prescriptions/(\\d+)/dispense$~', $path, $m) && in_array($method, ['POST','PATCH'])) {
  PharmacistController::dispense($m[1]);
}

if ($path === '/api/receptionist/profile' && $method === 'GET') ReceptionistController::getProfile();
if ($path === '/api/receptionist/queue' && $method === 'GET') ReceptionistController::queue();
if ($path === '/api/receptionist/walkin' && $method === 'POST') ReceptionistController::walkin();
if ($path === '/api/receptionist/sessions' && $method === 'GET') ReceptionistController::sessions();
if ($path === '/api/receptionist/override' && $method === 'POST') ReceptionistController::overrideCapacity();
if ($path === '/api/receptionist/patient-search' && $method === 'GET') ReceptionistController::patientSearch();
if ($path === '/api/receptionist/handover' && $method === 'GET') ReceptionistController::handoverList();
if ($path === '/api/receptionist/handover' && $method === 'POST') ReceptionistController::handoverCreate();

if ($path === '/api/doctor/clinics' && $method === 'GET') DoctorScheduleController::clinics();
if ($path === '/api/doctor/schedules' && $method === 'GET') DoctorScheduleController::list();
if ($path === '/api/doctor/schedules' && $method === 'POST') DoctorScheduleController::create();
if (preg_match('~^/api/doctor/schedules/(\\d+)$~', $path, $m) && in_array($method, ['PATCH','POST'])) {
  DoctorScheduleController::update($m[1]);
}

if ($path === '/api/doctor/leaves' && $method === 'GET') DoctorLeaveController::list();
if ($path === '/api/doctor/leaves' && $method === 'POST') DoctorLeaveController::create();
if ($path === '/api/doctor/profile' && $method === 'GET') DoctorProfileController::profile();
if ($path === '/api/doctor/profile' && in_array($method, ['PATCH','POST'])) DoctorProfileController::updateProfile();

if ($path === '/api/clinics' && $method === 'GET') ClinicController::list();
if ($path === '/api/clinics' && $method === 'POST') ClinicController::create();
if (preg_match('~^/api/clinics/(\\d+)$~', $path, $m) && in_array($method, ['PATCH','POST'])) {
  ClinicController::update($m[1]);
}

if ($path === '/api/guest-doctors' && $method === 'GET') GuestDoctorController::list();
if ($path === '/api/guest-doctors' && $method === 'POST') GuestDoctorController::create();

if ($path === '/api/notifications' && $method === 'GET') NotificationController::list();

if ($path === '/api/admin/verifications' && $method === 'GET') AdminController::verifications();
if ($path === '/api/admin/verify' && $method === 'POST') AdminController::verify();
if ($path === '/api/admin/messages' && $method === 'GET') AdminMessagesController::list();
if (preg_match('~^/api/admin/messages/(\\d+)$~', $path, $m) && in_array($method, ['PATCH','POST'])) {
  AdminMessagesController::update($m[1]);
}
if ($path === '/api/admin/announcements' && $method === 'GET') AdminAnnouncementsController::list();
if ($path === '/api/admin/announcements' && $method === 'POST') AdminAnnouncementsController::create();
if ($path === '/api/admin/stats' && $method === 'GET') AdminStatsController::stats();
if ($path === '/api/admin/audit-logs' && $method === 'GET') AuditLogsController::list();

if ($path === '/api/org/permissions' && $method === 'GET') OrgRoleController::permissions();
if ($path === '/api/org/roles' && $method === 'GET') OrgRoleController::listRoles();
if ($path === '/api/org/roles' && $method === 'POST') OrgRoleController::createRole();
if ($path === '/api/org/staff' && $method === 'GET') OrgRoleController::listStaff();
if ($path === '/api/org/staff' && $method === 'POST') OrgRoleController::createStaff();

if ($path === '/api/patient/profile' && $method === 'GET') PatientController::profile();
if ($path === '/api/patient/profile' && in_array($method, ['PATCH','POST'])) PatientController::updateProfile();
if ($path === '/api/patient/vitals' && $method === 'GET') PatientController::vitals();
if ($path === '/api/patient/insurance' && $method === 'GET') PatientController::insuranceList();
if ($path === '/api/patient/insurance' && $method === 'POST') PatientController::insuranceCreate();
if ($path === '/api/vitals' && $method === 'POST') VitalsController::create();

if ($path === '/api/payments/paytm/initiate' && $method === 'POST') PaymentController::initiatePaytm();
if ($path === '/api/payments/paytm/status' && $method === 'GET') PaymentController::paytmStatus();
if ($path === '/api/payments/paytm/callback' && $method === 'POST') PaymentController::paytmCallback();
if ($path === '/api/payments/razorpay/initiate' && $method === 'POST') PaymentController::initiateRazorpay();
if ($path === '/api/payments/razorpay/status' && $method === 'GET') PaymentController::razorpayStatus();
if ($path === '/api/payments/razorpay/webhook' && $method === 'POST') PaymentController::razorpayWebhook();
if ($path === '/api/payments/stripe/initiate' && $method === 'POST') PaymentController::initiateStripe();
if ($path === '/api/payments/stripe/status' && $method === 'GET') PaymentController::stripeStatus();
if ($path === '/api/payments/stripe/webhook' && $method === 'POST') PaymentController::stripeWebhook();

json_response(['error' => 'Not Found'], 404);
