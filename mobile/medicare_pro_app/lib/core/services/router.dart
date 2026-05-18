import 'package:flutter/material.dart';
import '../features/doctor/doctor_appointments.dart';
import '../features/doctor/assign_lab_tests.dart';
import '../features/doctor/prescription_create.dart';
import '../features/doctor/doctor_schedule.dart';
import '../features/doctor/doctor_leaves.dart';
import '../features/doctor/doctor_patient_details.dart';
import '../features/doctor/doctor_clinics.dart';
import '../features/doctor/guest_doctors.dart';
import '../features/doctor/doctor_profile.dart';
import '../features/doctor/doctor_lab_orders.dart';
import '../features/doctor/doctor_lab_reports.dart';
import '../features/patient/patient_prescriptions.dart';
import '../features/patient/patient_lab_orders.dart';
import '../features/patient/patient_lab_reports.dart';
import '../features/lab/lab_home.dart';
import '../features/lab/lab_orders.dart';
import '../features/lab/lab_report_upload.dart';
import '../features/lab/lab_profile.dart';
import '../features/lab/lab_tests.dart';
import '../features/lab/lab_reports.dart';
import '../features/lab/lab_packages.dart';
import '../features/pharmacy/pharmacy_home.dart';
import '../features/pharmacy/pharmacy_inventory.dart';
import '../features/pharmacy/pharmacy_prescriptions.dart';
import '../features/pharmacy/pharmacy_alerts.dart';
import '../features/pharmacy/pharmacy_profile.dart';
import '../features/shared/notifications_page.dart';
import '../features/shared/staff_roles.dart';
import '../features/shared/staff_accounts.dart';
import '../features/shared/record_vitals.dart';
import '../features/shared/ai_assistant.dart';
import '../features/shared/qr_scanner_page.dart';
import '../features/receptionist/receptionist_walkin.dart';
import '../features/receptionist/receptionist_queue.dart';
import '../features/receptionist/receptionist_capacity.dart';
import '../features/receptionist/receptionist_handover.dart';
import '../features/admin/admin_verifications.dart';
import '../features/admin/admin_messages.dart';
import '../features/admin/admin_announcements.dart';
import '../features/admin/admin_dashboard.dart';
import '../features/receptionist/receptionist_home.dart';
import '../features/admin/admin_home.dart';
import '../features/auth/role_select.dart';
import '../features/auth/login.dart';
import '../features/auth/register.dart';
import '../features/patient/patient_home.dart';
import '../features/doctor/doctor_home.dart';
import '../features/patient/book_appointment.dart';
import '../features/patient/patient_appointments.dart';
import '../features/patient/patient_profile.dart';
import '../features/patient/patient_vitals.dart';
import '../features/patient/paytm_webview.dart';
import '../features/shared/payment_webview.dart';
import '../core/models/doctor.dart';
import '../features/shared/announcements_page.dart';
import '../features/shared/contact_support.dart';
import '../features/shared/blog_list.dart';
import '../features/doctor/doctor_articles.dart';
import '../features/admin/admin_blog_reviews.dart';
import '../features/admin/admin_audit_logs.dart';

class AppRouter {
  static const roleSelect = '/';
  static const login = '/login';
  static const register = '/register';
  static const patientHome = '/patient';
  static const doctorHome = '/doctor';
  static const labHome = '/lab';
  static const pharmacyHome = '/pharmacy';
  static const pharmacyPrescriptions = '/pharmacy/prescriptions';
  static const pharmacyInventory = '/pharmacy/inventory';
  static const pharmacyAlerts = '/pharmacy/alerts';
  static const pharmacyProfile = '/pharmacy/profile';
  static const adminVerifications = '/admin/verifications';
  static const adminMessages = '/admin/messages';
  static const adminAnnouncements = '/admin/announcements';
  static const adminDashboard = '/admin/dashboard';
  static const notifications = '/notifications';
  static const staffRoles = '/staff/roles';
  static const staffAccounts = '/staff/accounts';
  static const recordVitals = '/vitals/record';
  static const aiAssistant = '/ai';
  static const qrCheckin = '/qr/checkin';
  static const announcements = '/announcements';
  static const contactSupport = '/contact';
  static const blog = '/blog';
  static const doctorArticles = '/doctor/articles';
  static const adminBlogReviews = '/admin/blogs';
  static const adminAuditLogs = '/admin/audit-logs';
  static const receptionistHome = '/receptionist';
  static const receptionistWalkin = '/receptionist/walkin';
  static const receptionistQueue = '/receptionist/queue';
  static const receptionistCapacity = '/receptionist/capacity';
  static const receptionistHandover = '/receptionist/handover';
  static const adminHome = '/admin';
  static const book = '/patient/book';
  static const patientAppointments = '/patient/appointments';
  static const paytmWebView = '/patient/paytm';
  static const paymentWebView = '/payment/webview';
  static const patientPrescriptions = '/patient/prescriptions';
  static const patientLabOrders = '/patient/lab-orders';
  static const patientLabReports = '/patient/lab-reports';
  static const patientProfile = '/patient/profile';
  static const patientVitals = '/patient/vitals';
  static const doctorAppointments = '/doctor/appointments';
  static const doctorAssignLab = '/doctor/assign-lab';
  static const doctorPrescriptions = '/doctor/prescriptions/new';
  static const doctorLabOrders = '/doctor/lab-orders';
  static const doctorLabReports = '/doctor/lab-reports';
  static const doctorSchedule = '/doctor/schedule';
  static const doctorLeaves = '/doctor/leaves';
  static const doctorPatientDetails = '/doctor/patient';
  static const doctorClinics = '/doctor/clinics';
  static const doctorGuests = '/doctor/guests';
  static const doctorProfile = '/doctor/profile';
  static const labOrders = '/lab/orders';
  static const labReportUpload = '/lab/reports/upload';
  static const labProfile = '/lab/profile';
  static const labTests = '/lab/tests';
  static const labReports = '/lab/reports';
  static const labPackages = '/lab/packages';

  static Route<dynamic> onGenerate(RouteSettings settings) {
    switch (settings.name) {
      case roleSelect:
        return MaterialPageRoute(builder: (_) => const RoleSelectPage());
      case login:
        final role = settings.arguments as String? ?? 'patient';
        return MaterialPageRoute(builder: (_) => LoginPage(role: role));
      case register:
        final role = settings.arguments as String? ?? 'patient';
        return MaterialPageRoute(builder: (_) => RegisterPage(role: role));
      case patientHome:
        return MaterialPageRoute(builder: (_) => const PatientHomePage());
      case doctorHome:
        return MaterialPageRoute(builder: (_) => const DoctorHomePage());
      case labHome:
        return MaterialPageRoute(builder: (_) => const LabHomePage());
      case pharmacyHome:
        return MaterialPageRoute(builder: (_) => const PharmacyHomePage());
      case pharmacyPrescriptions:
        return MaterialPageRoute(builder: (_) => const PharmacyPrescriptionsPage());
      case pharmacyInventory:
        return MaterialPageRoute(builder: (_) => const PharmacyInventoryPage());
      case pharmacyAlerts:
        return MaterialPageRoute(builder: (_) => const PharmacyAlertsPage());
      case pharmacyProfile:
        return MaterialPageRoute(builder: (_) => const PharmacyProfilePage());
      case notifications:
        return MaterialPageRoute(builder: (_) => const NotificationsPage());
      case announcements:
        return MaterialPageRoute(builder: (_) => const AnnouncementsPage());
      case contactSupport:
        return MaterialPageRoute(builder: (_) => const ContactSupportPage());
      case blog:
        return MaterialPageRoute(builder: (_) => const BlogListPage());
      case staffRoles:
        return MaterialPageRoute(builder: (_) => const StaffRolesPage());
      case staffAccounts:
        return MaterialPageRoute(builder: (_) => const StaffAccountsPage());
      case recordVitals:
        final args = settings.arguments as Map? ?? {};
        final appointmentId = args['appointmentId'] as int? ?? 0;
        final patientId = args['patientId'] as int? ?? 0;
        return MaterialPageRoute(
          builder: (_) => RecordVitalsPage(
            appointmentId: appointmentId,
            patientId: patientId,
          ),
        );
      case adminVerifications:
        return MaterialPageRoute(builder: (_) => const AdminVerificationsPage());
      case adminMessages:
        return MaterialPageRoute(builder: (_) => const AdminMessagesPage());
      case adminAnnouncements:
        return MaterialPageRoute(builder: (_) => const AdminAnnouncementsPage());
      case adminDashboard:
        return MaterialPageRoute(builder: (_) => const AdminDashboardPage());
      case adminBlogReviews:
        return MaterialPageRoute(builder: (_) => const AdminBlogReviewsPage());
      case adminAuditLogs:
        return MaterialPageRoute(builder: (_) => const AdminAuditLogsPage());
      case receptionistHome:
        return MaterialPageRoute(builder: (_) => const ReceptionistHomePage());
      case receptionistWalkin:
        return MaterialPageRoute(builder: (_) => const ReceptionistWalkinPage());
      case receptionistQueue:
        return MaterialPageRoute(builder: (_) => const ReceptionistQueuePage());
      case receptionistCapacity:
        return MaterialPageRoute(builder: (_) => const ReceptionistCapacityPage());
      case receptionistHandover:
        return MaterialPageRoute(builder: (_) => const ReceptionistHandoverPage());
      case adminHome:
        return MaterialPageRoute(builder: (_) => const AdminHomePage());
      case book:
        final args = settings.arguments;
        if (args is Doctor) {
          return MaterialPageRoute(builder: (_) => BookAppointmentPage(initialDoctor: args));
        }
        if (args is Map && args['doctor'] is Map) {
          final d = Doctor.fromJson((args['doctor'] as Map).cast<String, dynamic>());
          return MaterialPageRoute(builder: (_) => BookAppointmentPage(initialDoctor: d));
        }
        return MaterialPageRoute(builder: (_) => const BookAppointmentPage());
      case paytmWebView:
        final args = settings.arguments as Map? ?? {};
        return MaterialPageRoute(
          builder: (_) => PaytmWebViewPage(
            mid: args['mid'] ?? '',
            orderId: args['orderId'] ?? '',
            txnToken: args['txnToken'] ?? '',
            env: args['env'] ?? 'staging',
            callbackUrl: args['callbackUrl'] ?? '',
          ),
        );
      case paymentWebView:
        final args = settings.arguments as Map? ?? {};
        return MaterialPageRoute(
          builder: (_) => PaymentWebViewPage(
            url: args['url'] ?? '',
            callbackUrl: args['callbackUrl'] ?? '',
          ),
        );
      case patientAppointments:
        return MaterialPageRoute(builder: (_) => const PatientAppointmentsPage());
      case patientPrescriptions:
        return MaterialPageRoute(builder: (_) => const PatientPrescriptionsPage());
      case patientLabOrders:
        return MaterialPageRoute(builder: (_) => const PatientLabOrdersPage());
      case patientLabReports:
        return MaterialPageRoute(builder: (_) => const PatientLabReportsPage());
      case patientProfile:
        return MaterialPageRoute(builder: (_) => const PatientProfilePage());
      case patientVitals:
        return MaterialPageRoute(builder: (_) => const PatientVitalsPage());
      case doctorAppointments:
        return MaterialPageRoute(builder: (_) => const DoctorAppointmentsPage());
      case doctorSchedule:
        return MaterialPageRoute(builder: (_) => const DoctorSchedulePage());
      case doctorLeaves:
        return MaterialPageRoute(builder: (_) => const DoctorLeavesPage());
      case doctorPatientDetails:
        final id = settings.arguments as int;
        return MaterialPageRoute(builder: (_) => DoctorPatientDetailsPage(patientId: id));
      case doctorClinics:
        return MaterialPageRoute(builder: (_) => const DoctorClinicsPage());
      case doctorGuests:
        return MaterialPageRoute(builder: (_) => const GuestDoctorsPage());
      case doctorProfile:
        return MaterialPageRoute(builder: (_) => const DoctorProfilePage());
      case doctorArticles:
        return MaterialPageRoute(builder: (_) => const DoctorArticlesPage());
      case doctorAssignLab:
        final apptId = settings.arguments as int?;
        return MaterialPageRoute(builder: (_) => AssignLabTestsPage(appointmentId: apptId));
      case doctorPrescriptions:
        return MaterialPageRoute(builder: (_) => const DoctorPrescriptionCreatePage());
      case doctorLabOrders:
        return MaterialPageRoute(builder: (_) => const DoctorLabOrdersPage());
      case doctorLabReports:
        return MaterialPageRoute(builder: (_) => const DoctorLabReportsPage());
      case labOrders:
        return MaterialPageRoute(builder: (_) => const LabOrdersPage());
      case labReportUpload:
        return MaterialPageRoute(builder: (_) => const LabReportUploadPage());
      case labProfile:
        return MaterialPageRoute(builder: (_) => const LabProfilePage());
      case labTests:
        return MaterialPageRoute(builder: (_) => const LabTestsPage());
      case labReports:
        return MaterialPageRoute(builder: (_) => const LabReportsPage());
      case labPackages:
        return MaterialPageRoute(builder: (_) => const LabPackagesPage());
      case aiAssistant:
        return MaterialPageRoute(builder: (_) => const AiAssistantPage());
      case qrCheckin:
        return MaterialPageRoute(builder: (_) => const QrCheckInPage());
      default:
        return MaterialPageRoute(builder: (_) => const RoleSelectPage());
    }
  }
}
