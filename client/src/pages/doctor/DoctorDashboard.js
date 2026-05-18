import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, Users, FlaskConical, Activity } from 'lucide-react';
import { doctorAPI, appointmentAPI } from '../../utils/api';
import { normalizeAppointmentDate, todayLocalDate, appointmentSortKey } from '../../utils/appointmentDate';

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = ((hour + 11) % 12) + 1;
  return `${displayHour}:${m} ${suffix}`;
};

const StatCard = ({ icon: Icon, color, label, value }) => (
  <div className="stat-card">
    <div className="stat-icon" style={{ background: color }}>
      <Icon size={22} color="#fff" />
    </div>
    <div className="stat-info">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  </div>
);

export default function DoctorDashboard() {
  const [stats, setStats] = useState({ today_appointments: 0, pending_appointments: 0, total_patients: 0, pending_lab_orders: 0 });
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const today = todayLocalDate();
    setLoading(true);
    Promise.all([
      doctorAPI.getStats(),
      appointmentAPI.getAll(),
    ])
      .then(([statsRes, apptRes]) => {
        const appts = apptRes.data?.appointments || [];
        const normalizedAppts = appts.map((a) => ({
          ...a,
          normalized_date: normalizeAppointmentDate(a.appointment_date),
        }));
        const todayList = normalizedAppts.filter((a) => a.normalized_date === today);
        const upcoming = appts
          .map((a) => ({
            ...a,
            normalized_date: normalizeAppointmentDate(a.appointment_date),
          }))
          .filter((a) => a.normalized_date >= today)
          .sort((a, b) => appointmentSortKey(a).localeCompare(appointmentSortKey(b)))
          .slice(0, 12);
        setStats(statsRes.data || {});
        setTodayAppointments(todayList);
        setUpcomingAppointments(upcoming);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener('queue_update', handler);
    return () => window.removeEventListener('queue_update', handler);
  }, [load]);

  return (
    <div>
      <div className="stats-grid">
        <StatCard icon={Calendar} color="#0A7EA4" label="Today Appointments" value={stats.today_appointments || 0} />
        <StatCard icon={Activity} color="#00B894" label="Pending Appointments" value={stats.pending_appointments || 0} />
        <StatCard icon={Users} color="#7C3AED" label="Total Patients" value={stats.total_patients || 0} />
        <StatCard icon={FlaskConical} color="#F59E0B" label="Pending Lab Orders" value={stats.pending_lab_orders || 0} />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Today's Appointments</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading appointments...</div>
          ) : todayAppointments.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No appointments scheduled for today.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Patient</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Queue</th>
                  </tr>
                </thead>
                <tbody>
                  {todayAppointments.slice(0, 8).map((appt) => (
                    <tr key={appt.id}>
                      <td>{formatTime(appt.appointment_time)}</td>
                      <td>{appt.patient_name}</td>
                      <td>{appt.patient_phone}</td>
                      <td><span className="badge badge-primary">{appt.status}</span></td>
                      <td>#{appt.queue_number || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Today's Queue Timeline</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading queue...</div>
          ) : todayAppointments.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No queue for today.</div>
          ) : (
            <div style={{ borderLeft: '2px solid var(--border-light)', paddingLeft: 12 }}>
              {todayAppointments
                .slice()
                .sort((a, b) => appointmentSortKey(a).localeCompare(appointmentSortKey(b)) || (a.queue_number || 0) - (b.queue_number || 0))
                .map((a, idx) => (
                  <div key={`qt-${a.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: idx === todayAppointments.length - 1 ? 0 : 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--primary)' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        {formatTime(a.appointment_time)} - {a.patient_name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Queue #{a.queue_number || '-'}</div>
                    </div>
                    <span className="badge badge-primary">{a.status}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Today & Upcoming</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading schedule...</div>
          ) : upcomingAppointments.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No upcoming appointments.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              {upcomingAppointments.map((appt) => (
                <div key={appt.id} className="card" style={{ border: '1px solid var(--border-light)' }}>
                  <div className="card-body" style={{ padding: 14 }}>
                    <div style={{ fontWeight: 700 }}>{appt.patient_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{appt.normalized_date || normalizeAppointmentDate(appt.appointment_date)} - {formatTime(appt.appointment_time)}</div>
                    <div style={{ marginTop: 8 }} className="badge badge-primary">{appt.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
