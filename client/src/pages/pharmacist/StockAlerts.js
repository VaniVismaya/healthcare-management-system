import React, { useEffect, useState } from 'react';
import { pharmacistAPI } from '../../utils/api';

const alertBadge = (type) => {
  if (type === 'out_of_stock') return 'badge-danger';
  if (type === 'low_stock') return 'badge-warning';
  if (type === 'expiring_soon') return 'badge-purple';
  return 'badge-secondary';
};

export default function StockAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await pharmacistAPI.getStockAlerts();
      setAlerts(data.alerts || []);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Stock Alerts</div>
      </div>
      <div className="card-body">
        {loading ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
        ) : alerts.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>No alerts.</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Strength</th>
                  <th>Quantity</th>
                  <th>Low Alert</th>
                  <th>Expiry</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}</td>
                    <td>{a.strength || '-'}</td>
                    <td>{a.quantity ?? '-'}</td>
                    <td>{a.low_stock_alert ?? '-'}</td>
                    <td>{a.expiry_date ? String(a.expiry_date).slice(0, 10) : '-'}</td>
                    <td>
                      <span className={`badge ${alertBadge(a.alert_type)}`}>
                        {a.alert_type?.replace('_', ' ')}
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
  );
}
