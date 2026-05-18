import React, { useEffect, useState } from 'react';
import { Package, AlertTriangle, FileText, Activity } from 'lucide-react';
import { pharmacistAPI } from '../../utils/api';

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

export default function PharmacistDashboard() {
  const [stats, setStats] = useState({ total_medicines: 0, out_of_stock: 0, low_stock: 0, pending_prescriptions: 0 });
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([pharmacistAPI.getDashboard(), pharmacistAPI.getStockAlerts()])
      .then(([statsRes, alertsRes]) => {
        setStats(statsRes.data || {});
        setAlerts(alertsRes.data?.alerts || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="stats-grid">
        <StatCard icon={Package} color="#0A7EA4" label="Total Medicines" value={stats.total_medicines || 0} />
        <StatCard icon={AlertTriangle} color="#EF4444" label="Out of Stock" value={stats.out_of_stock || 0} />
        <StatCard icon={Activity} color="#F59E0B" label="Low Stock" value={stats.low_stock || 0} />
        <StatCard icon={FileText} color="#00B894" label="Pending Prescriptions" value={stats.pending_prescriptions || 0} />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Stock Alerts</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : alerts.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No stock alerts right now.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Strength</th>
                    <th>Quantity</th>
                    <th>Alert</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.slice(0, 8).map((a) => (
                    <tr key={a.id}>
                      <td>{a.name}</td>
                      <td>{a.strength || '-'}</td>
                      <td>{a.quantity}</td>
                      <td>
                        <span className={`badge ${a.alert_type === 'out_of_stock' ? 'badge-danger' : 'badge-warning'}`}>
                          {a.alert_type.replace('_', ' ')}
                        </span>
                      </td>
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
