import React, { useEffect, useState, useCallback } from 'react';
import { adminAPI } from '../../utils/api';
import { Users, Calendar, Building2, ShieldCheck, FlaskConical, Pill, Stethoscope, User, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const StatCard = ({ icon: Icon, label, value, color, bg }) => (
  <div className="stat-card">
    <div className="stat-icon" style={{ background: bg }}>
      <Icon size={22} color={color} />
    </div>
    <div className="stat-info">
      <div className="stat-value">{value ?? '-'}</div>
      <div className="stat-label">{label}</div>
    </div>
  </div>
);

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    adminAPI.getDashboard().then(({ data }) => setStats(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener('admin_counts_refresh', handler);
    return () => window.removeEventListener('admin_counts_refresh', handler);
  }, [load]);

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;

  const roleData = stats?.role_breakdown || [];
  const COLORS = ['#0A7EA4', '#00B894', '#7C3AED', '#F59E0B', '#EF4444'];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Admin Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Overview of the MediCare Pro platform</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard icon={Users} label="Total Users" value={stats?.total_users} color="#0A7EA4" bg="#E8F4F8" />
        <StatCard icon={ShieldCheck} label="Pending Verifications" value={stats?.pending_verifications} color="#F59E0B" bg="#FEF3C7" />
        <StatCard icon={Calendar} label="Total Appointments" value={stats?.total_appointments} color="#00B894" bg="#E8F8F4" />
        <StatCard icon={Calendar} label="Today's Appointments" value={stats?.today_appointments} color="#7C3AED" bg="#F3EDFE" />
        <StatCard icon={Building2} label="Total Clinics" value={stats?.total_clinics} color="#EF4444" bg="#FEE2E2" />
        <StatCard icon={Stethoscope} label="Doctors" value={stats?.total_doctors} color="#0A7EA4" bg="#E8F4F8" />
        <StatCard icon={FlaskConical} label="Laboratories" value={stats?.total_labs} color="#7C3AED" bg="#F3EDFE" />
        <StatCard icon={Pill} label="Pharmacists" value={stats?.total_pharmacists} color="#F59E0B" bg="#FEF3C7" />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 4 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">User Distribution</span></div>
          <div className="card-body">
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={roleData} dataKey="count" nameKey="role" cx="50%" cy="50%" outerRadius={100} label={({ role, count }) => `${role}: ${count}`}>
                    {roleData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Quick Actions</span>
          </div>
          <div className="card-body">
            {stats?.pending_verifications > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#FEF3C7', borderRadius: 'var(--radius-md)', marginBottom: 12 }}>
                <AlertCircle size={20} color="#F59E0B" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{stats.pending_verifications} pending verifications</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Review and verify new registrations</div>
                </div>
                <a href="/admin/verifications" className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }}>Review</a>
              </div>
            )}
            {stats?.pending_clinics > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#E8F4F8', borderRadius: 'var(--radius-md)' }}>
                <Building2 size={20} color="#0A7EA4" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{stats.pending_clinics} clinics pending</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Verify clinic registrations</div>
                </div>
                <a href="/admin/clinics" className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }}>Review</a>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
              {[
                { label: 'Users Directory', href: '/admin/users', icon: Users },
                { label: 'Verification Requests', href: '/admin/verifications', icon: ShieldCheck },
                { label: 'Clinics & Branches', href: '/admin/clinics', icon: Building2 },
                { label: 'Plans & Billing', href: '/admin/plans', icon: User },
              ].map((item) => (
                <a key={item.href} href={item.href} className="btn btn-outline" style={{ justifyContent: 'flex-start', gap: 8 }}>
                  <item.icon size={15} /> {item.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
