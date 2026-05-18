import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { labAPI } from '../../utils/api';

const apiBase = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

export default function PatientLabOrders() {
  const [orders, setOrders] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([labAPI.getOrders(), labAPI.getReports()])
      .then(([ordersRes, reportsRes]) => {
        setOrders(ordersRes.data?.orders || []);
        setReports(reportsRes.data?.reports || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const viewReport = async (reportId) => {
    try {
      const { data } = await labAPI.viewReport(reportId);
      const token = localStorage.getItem('access_token');
      const url = `${apiBase}/${data.report_path.replace(/^\//, '')}`;
      const res = await axios.get(url, { responseType: 'blob', headers: { Authorization: `Bearer ${token}` } });
      const blobUrl = URL.createObjectURL(res.data);
      window.open(blobUrl, '_blank', 'noopener');
    } catch {
      toast.error('Failed to open report');
    }
  };

  const reportsByOrder = reports.reduce((acc, r) => {
    acc[r.lab_order_id] = acc[r.lab_order_id] || [];
    acc[r.lab_order_id].push(r);
    return acc;
  }, {});

  const renderTestPrice = (t) => {
    const price = t.discounted_price ?? t.price;
    if (price === null || price === undefined || price === '') return '-';
    return `INR ${price}`;
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Lab Orders & Reports</div>
      </div>
      <div className="card-body">
        {loading ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
        ) : orders.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>No lab orders found.</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Lab</th>
                  <th>Status</th>
                  <th>Collection</th>
                  <th>Amount</th>
                  <th>Tests</th>
                  <th>Reports</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.lab_name || 'Manual'}</td>
                    <td><span className="badge badge-primary">{o.status}</span></td>
                    <td>
                      {o.collection_required ? (
                        <span>{o.collection_date || '-'} {o.collection_time || ''}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td>{o.total_amount ? `INR ${o.total_amount}` : '-'}</td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => setSelected(o)}>
                        View
                      </button>
                    </td>
                    <td>
                      {(reportsByOrder[o.id] || []).length === 0 ? (
                        <span style={{ color: 'var(--text-muted)' }}>No reports</span>
                      ) : (
                        (reportsByOrder[o.id] || []).map((r) => {
                          const summary = (r.summary_results || []).map((s) => {
                            const name = s.result_name || s.test_name || 'Result';
                            const val = s.result_value ? `${s.result_value}${s.result_unit ? ` ${s.result_unit}` : ''}` : '';
                            const flag = s.result_flag ? `(${s.result_flag})` : '';
                            return [name, val, flag].filter(Boolean).join(' ');
                          }).filter(Boolean);
                          return (
                            <div key={r.id} style={{ marginBottom: 6 }}>
                              <button className="btn btn-outline btn-sm" style={{ marginRight: 6 }} onClick={() => viewReport(r.id)}>
                                {r.test_name || r.report_title || 'Report'}
                                {r.result_flag && (
                                  <span className={`badge ${r.result_flag === 'normal' ? 'badge-success' : 'badge-warning'}`} style={{ marginLeft: 6 }}>
                                    {r.result_flag}
                                  </span>
                                )}
                              </button>
                              {summary.length > 0 && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                  {summary.slice(0, 2).join(' - ')}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2>Tests & Pricing</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelected(null)}>X</button>
            </div>
            <div className="modal-body">
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                {selected.lab_name || 'Manual'} - Status: {selected.status}
              </div>
              {selected.collection_required && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Home Collection: {selected.collection_date || '-'} {selected.collection_time || ''}{selected.collection_address ? ` - ${selected.collection_address}` : ''}
                </div>
              )}
              {(selected.test_items || []).length === 0 && (!selected.manual_tests || selected.manual_tests.length === 0) ? (
                <div style={{ color: 'var(--text-muted)' }}>No tests assigned.</div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Test</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selected.test_items || []).map((t) => (
                        <tr key={`t-${t.test_id}`}>
                          <td>{t.test_name}</td>
                          <td>{renderTestPrice(t)}</td>
                          <td>
                            <span className={`badge ${t.is_completed ? 'badge-success' : 'badge-warning'}`}>
                              {t.is_completed ? 'Completed' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {(selected.manual_tests || []).map((t, idx) => (
                        <tr key={`m-${idx}`}>
                          <td>{t}</td>
                          <td>-</td>
                          <td><span className="badge badge-gray">Manual</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

