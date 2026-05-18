import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { notificationAPI, clinicAPI, receptionistAPI } from '../../utils/api';
import { io } from 'socket.io-client';
import { useI18n } from '../../context/I18nContext';
import PendingVerification from './PendingVerification';
import { SHOW_DEMO_UI } from '../../config/demoUi';
import {
  LayoutDashboard, Calendar, User, Users, Building2, Clock,
  FlaskConical, Pill, FileText, Bell, LogOut, ChevronRight,
  Activity, ShieldCheck, MessageSquare, CreditCard, Package,
  AlertTriangle, Stethoscope, ClipboardList, UserCheck, Home,
  Search, Settings, X, Menu
} from 'lucide-react';

const getNavConfig = (t) => ({
  admin: [
    { label: 'Overview', items: [
      { to: '/admin', icon: LayoutDashboard, label: t('nav.admin.dashboard'), end: true },
      { to: '/admin/verifications', icon: ShieldCheck, label: t('nav.admin.verifications') },
      { to: '/admin/users', icon: Users, label: t('nav.admin.users') },
      { to: '/admin/clinics', icon: Building2, label: t('nav.admin.clinics') },
    ]},
    { label: 'Management', items: [
      { to: '/admin/plans', icon: CreditCard, label: t('nav.admin.plans') },
      { to: '/admin/messages', icon: MessageSquare, label: t('nav.admin.messages') },
      { to: '/admin/medical-masters', icon: Stethoscope, label: 'Medical Masters' },
      { to: '/admin/articles', icon: FileText, label: t('nav.admin.articles') },
      { to: '/admin/announcements', icon: Bell, label: t('nav.admin.announcements') },
      { to: '/admin/reports', icon: Activity, label: t('nav.admin.reports') },
      { to: '/admin/audit-logs', icon: ClipboardList, label: t('nav.admin.auditLogs') },
    ]},
  ],
  doctor: [
    { label: 'Overview', items: [
      { to: '/doctor', icon: LayoutDashboard, label: t('nav.doctor.dashboard'), end: true },
      { to: '/doctor/appointments', icon: Calendar, label: t('nav.doctor.appointments') },
    ]},
    { label: 'Patients', items: [
      { to: '/doctor/prescription/new', icon: FileText, label: 'Write Prescription', activeMatch: (path) => path.startsWith('/doctor/prescription') },
      { to: '/doctor/lab-orders', icon: FlaskConical, label: t('nav.doctor.labOrders') },
    ]},
    { label: 'Clinic', items: [
      { to: '/doctor/clinics', icon: Building2, label: t('nav.doctor.clinics') },
      { to: '/doctor/consultation-fees', icon: CreditCard, label: 'Consultation Fees' },
      { to: '/doctor/schedule', icon: Clock, label: t('nav.doctor.schedule') },
      { to: '/doctor/guest-doctors', icon: Users, label: t('nav.doctor.guestDoctors') },
      { to: '/doctor/staff-roles', icon: Users, label: 'Staff Roles' },
    ]},
    { label: 'Content', items: [
      { to: '/doctor/articles', icon: FileText, label: t('nav.doctor.articles') },
    ]},
    { label: 'Account', items: [
      { to: '/doctor/plans', icon: CreditCard, label: 'Plans & Billing' },
      { to: '/doctor/profile', icon: User, label: t('nav.doctor.profile') },
    ]},
  ],
  patient: [
    { label: 'Overview', items: [
      { to: '/patient', icon: Home, label: t('nav.patient.dashboard'), end: true },
      { to: '/patient/book', icon: Search, label: t('nav.patient.book') },
      { to: '/patient/clinics', icon: Building2, label: t('nav.patient.clinics') },
      { to: '/patient/appointments', icon: Calendar, label: t('nav.patient.appointments') },
    ]},
    { label: 'Health Records', items: [
      { to: '/patient/prescriptions', icon: FileText, label: t('nav.patient.prescriptions') },
      { to: '/patient/lab-orders', icon: FlaskConical, label: t('nav.patient.labOrders') },
    ]},
    { label: 'Account', items: [
      { to: '/patient/plans', icon: CreditCard, label: 'Plans & Billing' },
      { to: '/patient/profile', icon: User, label: t('nav.patient.profile') },
    ]},
  ],
  laboratory: [
    { label: 'Overview', items: [
      { to: '/lab', icon: LayoutDashboard, label: t('nav.lab.dashboard'), end: true },
      { to: '/lab/orders', icon: ClipboardList, label: t('nav.lab.orders') },
      { to: '/lab/reports', icon: FileText, label: t('nav.lab.reports') },
    ]},
    { label: 'Setup', items: [
      { to: '/lab/tests', icon: FlaskConical, label: t('nav.lab.tests') },
      { to: '/lab/profile', icon: Building2, label: t('nav.lab.profile') },
      { to: '/lab/plans', icon: CreditCard, label: 'Plans & Billing' },
      { to: '/lab/staff-roles', icon: Users, label: 'Staff Roles' },
    ]},
  ],
  pharmacist: [
    { label: 'Overview', items: [
      { to: '/pharmacist', icon: LayoutDashboard, label: t('nav.pharmacist.dashboard'), end: true },
      { to: '/pharmacist/prescriptions', icon: FileText, label: t('nav.pharmacist.prescriptions') },
    ]},
    { label: 'Inventory', items: [
      { to: '/pharmacist/inventory', icon: Package, label: t('nav.pharmacist.inventory') },
      { to: '/pharmacist/alerts', icon: AlertTriangle, label: t('nav.pharmacist.alerts') },
    ]},
    { label: 'Account', items: [
      { to: '/pharmacist/profile', icon: Building2, label: t('nav.pharmacist.profile') },
      { to: '/pharmacist/plans', icon: CreditCard, label: 'Plans & Billing' },
      { to: '/pharmacist/staff-roles', icon: Users, label: 'Staff Roles' },
    ]},
  ],
  receptionist: [
    { label: 'Overview', items: [
      { to: '/receptionist', icon: LayoutDashboard, label: t('nav.receptionist.dashboard'), end: true },
      { to: '/receptionist/appointments', icon: Calendar, label: t('nav.receptionist.appointments') },
      { to: '/receptionist/handover', icon: ClipboardList, label: 'Handover Notes' },
    ]},
  ],
});

const roleLabels = { admin: 'Super Admin', doctor: 'Doctor', patient: 'Patient', laboratory: 'Laboratory', pharmacist: 'Pharmacist', receptionist: 'Receptionist' };

const getNotificationTarget = (notification, role) => {
  const title = String(notification?.title || '').toLowerCase();
  const message = String(notification?.message || '').toLowerCase();
  const refType = String(notification?.reference_type || '').toLowerCase();
  const type = String(notification?.type || '').toLowerCase();

  if (role === 'admin') {
    if (refType === 'clinic' || title.includes('clinic')) return '/admin/clinics';
    if (type === 'verification' || title.includes('verification') || title.includes('registration')) return '/admin/verifications';
    if (title.includes('article')) return '/admin/articles';
    if (title.includes('message') || title.includes('contact')) return '/admin/messages';
    if (title.includes('announcement')) return '/admin/announcements';
    return '/admin';
  }

  if (role === 'doctor') {
    if (refType === 'clinic' || title.includes('clinic')) return '/doctor/clinics';
    if (refType === 'lab_order' || type === 'lab_order' || title.includes('lab')) return '/doctor/lab-orders';
    if (refType === 'appointment' || type === 'appointment' || title.includes('appointment') || message.includes('checked in')) return '/doctor/appointments';
    if (title.includes('prescription')) return '/doctor/appointments';
    if (title.includes('verification') || title.includes('account verified')) return '/doctor/profile';
    return '/doctor';
  }

  if (role === 'patient') {
    if (refType === 'prescription' || title.includes('prescription')) return '/patient/prescriptions';
    if (refType === 'lab_order' || type === 'lab_order' || title.includes('lab')) return '/patient/lab-orders';
    if (refType === 'appointment' || type === 'appointment' || title.includes('appointment') || title.includes('payment')) return '/patient/appointments';
    return '/patient';
  }

  if (role === 'laboratory') {
    if (title.includes('report')) return '/lab/reports';
    if (refType === 'lab_order' || type === 'lab_order' || title.includes('lab') || title.includes('order')) return '/lab/orders';
    if (title.includes('verification') || title.includes('account verified')) return '/lab/profile';
    return '/lab';
  }

  if (role === 'pharmacist') {
    if (title.includes('stock')) return '/pharmacist/alerts';
    if (refType === 'prescription' || title.includes('prescription')) return '/pharmacist/prescriptions';
    if (title.includes('verification') || title.includes('account verified')) return '/pharmacist/profile';
    return '/pharmacist';
  }

  if (role === 'receptionist') {
    if (title.includes('handover')) return '/receptionist/handover';
    if (refType === 'appointment' || type === 'appointment' || title.includes('appointment') || title.includes('queue')) return '/receptionist/appointments';
    return '/receptionist';
  }

  return '/dashboard';
};

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const notifRef = useRef();

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const navItems = getNavConfig(t)[user?.role] || [];

  useEffect(() => {
    notificationAPI.getAll().then(({ data }) => setNotifications(data.notifications)).catch(() => {});

    const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000');
    socket.emit('join_room', user?.id);

    let isMounted = true;
    const joinClinics = async () => {
      if (!user?.role) return;
      if (user.role === 'doctor') {
        try {
          const { data } = await clinicAPI.getMyClinics();
          const clinics = data.clinics || [];
          if (!isMounted) return;
          clinics.forEach((c) => socket.emit('join_clinic', c.id));
        } catch {}
      }
      if (user.role === 'receptionist') {
        try {
          const { data } = await receptionistAPI.getDashboard();
          if (!isMounted) return;
          if (data?.clinic_id) socket.emit('join_clinic', data.clinic_id);
        } catch {}
      }
    };
    joinClinics();

    socket.on('notification', (notif) => {
      setNotifications(prev => [notif, ...prev]);
    });
    socket.on('queue_update', (payload) => {
      window.dispatchEvent(new CustomEvent('queue_update', { detail: payload }));
    });
    socket.on('queue_progress', (payload) => {
      window.dispatchEvent(new CustomEvent('queue_progress', { detail: payload }));
    });
    socket.on('admin_counts_refresh', (payload) => {
      window.dispatchEvent(new CustomEvent('admin_counts_refresh', { detail: payload }));
    });

    return () => {
      isMounted = false;
      socket.disconnect();
    };
  }, [user?.id, user?.role]);

  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/'); };

  const handleNotificationClick = async (notification) => {
    setNotifications(prev =>
      prev.map((item) => (
        item.id === notification.id ? { ...item, is_read: true } : item
      ))
    );
    setShowNotif(false);

    try {
      if (!notification.is_read) {
        await notificationAPI.readOne(notification.id);
      }
    } catch {
      // Keep the UI responsive even if marking read fails server-side.
    }

    navigate(getNotificationTarget(notification, user?.role));
  };

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  const displayName = !SHOW_DEMO_UI && user?.is_demo_admin ? 'Admin Reviewer' : user?.name;
  let pageTitle = location.pathname.split('/').pop().replace(/-/g, ' ') || 'Dashboard';
  if (location.pathname.startsWith('/doctor/prescription/')) pageTitle = 'Prescription';

  const verificationBlockedRoles = ['doctor', 'laboratory', 'pharmacist'];
  const allowWhileUnverified = {
    doctor: ['/doctor/profile', '/doctor/clinics'],
    laboratory: ['/lab/profile'],
    pharmacist: ['/pharmacist/profile'],
  };
  const isVerificationBlocked = user && !user.is_verified && verificationBlockedRoles.includes(user.role);
  const isAllowedWhileUnverified = isVerificationBlocked
    ? (allowWhileUnverified[user.role] || []).some((path) => location.pathname.startsWith(path))
    : true;

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <h1>Medi<span>Care</span> Pro</h1>
          <p>Healthcare Management</p>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((section, si) => (
            <div key={si} className="nav-section">
              <div className="nav-section-label">{section.label}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => {
                    const active = item.activeMatch ? item.activeMatch(location.pathname) : isActive;
                    return `nav-item ${active ? 'active' : ''}`;
                  }}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon size={17} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {user?.profile_image ? <img src={user.profile_image} alt={user.name} /> : initials}
          </div>
          <div className="sidebar-user-info">
            <h4>{displayName}</h4>
            <p>{roleLabels[user?.role]}</p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={handleLogout} title="Logout" style={{ color: 'rgba(255,255,255,0.5)', padding: '6px' }}>
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        {/* Header */}
        <header className="page-header">
          <div className="page-header-left">
            <button className="btn btn-ghost btn-icon" onClick={() => setSidebarOpen(!sidebarOpen)} style={{ display: 'none' }}>
              <Menu size={20} />
            </button>
            <div>
              <div className="page-title" style={{ textTransform: 'capitalize' }}>{pageTitle || 'Dashboard'}</div>
            </div>
          </div>

          <div className="header-actions">
            <select className="form-select" style={{ maxWidth: 110 }} value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="en">EN</option>
              <option value="hi">HI</option>
            </select>
            {/* Notifications */}
            <div ref={notifRef} className="notif-bell" style={{ position: 'relative' }}>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowNotif(!showNotif)}>
                <Bell size={19} />
                {unreadCount > 0 && <span className="notif-dot" />}
              </button>

              {showNotif && (
                <div className="notif-dropdown">
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
                    {unreadCount > 0 && (
                      <button className="btn btn-ghost btn-sm" onClick={() => notificationAPI.readAll().then(() => setNotifications(prev => prev.map(n => ({ ...n, is_read: true }))))}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No notifications</div>
                    ) : notifications.slice(0, 10).map(n => (
                      <div
                        key={n.id}
                        className={`notif-item ${!n.is_read ? 'unread' : ''}`}
                        onClick={() => handleNotificationClick(n)}
                      >
                        <h5>{n.title}</h5>
                        <p>{n.message}</p>
                        <time>{new Date(n.created_at).toLocaleString()}</time>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Verification Warning */}
            {user && !user.is_verified && user.role !== 'patient' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FEF3C7', color: '#92400E', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600 }}>
                <AlertTriangle size={13} />
                Pending Verification
              </div>
            )}

            <div className="avatar" style={{ width: 36, height: 36, fontSize: 13, cursor: 'pointer' }} onClick={() => navigate(`/${user?.role}/profile`)}>
              {user?.profile_image ? <img src={user.profile_image} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} /> : initials}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="page-content">
          {SHOW_DEMO_UI && user?.is_demo_admin && (
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', padding: '12px 14px', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600 }}>
              <ShieldCheck size={16} />
              Demo admin mode: you can review dashboards, users, clinics, reports, and content, but all editing and verification actions are disabled.
            </div>
          )}
          {isVerificationBlocked && !isAllowedWhileUnverified ? (
            <PendingVerification role={user.role} />
          ) : (
            <Outlet />
          )}
        </div>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }} />
      )}
    </div>
  );
}
