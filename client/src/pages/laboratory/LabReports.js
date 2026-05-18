import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { labAPI } from '../../utils/api';
import { clearDraft, loadDraft, saveDraft } from '../../utils/draftStorage';

const apiBase = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

export default function LabReports() {
  const draftKey = 'lab_report_upload_draft';
  const [orders, setOrders] = useState([]);
  const [reports, setReports] = useState([]);
  const [orderTests, setOrderTests] = useState([]);
  const [form, setForm] = useState({ lab_order_id: '', report_title: '', test_id: '', result_value: '', result_unit: '' });
  const [summaryRows, setSummaryRows] = useState([]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const draft = loadDraft(draftKey);
    if (!draft) return;
    if (draft.form) setForm((prev) => ({ ...prev, ...draft.form }));
    if (Array.isArray(draft.summaryRows)) setSummaryRows(draft.summaryRows);
  }, []);

  useEffect(() => {
    saveDraft(draftKey, { form, summaryRows });
  }, [draftKey, form, summaryRows]);

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

  useEffect(() => {
    if (!form.lab_order_id) return;
    const order = orders.find((o) => String(o.id) === String(form.lab_order_id));
    setOrderTests(order?.test_items || []);
  }, [orders, form.lab_order_id]);

  const upload = async () => {
    if (!form.lab_order_id || !file) return toast.error('Select order and report file');
    const fd = new FormData();
    fd.append('lab_order_id', form.lab_order_id);
    if (form.test_id) fd.append('test_id', form.test_id);
    if (form.report_title) fd.append('report_title', form.report_title);
    if (form.result_value) fd.append('result_value', form.result_value);
    if (form.result_unit) fd.append('result_unit', form.result_unit);
    if (summaryRows.length) {
      const trimmed = summaryRows
        .map((r) => ({
          test_id: r.test_id || null,
          result_name: r.result_name || '',
          result_value: r.result_value || '',
          result_unit: r.result_unit || '',
          normal_range: r.normal_range || ''
        }))
        .filter((r) => r.test_id || r.result_name || r.result_value);
      if (trimmed.length) fd.append('summary_results', JSON.stringify(trimmed));
    }
    fd.append('report', file);
    try {
      await labAPI.uploadReport(fd);
      toast.success('Report uploaded');
      setForm({ lab_order_id: '', report_title: '', test_id: '', result_value: '', result_unit: '' });
      setSummaryRows([]);
      setFile(null);
      setOrderTests([]);
      clearDraft(draftKey);
      load();
    } catch {
      toast.error('Upload failed');
    }
  };

  const addSummaryRow = () => {
    if (summaryRows.length >= 5) return toast.error('Maximum 5 results');
    setSummaryRows((prev) => ([
      ...prev,
      { key: `${Date.now()}-${prev.length}`, test_id: '', result_name: '', result_value: '', result_unit: '', normal_range: '' }
    ]));
  };

  const updateSummaryRow = (idx, patch) => {
    setSummaryRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const removeSummaryRow = (idx) => {
    setSummaryRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const summaryText = (r) => {
    if (!r) return '';
    const name = r.result_name || r.test_name || r.report_title || 'Result';
    const val = r.result_value ? `${r.result_value}${r.result_unit ? ` ${r.result_unit}` : ''}` : '';
    const flag = r.result_flag ? `(${r.result_flag})` : '';
    return [name, val, flag].filter(Boolean).join(' ');
  };

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

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Upload Report</div>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Lab Order<span className="required">*</span></label>
              <select
                className="form-select"
                value={form.lab_order_id}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm({ ...form, lab_order_id: value, test_id: '' });
                  const order = orders.find((o) => String(o.id) === String(value));
                  setOrderTests(order?.test_items || []);
                  setSummaryRows([]);
                }}
              >
                <option value="">Select Order</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>{o.patient_name} - {o.doctor_name}</option>
                ))}
              </select>
            </div>
                        <div className="form-group">
              <label className="form-label">Test (optional)</label>
              <select
                className="form-select"
                value={form.test_id}
                onChange={(e) => setForm({ ...form, test_id: e.target.value })}
                disabled={!orderTests.length}
              >
                <option value="">Select Test</option>
                {orderTests.map((t) => (
                  <option key={t.test_id} value={t.test_id}>
                    {t.test_name}{t.normal_range ? ` (Range: ${t.normal_range})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Report Title</label>
              <input className="form-input" value={form.report_title} onChange={(e) => setForm({ ...form, report_title: e.target.value })} />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Result Value</label>
              <input className="form-input" value={form.result_value} onChange={(e) => setForm({ ...form, result_value: e.target.value })} placeholder="e.g., 13.5" />
            </div>
            <div className="form-group">
              <label className="form-label">Unit</label>
              <input className="form-input" value={form.result_unit} onChange={(e) => setForm({ ...form, result_unit: e.target.value })} placeholder="e.g., g/dL" />
            </div>
          </div>
          <div className="card" style={{ margin: '12px 0', border: '1px dashed var(--border)' }}>
            <div className="card-header">
              <div className="card-title">Key Result Summary (optional)</div>
              <button className="btn btn-outline btn-sm" onClick={addSummaryRow}>Add Result</button>
            </div>
            <div className="card-body">
              {summaryRows.length === 0 ? (
                <div style={{ color: 'var(--text-muted)' }}>Add 2–5 key results (Hb, TSH, Sugar…)</div>
              ) : (
                summaryRows.map((row, idx) => (
                  <div key={row.key} className="form-grid" style={{ marginBottom: 10 }}>
                    <div className="form-group">
                      <label className="form-label">Test</label>
                      <select
                        className="form-select"
                        value={row.test_id || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const test = orderTests.find((t) => String(t.test_id) === String(val));
                          updateSummaryRow(idx, {
                            test_id: val,
                            result_name: test?.test_name || row.result_name,
                            normal_range: test?.normal_range || row.normal_range
                          });
                        }}
                      >
                        <option value="">Select Test</option>
                        {orderTests.map((t) => (
                          <option key={t.test_id} value={t.test_id}>{t.test_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Result Name</label>
                      <input className="form-input" value={row.result_name} onChange={(e) => updateSummaryRow(idx, { result_name: e.target.value })} placeholder="e.g., Hb" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Value</label>
                      <input className="form-input" value={row.result_value} onChange={(e) => updateSummaryRow(idx, { result_value: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Unit</label>
                      <input className="form-input" value={row.result_unit} onChange={(e) => updateSummaryRow(idx, { result_unit: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Normal Range</label>
                      <input className="form-input" value={row.normal_range} onChange={(e) => updateSummaryRow(idx, { normal_range: e.target.value })} placeholder="e.g., 12-16" />
                    </div>
                    <div className="form-group" style={{ alignSelf: 'end' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => removeSummaryRow(idx)}>Remove</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Report File<span className="required">*</span></label>
            <input className="form-input" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <div className="form-hint">Draft values are saved locally, but report files must be attached again after reconnecting.</div>
          </div>
          <button className="btn btn-primary" onClick={upload}>Upload</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Uploaded Reports</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : reports.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No reports uploaded yet.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Test</th>
                    <th>Result</th>
                    <th>Uploaded</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id}>
                      <td>{r.patient_name}</td>
                      <td>{r.doctor_name}</td>
                      <td>{r.test_name || r.report_title || 'Report'}</td>
                      <td>
                        {(r.summary_results && r.summary_results.length) ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {r.summary_results.slice(0, 3).map((s, idx) => (
                              <span key={`${r.id}-s-${idx}`} className={`badge ${s.result_flag === 'normal' ? 'badge-success' : s.result_flag ? 'badge-warning' : 'badge-gray'}`}>
                                {summaryText(s)}
                              </span>
                            ))}
                          </div>
                        ) : r.result_value ? (
                          <span className={`badge ${r.result_flag === 'normal' ? 'badge-success' : r.result_flag ? 'badge-warning' : 'badge-gray'}`}>
                            {r.result_value}{r.result_unit ? ` ${r.result_unit}` : ''} {r.result_flag ? `(${r.result_flag})` : ''}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                      <td>{String(r.created_at).slice(0, 10)}</td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={() => viewReport(r.id)}>View</button>
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





