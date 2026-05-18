import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { labAPI } from '../../utils/api';

export default function LabOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewOrder, setViewOrder] = useState(null);
  const [testChecks, setTestChecks] = useState({});

  const load = () => {
    setLoading(true);
    labAPI.getOrders()
      .then(({ data }) => setOrders(data.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    try {
      await labAPI.updateOrderStatus(id, status);
      toast.success('Status updated');
      load();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const openTests = (order) => {
    const items = Array.isArray(order.test_items) ? order.test_items : [];
    const checks = {};
    items.forEach((t) => { checks[t.test_id] = !!t.is_completed; });
    setTestChecks(checks);
    setViewOrder(order);
  };

  const saveTests = async () => {
    if (!viewOrder) return;
    const items = Array.isArray(viewOrder.test_items) ? viewOrder.test_items : [];
    const payload = items.map((t) => ({
      test_id: t.test_id,
      is_completed: !!testChecks[t.test_id],
    }));
    try {
      await labAPI.updateOrderTests(viewOrder.id, payload);
      toast.success('Tests updated');
      setViewOrder(null);
      load();
    } catch {
      toast.error('Failed to update tests');
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Lab Orders</div>
      </div>
      <div className="card-body">
        {viewOrder && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.45)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16
            }}
          >
            <div style={{ width: '100%', maxWidth: 520, background: '#fff', borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Tests for {viewOrder.patient_name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                {viewOrder.lab_name} - {viewOrder.status}
              </div>
              {viewOrder.collection_required && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Home Collection: {viewOrder.collection_date || '-'} {viewOrder.collection_time || ''}{viewOrder.collection_address ? ` - ${viewOrder.collection_address}` : ''}
                </div>
              )}
              {Array.isArray(viewOrder.test_items) && viewOrder.test_items.length > 0 ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {viewOrder.test_items.map((t) => (
                    <label key={t.test_id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={!!testChecks[t.test_id]}
                        onChange={(e) => setTestChecks((prev) => ({ ...prev, [t.test_id]: e.target.checked }))}
                      />
                      <span>{t.test_name}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>No assigned tests.</div>
              )}

              {Array.isArray(viewOrder.manual_tests) && viewOrder.manual_tests.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Manual Tests</div>
                  <div style={{ fontSize: 13 }}>{viewOrder.manual_tests.join(', ')}</div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="btn btn-primary" onClick={saveTests}>Save</button>
                <button className="btn btn-ghost" onClick={() => setViewOrder(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
        {loading ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
        ) : orders.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>No lab orders yet.</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Tests</th>
                  <th>Status</th>
                  <th>Collection</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  (() => {
                    const testNames = Array.isArray(o.test_names) ? o.test_names : [];
                    const manual = Array.isArray(o.manual_tests)
                      ? o.manual_tests
                      : (o.manual_tests ? [o.manual_tests] : []);
                    const allTests = [...testNames, ...manual].filter(Boolean);
                    const testsLabel = allTests.length ? `${allTests.length} tests` : '-';
                    return (
                  <tr key={o.id}>
                    <td>{o.patient_name}</td>
                    <td>{o.doctor_name}</td>
                    <td>{testsLabel}</td>
                    <td><span className="badge badge-primary">{o.status}</span></td>
                    <td>
                      {o.collection_required ? (
                        <span>{o.collection_date || '-'} {o.collection_time || ''}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td>{o.total_amount ? `INR ${o.total_amount}` : '-'}</td>
                    <td>{o.order_type}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => openTests(o)}>View</button>
                        <select className="form-select" defaultValue="" onChange={(e) => e.target.value && updateStatus(o.id, e.target.value)}>
                          <option value="">Update</option>
                          <option value="accepted">Accept</option>
                          <option value="sample_collected">Sample Collected</option>
                          <option value="processing">Processing</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancel</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                    );
                  })()
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

