import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { I18nProvider } from './context/I18nContext';
import { OfflineProvider } from './context/OfflineContext';
import './assets/styles/global.css';

// Auth Pages
import RoleSelect from './pages/auth/RoleSelect';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Public Pages
import LandingPage from './pages/public/LandingPage';
import BlogList from './pages/public/BlogList';
import BlogPost from './pages/public/BlogPost';
import StaticPage from './pages/public/StaticPage';

// Layouts
import DashboardLayout from './components/common/DashboardLayout';
import OfflineStatusBar from './components/common/OfflineStatusBar';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminVerifications from './pages/admin/AdminVerifications';
import AdminClinics from './pages/admin/AdminClinics';
import AdminPlans from './pages/admin/AdminPlans';
import AdminMessages from './pages/admin/AdminMessages';
import AdminReports from './pages/admin/AdminReports';
import AdminAuditLogs from './pages/admin/AdminAuditLogs';
import AdminAnnouncements from './pages/admin/AdminAnnouncements';
import AdminArticles from './pages/admin/AdminArticles';
import AdminMasters from './pages/admin/AdminMasters';
import RoleSubscriptionPlans from './pages/common/RoleSubscriptionPlans';

// Doctor Pages
import DoctorDashboard from './pages/doctor/DoctorDashboard';
import DoctorAppointments from './pages/doctor/DoctorAppointments';
import DoctorProfile from './pages/doctor/DoctorProfile';
import DoctorClinics from './pages/doctor/DoctorClinics';
import DoctorConsultationFees from './pages/doctor/DoctorConsultationFees';
import DoctorSchedule from './pages/doctor/DoctorSchedule';
import DoctorPrescription from './pages/doctor/DoctorPrescription';
import DoctorLabOrders from './pages/doctor/DoctorLabOrders';
import DoctorArticles from './pages/doctor/DoctorArticles';
import PatientDetails from './pages/doctor/PatientDetails';
import GuestDoctors from './pages/doctor/GuestDoctors';
import DoctorStaffRoles from './pages/doctor/DoctorStaffRoles';

// Patient Pages
import PatientDashboard from './pages/patient/PatientDashboard';
import BookAppointment from './pages/patient/BookAppointment';
import PatientAppointments from './pages/patient/PatientAppointments';
import PatientProfile from './pages/patient/PatientProfile';
import PatientClinics from './pages/patient/PatientClinics';
import PatientLabOrders from './pages/patient/PatientLabOrders';
import PatientPrescriptions from './pages/patient/PatientPrescriptions';

// Lab Pages
import LabDashboard from './pages/laboratory/LabDashboard';
import LabProfile from './pages/laboratory/LabProfile';
import LabTests from './pages/laboratory/LabTests';
import LabOrders from './pages/laboratory/LabOrders';
import LabReports from './pages/laboratory/LabReports';
import LabStaffRoles from './pages/laboratory/LabStaffRoles';

// Pharmacist Pages
import PharmacistDashboard from './pages/pharmacist/PharmacistDashboard';
import PharmacistProfile from './pages/pharmacist/PharmacistProfile';
import MedicineInventory from './pages/pharmacist/MedicineInventory';
import StockAlerts from './pages/pharmacist/StockAlerts';
import PharmacistPrescriptions from './pages/pharmacist/PharmacistPrescriptions';
import PharmacyStaffRoles from './pages/pharmacist/PharmacyStaffRoles';

// Receptionist Pages
import ReceptionistDashboard from './pages/receptionist/ReceptionistDashboard';
import ReceptionistAppointments from './pages/receptionist/ReceptionistAppointments';
import ReceptionistHandover from './pages/receptionist/ReceptionistHandover';

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-page"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
};

const RoleRedirect = () => {
  const { user } = useAuth();
  const routes = { admin: '/admin', doctor: '/doctor', patient: '/patient', laboratory: '/lab', pharmacist: '/pharmacist', receptionist: '/receptionist' };
  return <Navigate to={routes[user?.role] || '/login'} replace />;
};

const App = () => (
  <I18nProvider>
    <AuthProvider>
      <OfflineProvider>
        <BrowserRouter>
          <Toaster position="top-right" toastOptions={{ duration: 4000, style: { fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13.5px' } }} />
          <OfflineStatusBar />
          <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/roles" element={<RoleSelect />} />
        <Route path="/blog" element={<BlogList />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/faq" element={<StaticPage pageKey="faq" />} />
        <Route path="/policies" element={<StaticPage pageKey="policies" />} />
        <Route path="/terms" element={<StaticPage pageKey="terms" />} />
        <Route path="/privacy" element={<StaticPage pageKey="privacy" />} />
        <Route path="/grievance" element={<StaticPage pageKey="grievance" />} />
        <Route path="/refunds" element={<StaticPage pageKey="refunds" />} />
        <Route path="/security" element={<StaticPage pageKey="security" />} />
        <Route path="/about" element={<StaticPage pageKey="about" />} />
        <Route path="/corporate-plans" element={<StaticPage pageKey="corporate" />} />
        <Route path="/testimonials" element={<StaticPage pageKey="testimonials" />} />
        <Route path="/contact" element={<StaticPage pageKey="contact" />} />
        <Route path="/careers" element={<StaticPage pageKey="careers" />} />
        <Route path="/medical-travel" element={<StaticPage pageKey="medicalTravel" />} />
        <Route path="/beliefs" element={<StaticPage pageKey="beliefs" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<ProtectedRoute><RoleRedirect /></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin" element={<ProtectedRoute roles={['admin']}><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="verifications" element={<AdminVerifications />} />
          <Route path="clinics" element={<AdminClinics />} />
          <Route path="plans" element={<AdminPlans />} />
          <Route path="messages" element={<AdminMessages />} />
          <Route path="medical-masters" element={<AdminMasters />} />
          <Route path="articles" element={<AdminArticles />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="audit-logs" element={<AdminAuditLogs />} />
          <Route path="announcements" element={<AdminAnnouncements />} />
        </Route>

        {/* Doctor */}
        <Route path="/doctor" element={<ProtectedRoute roles={['doctor']}><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<DoctorDashboard />} />
          <Route path="appointments" element={<DoctorAppointments />} />
          <Route path="profile" element={<DoctorProfile />} />
          <Route path="clinics" element={<DoctorClinics />} />
          <Route path="consultation-fees" element={<DoctorConsultationFees />} />
          <Route path="plans" element={<RoleSubscriptionPlans />} />
          <Route path="schedule" element={<DoctorSchedule />} />
          <Route path="prescription/:appointmentId" element={<DoctorPrescription />} />
          <Route path="lab-orders" element={<DoctorLabOrders />} />
          <Route path="articles" element={<DoctorArticles />} />
          <Route path="patient/:id" element={<PatientDetails />} />
          <Route path="guest-doctors" element={<GuestDoctors />} />
          <Route path="staff-roles" element={<DoctorStaffRoles />} />
        </Route>

        {/* Patient */}
        <Route path="/patient" element={<ProtectedRoute roles={['patient']}><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<PatientDashboard />} />
          <Route path="book" element={<BookAppointment />} />
          <Route path="clinics" element={<PatientClinics />} />
          <Route path="appointments" element={<PatientAppointments />} />
          <Route path="profile" element={<PatientProfile />} />
          <Route path="plans" element={<RoleSubscriptionPlans />} />
          <Route path="lab-orders" element={<PatientLabOrders />} />
          <Route path="prescriptions" element={<PatientPrescriptions />} />
        </Route>

        {/* Lab */}
        <Route path="/lab" element={<ProtectedRoute roles={['laboratory']}><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<LabDashboard />} />
          <Route path="profile" element={<LabProfile />} />
          <Route path="tests" element={<LabTests />} />
          <Route path="orders" element={<LabOrders />} />
          <Route path="reports" element={<LabReports />} />
          <Route path="plans" element={<RoleSubscriptionPlans />} />
          <Route path="staff-roles" element={<LabStaffRoles />} />
        </Route>

        {/* Pharmacist */}
        <Route path="/pharmacist" element={<ProtectedRoute roles={['pharmacist']}><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<PharmacistDashboard />} />
          <Route path="profile" element={<PharmacistProfile />} />
          <Route path="inventory" element={<MedicineInventory />} />
          <Route path="alerts" element={<StockAlerts />} />
          <Route path="prescriptions" element={<PharmacistPrescriptions />} />
          <Route path="plans" element={<RoleSubscriptionPlans />} />
          <Route path="staff-roles" element={<PharmacyStaffRoles />} />
        </Route>

        {/* Receptionist */}
        <Route path="/receptionist" element={<ProtectedRoute roles={['receptionist']}><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<ReceptionistDashboard />} />
          <Route path="appointments" element={<ReceptionistAppointments />} />
          <Route path="handover" element={<ReceptionistHandover />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </OfflineProvider>
    </AuthProvider>
  </I18nProvider>
);

export default App;
