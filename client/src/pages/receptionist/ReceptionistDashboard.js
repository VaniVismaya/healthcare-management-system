import React, { useEffect, useState } from 'react';
import { Calendar, Activity, CheckCircle, ClipboardList } from 'lucide-react';
import { appointmentAPI, receptionistAPI } from '../../utils/api';
import { todayLocalDate, normalizeAppointmentDate, appointmentSortKey } from '../../utils/appointmentDate';

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

export default function ReceptionistDashboard() {
  const [stats, setStats] = useState({ today_total: 0, checked_in: 0, pending: 0, completed: 0 });
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = todayLocalDate();
    setLoading(true);
    Promise.all([
      receptionistAPI.getDashboard(),
      appointmentAPI.getAll({ date: today }),
    ])
      .then(([statsRes, apptRes]) => {
        setStats(statsRes.data || {});
        setTodayAppointments(
          (apptRes.data?.appointments || [])
            .map((appt) => ({
              ...appt,
              normalized_date: normalizeAppointmentDate(appt.appointment_date),
            }))
            .sort((a, b) => appointmentSortKey(a).localeCompare(appointmentSortKey(b)) || (a.queue_number || 0) - (b.queue_number || 0))
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="stats-grid">
        <StatCard icon={Calendar} color="#0A7EA4" label="Today Total" value={stats.today_total || 0} />
        <StatCard icon={Activity} color="#F59E0B" label="Pending" value={stats.pending || 0} />
        <StatCard icon={CheckCircle} color="#00B894" label="Checked In" value={stats.checked_in || 0} />
        <StatCard icon={ClipboardList} color="#7C3AED" label="Completed" value={stats.completed || 0} />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Today's Appointments</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : todayAppointments.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No appointments for today.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Status</th>
                    <th>Queue</th>
                  </tr>
                </thead>
                <tbody>
                  {todayAppointments.slice(0, 10).map((appt) => (
                    <tr key={appt.id}>
                      <td>{formatTime(appt.appointment_time)}</td>
                      <td>{appt.patient_name}</td>
                      <td>{appt.doctor_name}</td>
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
    </div>
  );
}
