import axios from 'axios';
import toast from 'react-hot-toast';
import { SHOW_DEMO_UI } from '../config/demoUi';
import {
  canQueueOfflineRequest,
  cacheGetResponse,
  flushOfflineQueue,
  getCachedResponse,
  queueOfflineRequest,
} from './offline';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 30000,
});

const isDemoAdminRequestBlocked = (config) => {
  const method = String(config?.method || 'get').toLowerCase();
  if (['get', 'head', 'options'].includes(method)) return false;

  try {
    const raw = localStorage.getItem('medicare_user');
    const user = raw ? JSON.parse(raw) : null;
    if (!user?.is_demo_admin) return false;
  } catch {
    return false;
  }

  const url = String(config?.url || '');
  return url.startsWith('/admin') || url.startsWith('/blogs');
};

// Request interceptor - attach token
api.interceptors.request.use((config) => {
  if (isDemoAdminRequestBlocked(config)) {
    toast.error(SHOW_DEMO_UI ? 'Demo admin is read-only. Editing is disabled for this account.' : 'This account is read-only. Editing is disabled.');
    return Promise.reject({
      isDemoAdminBlocked: true,
      response: {
        status: 403,
        data: {
          error: 'Demo admin is read-only. Editing is disabled for this account.',
          code: 'DEMO_ADMIN_READ_ONLY',
        },
      },
      config,
    });
  }
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (error) => Promise.reject(error));

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => {
    cacheGetResponse(response.config, response);
    return response;
  },
  async (error) => {
    const original = error.config;

    if (!error.response) {
      const cached = getCachedResponse(original);
      if (cached) {
        toast.success('Showing saved data from offline cache');
        return cached;
      }

      if (canQueueOfflineRequest(original)) {
        const queued = queueOfflineRequest(original);
        toast.success('Saved offline. It will sync when internet returns.');
        return Promise.resolve({
          data: {
            success: true,
            offlineQueued: true,
            queuedAt: queued.queuedAt,
            queueId: queued.id,
            message: 'Saved offline. It will sync automatically when internet returns.',
          },
          status: 202,
          statusText: 'Accepted',
          headers: {},
          config: original,
          request: { fromOfflineQueue: true },
        });
      }
    }

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem('refresh_token');
        const { data } = await axios.post(`${process.env.REACT_APP_API_URL}/auth/refresh`, { refresh_token: refresh });
        localStorage.setItem('access_token', data.tokens.access);
        localStorage.setItem('refresh_token', data.tokens.refresh);
        original.headers.Authorization = `Bearer ${data.tokens.access}`;
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    const msg = error.response?.data?.error || 'Something went wrong';
    if (error.response?.status !== 401) toast.error(msg);
    return Promise.reject(error);
  }
);

export default api;
export const syncOfflineRequests = () => flushOfflineQueue(api);

// Auth
export const authAPI = {
  sendOtp: (phone, purpose) => api.post('/auth/send-otp', { phone, purpose }),
  verifyOtp: (phone, otp, firebaseIdToken) => api.post('/auth/verify-otp', { phone, otp, firebase_id_token: firebaseIdToken }),
  register: (data) => api.post('/auth/register', data),
  login: (phone, password, role) => api.post('/auth/login', { phone, password, role }),
  loginOtp: (phone, otp, role, firebaseIdToken) => api.post('/auth/login-otp', { phone, otp, role, firebase_id_token: firebaseIdToken }),
  getMe: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
};

// Doctor
export const doctorAPI = {
  setupProfile: (data) => api.post('/doctors/setup-profile', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getProfile: (id) => api.get(id ? `/doctors/${id}/profile` : '/doctors/profile'),
  getConsultationFees: () => api.get('/doctors/consultation-fees'),
  getApplicableConsultationFee: (params) => api.get('/doctors/consultation-fees/applicable', { params }),
  saveConsultationFee: (data) => api.post('/doctors/consultation-fees', data),
  deleteConsultationFee: (id) => api.delete(`/doctors/consultation-fees/${id}`),
  search: (params) => api.get('/doctors/search', { params }),
  getStats: () => api.get('/doctors/dashboard-stats'),
  getSchedule: (params) => api.get('/doctors/schedule', { params }),
  getScheduleOverrides: (params) => api.get('/doctors/schedule-overrides', { params }),
  getLeaves: (params) => api.get('/doctors/leaves', { params }),
  addGuestDoctor: (data) => api.post('/doctors/add-guest-doctor', data),
  getGuestDoctors: () => api.get('/doctors/guest-doctors'),
  requestVerification: () => api.post('/doctors/request-verification'),
  setSchedule: (data) => api.post('/doctors/schedule', data),
  saveScheduleOverride: (data) => api.post('/doctors/schedule-overrides', data),
  markLeave: (data) => api.post('/doctors/leave', data),
  deleteScheduleOverride: (id) => api.delete(`/doctors/schedule-overrides/${id}`),
  getPatientDetails: (id) => api.get(`/doctors/patient/${id}`),
};

// Appointment
export const appointmentAPI = {
  getSlots: (params) => api.get('/appointments/slots', { params }),
  getBookingFee: () => api.get('/appointments/booking-fee'),
  book: (data) => api.post('/appointments/book', data),
  walkIn: (data) => api.post('/appointments/walk-in', data),
  getAll: (params) => api.get('/appointments', { params }),
  getQueueTimeline: (params) => api.get('/appointments/queue', { params }),
  getQr: (id) => api.get(`/appointments/${id}/qr`),
  checkInQr: (token) => api.post('/appointments/qr/checkin', { token }),
  updateStatus: (id, data) => api.patch(`/appointments/${id}/status`, data),
  requeue: (id) => api.post(`/appointments/${id}/requeue`),
  recordVitals: (id, data) => api.post(`/appointments/${id}/vitals`, data),
};

// Payments (Paytm)
export const paymentAPI = {
  initiatePaytm: (data) => api.post('/payments/paytm/initiate', data),
  getPaytmStatus: (orderId) => api.get('/payments/paytm/status', { params: { order_id: orderId } }),
  initiateRazorpay: (data) => api.post('/payments/razorpay/initiate', data),
  getRazorpayStatus: (orderId) => api.get('/payments/razorpay/status', { params: { order_id: orderId } }),
  initiateStripe: (data) => api.post('/payments/stripe/initiate', data),
  getStripeStatus: (orderId) => api.get('/payments/stripe/status', { params: { order_id: orderId } }),
};

// Clinic
export const clinicAPI = {
  create: (data) => api.post('/clinics', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getMyClinics: () => api.get('/clinics/my-clinics'),
  getReceptionists: (id) => api.get(`/clinics/${id}/receptionists`),
  getRoles: (id) => api.get(`/clinics/${id}/roles`),
  update: (id, data) => {
    const isForm = typeof FormData !== 'undefined' && data instanceof FormData;
    return api.put(`/clinics/${id}`, data, isForm ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined);
  },
  uploadPhotos: (id, data) => api.post(`/clinics/${id}/photos`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  requestVerification: (id) => api.post(`/clinics/${id}/request-verification`),
  addReceptionist: (data) => api.post('/clinics/add-receptionist', data),
  search: (params) => api.get('/clinics/search', { params }),
};

// Lab
export const labAPI = {
  setupProfile: (data) => api.post('/labs/setup-profile', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getProfile: (id) => api.get(id ? `/labs/${id}/profile` : '/labs/profile'),
  uploadPhotos: (data) => api.post('/labs/photos', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  requestVerification: () => api.post('/labs/request-verification'),
  createStaff: (data) => api.post('/labs/staff', data),
  getDepartments: () => api.get('/labs/departments'),
  createDepartment: (data) => api.post('/labs/departments', data),
  search: (params) => api.get('/labs/search', { params }),
  getTests: (labId) => api.get(labId ? `/labs/${labId}/tests` : '/labs/tests'),
  addTest: (data) => api.post('/labs/tests', data),
  updateTest: (id, data) => api.put(`/labs/tests/${id}`, data),
  assignOrder: (data) => api.post('/labs/orders/assign', data),
  getOrders: () => api.get('/labs/orders'),
  getReports: (params) => api.get('/labs/reports', { params }),
  updateOrderStatus: (id, status) => api.patch(`/labs/orders/${id}/status`, { status }),
  updateOrderTests: (id, tests) => api.patch(`/labs/orders/${id}/tests`, { tests }),
  uploadReport: (data) => api.post('/labs/reports/upload', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  viewReport: (id) => api.get(`/labs/reports/${id}/view`),
};

// Pharmacist
export const pharmacistAPI = {
  setupProfile: (data) => api.post('/pharmacists/setup-profile', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getProfile: () => api.get('/pharmacists/profile'),
  uploadPhotos: (data) => api.post('/pharmacists/photos', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  requestVerification: () => api.post('/pharmacists/request-verification'),
  createStaff: (data) => api.post('/pharmacists/staff', data),
  getDashboard: () => api.get('/pharmacists/dashboard'),
  getMedicines: () => api.get('/pharmacists/medicines'),
  addMedicine: (data) => api.post('/pharmacists/medicines', data),
  searchMedicines: (q) => api.get('/pharmacists/medicines/search', { params: { q } }),
  searchPharmacies: (params) => api.get('/pharmacists/search', { params }),
  updateStock: (data) => api.post('/pharmacists/stock/update', data),
  getStockAlerts: () => api.get('/pharmacists/stock/alerts'),
};

// Prescription
export const prescriptionAPI = {
  create: (data) => api.post('/prescriptions', data),
  getAll: () => api.get('/prescriptions'),
  getOne: (id) => api.get(`/prescriptions/${id}`),
  markDispensed: (id) => api.patch(`/prescriptions/${id}/dispense`),
};

// Patient
export const patientAPI = {
  getProfile: () => api.get('/patients/profile'),
  updateProfile: (data) => api.put('/patients/profile', data),
  search: (phone, name) => {
    if (phone && typeof phone === 'object') return api.get('/patients/search', { params: phone });
    return api.get('/patients/search', { params: { phone, name } });
  },
  getSummary: () => api.get('/patients/summary'),
  getInsurance: () => api.get('/patients/insurance'),
  addInsurance: (data) => api.post('/patients/insurance', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

// Notifications
export const notificationAPI = {
  getAll: () => api.get('/notifications'),
  readAll: () => api.patch('/notifications/read-all'),
  readOne: (id) => api.patch(`/notifications/${id}/read`),
};

// Admin
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getUsers: (params) => api.get('/admin/users', { params }),
  getUserDetails: (id) => api.get(`/admin/users/${id}`),
  getPending: () => api.get('/admin/pending-verifications'),
  getClinics: (params) => api.get('/admin/clinics', { params }),
  getClinicDetails: (id) => api.get(`/admin/clinics/${id}`),
  verifyUser: (id, data) => api.patch(`/admin/users/${id}/verify`, data),
  toggleUser: (id) => api.patch(`/admin/users/${id}/toggle-status`),
  verifyClinic: (id, data) => api.patch(`/admin/clinics/${id}/verify`, data),
  getMessages: () => api.get('/admin/contact-messages'),
  replyMessage: (id, reply) => api.patch(`/admin/contact-messages/${id}/reply`, { reply }),
  getPlans: () => api.get('/admin/plans'),
  savePlan: (data, id) => id ? api.put(`/admin/plans/${id}`, data) : api.post('/admin/plans', data),
  assignPlan: (planId, userId) => api.post(`/admin/plans/${planId}/assign`, { user_id: userId }),
  getPlanRequests: () => api.get('/admin/plan-requests'),
  updatePlanRequest: (id, data) => api.patch(`/admin/plan-requests/${id}`, data),
  getAuditLogs: (params) => api.get('/admin/audit-logs', { params }),
  getReports: (params) => api.get('/admin/reports', { params }),
  getAnnouncements: () => api.get('/admin/announcements'),
  createAnnouncement: (data) => api.post('/admin/announcements', data),
  getBookingFee: () => api.get('/admin/booking-fee'),
  setBookingFee: (data) => api.post('/admin/booking-fee', data),
};

// Blogs
export const blogAPI = {
  listPublic: () => api.get('/blogs'),
  getBySlug: (slug) => api.get(`/blogs/slug/${slug}`),
  create: (data) => api.post('/blogs', data),
  listMine: () => api.get('/blogs/mine'),
  listPending: (status) => api.get('/blogs/pending', { params: status ? { status } : {} }),
  listAdmin: (params) => api.get('/blogs/admin/all', { params }),
  createAdmin: (data) => api.post('/blogs/admin', data),
  updateAdmin: (id, data) => api.put(`/blogs/${id}`, data),
  deleteAdmin: (id) => api.delete(`/blogs/${id}`),
  updateStatus: (id, data) => api.patch(`/blogs/${id}/status`, data),
};

// Announcements (user)
export const announcementAPI = {
  getAll: (platform = 'web') => api.get('/announcements', { params: { platform } }),
};

// Org Roles (per clinic/lab/pharmacy)
export const orgRoleAPI = {
  list: (params) => api.get('/org-roles', { params }),
  create: (data) => api.post('/org-roles', data),
  updatePermissions: (id, data) => api.put(`/org-roles/${id}/permissions`, data),
  assign: (id, data) => api.post(`/org-roles/${id}/assign`, data),
};

// Departments (Medical)
export const departmentAPI = {
  list: () => api.get('/departments'),
  listAdmin: () => api.get('/admin/departments'),
  create: (data) => api.post('/admin/departments', data),
  update: (id, data) => api.put(`/admin/departments/${id}`, data),
};

export const specializationAPI = {
  list: () => api.get('/master-data/specializations'),
  listAdmin: () => api.get('/admin/specializations'),
  create: (data) => api.post('/admin/specializations', data),
  update: (id, data) => api.put(`/admin/specializations/${id}`, data),
};

export const educationAPI = {
  list: () => api.get('/master-data/educations'),
  listAdmin: () => api.get('/admin/educations'),
  create: (data) => api.post('/admin/educations', data),
  update: (id, data) => api.put(`/admin/educations/${id}`, data),
};

// Receptionist
export const receptionistAPI = {
  getDashboard: () => api.get('/receptionists/dashboard'),
  getHandover: () => api.get('/receptionists/handover'),
  createHandover: (data) => api.post('/receptionists/handover', data),
};

// Uploads
export const uploadAPI = {
  profileImage: (data) => api.post('/upload/profile-image', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const subscriptionAPI = {
  getOverview: () => api.get('/subscriptions/overview'),
  requestCustomPlan: (data) => api.post('/subscriptions/custom-request', data),
};
