import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { appointmentAPI, pharmacistAPI, prescriptionAPI } from '../../utils/api';
import { clearDraft, loadDraft, saveDraft } from '../../utils/draftStorage';

const freqOptions = ['1-0-1', '1-1-1', '0-1-0', '1-0-0', '0-0-1', '0-1-1', '1-1-0'];

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const parts = String(timeStr).split(':');
  const h = parts[0];
  const m = parts[1] || '00';
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = ((hour + 11) % 12) + 1;
  return `${displayHour}:${m} ${suffix}`;
};

const formatSession = (appt) => {
  if (!appt) return '';
  const labelRaw = appt.session_label || 'Session';
  const label = /session/i.test(labelRaw) ? labelRaw : `${labelRaw} Session`;
  const start = appt.session_start_time ? formatTime(appt.session_start_time) : formatTime(appt.appointment_time);
  const end = appt.session_end_time ? formatTime(appt.session_end_time) : '';
  return end ? `${label} (${start} - ${end})` : `${label} (${start})`;
};
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

export default function DoctorPrescription() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const draftKey = `doctor_prescription_draft_${appointmentId || 'new'}`;
  const missingAppointment = !appointmentId || appointmentId === 'new';
  const [appointment, setAppointment] = useState(null);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [form, setForm] = useState({ diagnosis: '', notes: '', follow_up_date: '' });
  const [pharmacies, setPharmacies] = useState([]);
  const [pharmacySearch, setPharmacySearch] = useState({ name: '', city: '' });
  const [nearMe, setNearMe] = useState(false);
  const [radiusKm, setRadiusKm] = useState(10);
  const [geo, setGeo] = useState({ status: 'idle', lat: null, lng: null, error: '' });
  const [loadingPharmacies, setLoadingPharmacies] = useState(false);

  useEffect(() => {
    const draft = loadDraft(draftKey);
    if (!draft) return;
    if (draft.form) setForm((prev) => ({ ...prev, ...draft.form }));
    if (Array.isArray(draft.medicines)) setMedicines(draft.medicines);
    if (draft.pharmacySearch) setPharmacySearch((prev) => ({ ...prev, ...draft.pharmacySearch }));
    if (draft.radiusKm) setRadiusKm(Number(draft.radiusKm) || 10);
  }, [draftKey]);

  useEffect(() => {
    saveDraft(draftKey, { form, medicines, pharmacySearch, radiusKm });
  }, [draftKey, form, medicines, pharmacySearch, radiusKm]);

  useEffect(() => {
    if (missingAppointment) return;
    appointmentAPI.getAll()
      .then(({ data }) => {
        const appt = (data.appointments || []).find((a) => String(a.id) === String(appointmentId));
        setAppointment(appt || null);
      })
      .catch(() => {});
  }, [appointmentId, missingAppointment]);

  useEffect(() => {
    if (!query) return setSuggestions([]);
    const timer = setTimeout(() => {
      pharmacistAPI.searchMedicines(query)
        .then(({ data }) => setSuggestions(data.medicines || []))
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

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
        if (city) setPharmacySearch((prev) => ({ ...prev, city: prev.city || city }));
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

  const loadPharmacies = async () => {
    setLoadingPharmacies(true);
    try {
      const params = { name: pharmacySearch.name, city: pharmacySearch.city };
      if (nearMe && geo.status === 'ready' && geo.lat && geo.lng) {
        params.latitude = geo.lat;
        params.longitude = geo.lng;
        params.radius_km = radiusKm;
      }
      const { data } = await pharmacistAPI.searchPharmacies(params);
      setPharmacies(data.pharmacies || []);
    } catch {
      toast.error('Failed to search pharmacies');
      setPharmacies([]);
    } finally {
      setLoadingPharmacies(false);
    }
  };

  const addMedicine = (med) => {
    setMedicines((prev) => [
      ...prev,
      {
        medicine_id: med?.id || null,
        medicine_name: med ? `${med.name} ${med.strength || ''}`.trim() : '',
        dosage: med?.strength || '',
        frequency: '1-0-1',
        morning: 1,
        afternoon: 0,
        evening: 1,
        before_food: false,
        duration_days: 5,
        quantity: 10,
        instructions: '',
      }
    ]);
    setQuery('');
    setSuggestions([]);
  };

  const updateMedicine = (idx, key, value) => {
    setMedicines((prev) => prev.map((m, i) => (i === idx ? { ...m, [key]: value } : m)));
  };

  const submit = async () => {
    if (!appointment) return toast.error('Appointment not found');
    if (!form.diagnosis) return toast.error('Diagnosis is required');
    if (medicines.length === 0) return toast.error('Add at least one medicine');

    try {
      const { data } = await prescriptionAPI.create({
        appointment_id: appointment.id,
        diagnosis: form.diagnosis,
        notes: form.notes,
        follow_up_date: form.follow_up_date || null,
        medicines,
      });
      clearDraft(draftKey);
      toast.success(data?.offlineQueued ? 'Prescription saved offline and queued for sync' : 'Prescription created');
      navigate('/doctor/appointments');
    } catch {
      toast.error('Failed to create prescription');
    }
  };

  if (missingAppointment) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title">Prescription</div>
        </div>
        <div className="card-body">
          <div style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
            Select an appointment to create a prescription.
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/doctor/appointments')}>
            Go to Appointments
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Prescription</div>
        </div>
        <div className="card-body">
          {appointment ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700 }}>{appointment.patient_name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {appointment.appointment_date} - {formatSession(appointment)} - {appointment.clinic_name}
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>Loading appointment...</div>
          )}

          <div className="form-group">
            <label className="form-label">Diagnosis<span className="required">*</span></label>
            <input className="form-input" value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="form-group" style={{ maxWidth: 240 }}>
            <label className="form-label">Follow-up Date</label>
            <input className="form-input" type="date" value={form.follow_up_date} onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })} />
          </div>
          <div className="form-hint">This form auto-saves as a draft on this device while you work.</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Medicines</div>
        </div>
        <div className="card-body">
          <div className="form-group" style={{ position: 'relative' }}>
            <label className="form-label">Search Medicine</label>
            <input className="form-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type medicine name" />
            {suggestions.length > 0 && (
              <div style={{ position: 'absolute', top: 70, left: 0, right: 0, background: '#fff', border: '1px solid var(--border-light)', borderRadius: 8, zIndex: 10 }}>
                {suggestions.map((s) => (
                  <div key={s.id} style={{ padding: 10, cursor: 'pointer' }} onClick={() => addMedicine(s)}>
                    {s.name} {s.strength} - {s.brand_name || s.generic_name || ''} - Stock: {s.stock_quantity}
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={() => addMedicine(null)}>Add Manual Medicine</button>
          </div>

          {medicines.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No medicines added.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Dosage</th>
                    <th>Frequency</th>
                    <th>Before Food</th>
                    <th>Days</th>
                    <th>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {medicines.map((m, idx) => (
                    <tr key={idx}>
                      <td>
                        <input className="form-input" value={m.medicine_name} onChange={(e) => updateMedicine(idx, 'medicine_name', e.target.value)} />
                      </td>
                      <td>
                        <input className="form-input" value={m.dosage} onChange={(e) => updateMedicine(idx, 'dosage', e.target.value)} />
                      </td>
                      <td>
                        <select className="form-select" value={m.frequency} onChange={(e) => updateMedicine(idx, 'frequency', e.target.value)}>
                          {freqOptions.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </td>
                      <td>
                        <input type="checkbox" checked={m.before_food} onChange={(e) => updateMedicine(idx, 'before_food', e.target.checked)} />
                      </td>
                      <td>
                        <input className="form-input" type="number" value={m.duration_days} onChange={(e) => updateMedicine(idx, 'duration_days', Number(e.target.value))} />
                      </td>
                      <td>
                        <input className="form-input" type="number" value={m.quantity} onChange={(e) => updateMedicine(idx, 'quantity', Number(e.target.value))} />
                      </td>
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
          <div className="card-title">Nearby Pharmacies</div>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Pharmacy Name</label>
              <input className="form-input" value={pharmacySearch.name} onChange={(e) => setPharmacySearch({ ...pharmacySearch, name: e.target.value })} placeholder="e.g. HealthPlus" />
            </div>
            <div className="form-group">
              <label className="form-label">City</label>
              <input className="form-input" value={pharmacySearch.city} onChange={(e) => setPharmacySearch({ ...pharmacySearch, city: e.target.value })} placeholder="Auto-filled if GPS is on" />
            </div>
          </div>
          <div className="form-grid" style={{ alignItems: 'end', marginTop: 6 }}>
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
              <button className="btn btn-outline" onClick={loadPharmacies} disabled={loadingPharmacies}>
                {loadingPharmacies ? 'Searching...' : 'Search Pharmacies'}
              </button>
            </div>
          </div>

          {pharmacies.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', marginTop: 10 }}>Search to see pharmacies.</div>
          ) : (
            <div className="table-container" style={{ marginTop: 10 }}>
              <table>
                <thead>
                  <tr>
                    <th>Pharmacy</th>
                    <th>Photo</th>
                    <th>City</th>
                    {nearMe && <th>Distance</th>}
                    <th>Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {pharmacies.map((p) => (
                    <tr key={p.id}>
                      <td>{p.pharmacy_name || p.name}</td>
                      <td>
                        {p.photos && p.photos.length ? (
                          <img src={p.photos[0]} alt="Pharmacy" style={{ width: 42, height: 32, borderRadius: 8, objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>â€”</span>
                        )}
                      </td>
                      <td>{p.city || '-'}</td>
                      {nearMe && <td>{p.distance_km ? `${Number(p.distance_km).toFixed(1)} km` : '-'}</td>}
                      <td>{p.phone || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <button className="btn btn-primary" onClick={submit}>Create Prescription</button>
    </div>
  );
}



