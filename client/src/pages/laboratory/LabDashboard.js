import React, { useEffect, useState } from 'react';
import { ClipboardList, FlaskConical, FileText, Activity } from 'lucide-react';
import { labAPI } from '../../utils/api';

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

export default function LabDashboard() {
  const [stats, setStats] = useState({ tests: 0, pending: 0, completed: 0, total_orders: 0 });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([labAPI.getOrders(), labAPI.getTests()])
      .then(([ordersRes, testsRes]) => {
        const orders = ordersRes.data?.orders || [];
        const tests = testsRes.data?.tests || [];
        const pending = orders.filter(o => ['pending', 'accepted', 'sample_collected', 'processing'].includes(o.status)).length;
        const completed = orders.filter(o => o.status === 'completed').length;

        setStats({ tests: tests.length, pending, completed, total_orders: orders.length });
        setRecentOrders(orders.slice(0, 8));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="stats-grid">
        <StatCard icon={FlaskConical} color="#7C3AED" label="Active Tests" value={stats.tests} />
        <StatCard icon={Activity} color="#0A7EA4" label="Pending Orders" value={stats.pending} />
        <StatCard icon={FileText} color="#00B894" label="Completed Orders" value={stats.completed} />
        <StatCard icon={ClipboardList} color="#F59E0B" label="Total Orders" value={stats.total_orders} />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Recent Lab Orders</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : recentOrders.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No lab orders yet.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Status</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.patient_name}</td>
                      <td>{order.doctor_name}</td>
                      <td><span className="badge badge-purple">{order.status}</span></td>
                      <td>{order.total_amount ? `INR ${order.total_amount}` : '-'}</td>
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
