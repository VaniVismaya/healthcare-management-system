import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import axios from 'axios';
import { appointmentAPI, labAPI } from '../../utils/api';
import { clearDraft, loadDraft, saveDraft } from '../../utils/draftStorage';

const DOCTOR_LAB_ORDER_DRAFT_KEY = 'doctor_lab_order_draft';

const reverseGeocodeCity = async (lat, lng) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
    if (!res.ok) return '';
    const data = await res.json();
    const addr = data?.address || {};
    return addr.city || addr.town || addr.village || addr.state_district || addr.county || addr.state || '';
  } catch {
    return '';
  }
};

const apiBase = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

export default function DoctorLabOrders() {
  const [params] = useSearchParams();
  const preselectId = params.get('appointmentId');
  const [orders, setOrders] = useState([]);
  const [reports, setReports] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [labs, setLabs] = useState([]);
  const [tests, setTests] = useState([]);
  const [selectedTests, setSelectedTests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    appointment_id: '',
    laboratory_id: '',
    manual_tests: '',
    collection_required: false,
    collection_date: '',
    collection_time: '',
    collection_address: '',
    collection_notes: ''
  });
  const [loading, setLoading] = useState(true);
  const [labSearch, setLabSearch] = useState({ city: '' });
  const [nearMe, setNearMe] = useState(false);
  const [radiusKm, setRadiusKm] = useState(10);
  const [geo, setGeo] = useState({ status: 'idle', lat: null, lng: null, error: '' });
  const [hydratingDraft, setHydratingDraft] = useState(true);

  const loadLabs = async () => {
    try {
      const params = {};
      if (labSearch.city) params.city = labSearch.city;
      if (nearMe && geo.status === 'ready' && geo.lat && geo.lng) {
        params.latitude = geo.lat;
        params.longitude = geo.lng;
        params.radius_km = radiusKm;
      }
      const { data } = await labAPI.search(params);
      setLabs(data?.labs || []);
    } catch {
      setLabs([]);
    }
  };

  const load = () => {
    setLoading(true);
    Promise.all([labAPI.getOrders(), appointmentAPI.getAll(), labAPI.getReports()])
      .then(([ordersRes, apptsRes, reportsRes]) => {
        const appts = apptsRes.data?.appointments || [];
        const draft = loadDraft(DOCTOR_LAB_ORDER_DRAFT_KEY);
        setOrders(ordersRes.data?.orders || []);
        setAppointments(appts);
        setReports(reportsRes.data?.reports || []);
        if (draft?.form) {
          setForm((prev) => ({
            ...prev,
            ...draft.form,
            appointment_id: draft.form.appointment_id ?? prev.appointment_id,
            laboratory_id: draft.form.laboratory_id ?? prev.laboratory_id,
          }));
          setSelectedTests(Array.isArray(draft.selectedTests) ? draft.selectedTests : []);
          setLabSearch(draft.labSearch || { city: '' });
          setNearMe(!!draft.nearMe);
          setRadiusKm(Number(draft.radiusKm) || 10);
          if (draft.form.laboratory_id) {
            loadTests(draft.form.laboratory_id);
          }
        } else if (preselectId) {
          const found = appts.find((a) => String(a.id) === String(preselectId));
          if (found) {
            setForm((prev) => ({ ...prev, appointment_id: String(found.id) }));
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        loadLabs()
          .finally(() => {
            setHydratingDraft(false);
            setLoading(false);
          });
      });
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (hydratingDraft) return;
    saveDraft(DOCTOR_LAB_ORDER_DRAFT_KEY, {
      form,
      selectedTests,
      labSearch,
      nearMe,
      radiusKm,
    });
  }, [form, selectedTests, labSearch, nearMe, radiusKm, hydratingDraft]);

  const handleEnableNearMe = () => {
    if (!navigator.geolocation) {
      toast.error('GPS not supported on this device');
      return;
    }
    setGeo({ status: 'loading', lat: null, lng: null, error: '' });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGeo({ status: 'ready', lat, lng, error: '' });
        const city = await reverseGeocodeCity(lat, lng);
        if (city) setLabSearch((prev) => ({ ...prev, city: prev.city || city }));
        toast.success('Location detected');
      },
      (err) => {
        setGeo({ status: 'error', lat: null, lng: null, error: err.message || 'Location access denied' });
        setNearMe(false);
        toast.error('Location access denied');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const toggleNearMe = () => {
    const next = !nearMe;
    setNearMe(next);
    if (next) handleEnableNearMe();
  };

  const loadTests = async (labId) => {
    if (!labId) return setTests([]);
    try {
      const { data } = await labAPI.getTests(labId);
      setTests(data.tests || []);
    } catch {
      toast.error('Failed to load lab tests');
    }
  };

  const selectedLab = labs.find((l) => String(l.id) === String(form.laboratory_id));

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

  const submit = async () => {
    if (!form.appointment_id) return toast.error('Select appointment');
    if (!form.laboratory_id && !form.manual_tests) return toast.error('Select a lab or enter manual tests');
    try {
      const payload = {
        appointment_id: Number(form.appointment_id),
        laboratory_id: form.laboratory_id ? Number(form.laboratory_id) : null,
        test_ids: selectedTests,
        manual_tests: form.manual_tests ? form.manual_tests.split(',').map(t => t.trim()).filter(Boolean) : null,
        collection_required: form.collection_required,
        collection_date: form.collection_date || null,
        collection_time: form.collection_time || null,
        collection_address: form.collection_address || null,
        collection_notes: form.collection_notes || null,
      };
      await labAPI.assignOrder(payload);
      toast.success('Lab order assigned');
      clearDraft(DOCTOR_LAB_ORDER_DRAFT_KEY);
      setForm({
        appointment_id: '',
        laboratory_id: '',
        manual_tests: '',
        collection_required: false,
        collection_date: '',
        collection_time: '',
        collection_address: '',
        collection_notes: ''
      });
      setSelectedTests([]);
      setTests([]);
      load();
    } catch {
      toast.error('Failed to assign order');
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Assign Lab Tests</div>
        </div>
        <div className="card-body">
          <div className="form-hint" style={{ marginBottom: 12 }}>
            Lab order details are saved locally on this device while you work offline and will be ready when internet returns.
          </div>
          <div className="form-grid" style={{ marginBottom: 12, alignItems: 'end' }}>
            <div className="form-group">
              <label className="form-label">City (optional)</label>
              <input className="form-input" value={labSearch.city} onChange={(e) => setLabSearch({ ...labSearch, city: e.target.value })} placeholder="Auto-filled if GPS is on" />
            </div>
            <div className="form-group">
              <label className="form-label">Near Me (GPS)</label>
              <button className={`btn ${nearMe ? 'btn-primary' : 'btn-outline'}`} onClick={toggleNearMe} disabled={geo.status === 'loading'}>
                {geo.status === 'loading' ? 'Detecting...' : nearMe ? 'Near Me Enabled' : 'Use My Location'}
              </button>
              {geo.status === 'error' && (
                <div className="form-hint" style={{ color: '#B91C1C' }}>{geo.error || 'Location error'}</div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Radius (km)</label>
              <select className="form-select" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} disabled={!nearMe || geo.status !== 'ready'}>
                {[5, 10, 15, 25, 50].map((r) => (
                  <option key={r} value={r}>{r} km</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <button className="btn btn-outline" onClick={loadLabs}>Search Labs</button>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Appointment<span className="required">*</span></label>
              <select className="form-select" value={form.appointment_id} onChange={(e) => setForm({ ...form, appointment_id: e.target.value })}>
                <option value="">Select Appointment</option>
                {appointments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.patient_name} - {a.appointment_date} {a.appointment_time}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Laboratory</label>
              <select
                className="form-select"
                value={form.laboratory_id}
                onChange={(e) => {
                  const labId = e.target.value;
                  setForm({ ...form, laboratory_id: labId });
                  setSelectedTests([]);
                  loadTests(labId);
                }}
              >
                <option value="">Select Lab (optional)</option>
                {labs.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.lab_name} - {l.city}{nearMe && l.distance_km ? ` - ${Number(l.distance_km).toFixed(1)} km` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedLab && selectedLab.photos && selectedLab.photos.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Lab Photos</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {selectedLab.photos.slice(0, 4).map((p, idx) => (
                  <img key={`${selectedLab.id}-ph-${idx}`} src={p} alt="Lab" style={{ width: 60, height: 44, borderRadius: 10, objectFit: 'cover' }} />
                ))}
              </div>
            </div>
          )}

          {tests.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Select Tests</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {tests.map((t) => (
                  <label key={t.id} className="badge badge-gray" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedTests.includes(t.id)}
                      onChange={(e) => {
                        setSelectedTests((prev) => e.target.checked ? [...prev, t.id] : prev.filter((x) => x !== t.id));
                      }}
                      style={{ marginRight: 6 }}
                    />
                    {t.test_name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Manual Tests (comma separated)</label>
            <textarea className="form-textarea" value={form.manual_tests} onChange={(e) => setForm({ ...form, manual_tests: e.target.value })} />
          </div>

          <div className="form-group" style={{ marginTop: 8 }}>
            <label className="form-label">Home Sample Collection</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={!!form.collection_required}
                onChange={(e) => setForm({ ...form, collection_required: e.target.checked })}
              />
              Enable home sample collection for this order
            </label>
          </div>

          {form.collection_required && (
            <>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Collection Date</label>
                  <input className="form-input" type="date" value={form.collection_date} onChange={(e) => setForm({ ...form, collection_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Collection Time</label>
                  <input className="form-input" type="time" value={form.collection_time} onChange={(e) => setForm({ ...form, collection_time: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Collection Address</label>
                <input className="form-input" value={form.collection_address} onChange={(e) => setForm({ ...form, collection_address: e.target.value })} placeholder="Home address for collection" />
              </div>
              <div className="form-group">
                <label className="form-label">Collection Notes</label>
                <textarea className="form-textarea" value={form.collection_notes} onChange={(e) => setForm({ ...form, collection_notes: e.target.value })} />
              </div>
            </>
          )}

          <button className="btn btn-primary" onClick={submit}>Assign Tests</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Lab Orders</div>
        </div>
        <div className="card-body">
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
                    <th>Lab</th>
                    <th>Status</th>
                    <th>Collection</th>
                    <th>Amount</th>
                    <th>Type</th>
                    <th>Tests</th>
                    <th>Reports</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.patient_name}</td>
                      <td>{o.lab_name || 'Manual'}</td>
                      <td><span className="badge badge-primary">{o.status}</span></td>
                      <td>
                        {o.collection_required ? (
                          <div style={{ fontSize: 12 }}>
                            {o.collection_date || '-'} {o.collection_time || ''}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                      <td>{o.total_amount ? `INR ${o.total_amount}` : '-'}</td>
                      <td>{o.order_type}</td>
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


