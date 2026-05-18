import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { appointmentAPI, patientAPI, receptionistAPI } from '../../utils/api';
import QrScannerModal from '../../components/common/QrScannerModal';
import PhoneInput from '../../components/common/PhoneInput';
import { clearDraft, loadDraft, saveDraft } from '../../utils/draftStorage';

const formatDate = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
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

const formatQueueNumber = (num) => {
  const n = Number(num);
  if (!Number.isFinite(n)) return '-';
  return String(n).padStart(2, '0');
};

const statusBadge = (status) => {
  if (['completed'].includes(status)) return 'badge-success';
  if (['cancelled', 'no_show'].includes(status)) return 'badge-danger';
  if (['checked_in', 'in_consultation'].includes(status)) return 'badge-warning';
  return 'badge-primary';
};

const computeNextFromAppointments = (list) => {
  const active = (list || []).filter((a) => ['pending', 'confirmed', 'checked_in'].includes(a.status));
  if (!active.length) return null;
  active.sort((a, b) => {
    const ta = String(a.session_start_time || a.appointment_time || '');
    const tb = String(b.session_start_time || b.appointment_time || '');
    if (ta === tb) return (a.queue_number || 0) - (b.queue_number || 0);
    return ta.localeCompare(tb);
  });
  const a = active[0];
  return {
    appointment_id: a.id,
    queue_number: a.queue_number,
    appointment_time: a.appointment_time,
    patient_name: a.patient_name,
    session_label: a.session_label,
    session_start_time: a.session_start_time,
    session_end_time: a.session_end_time,
    priority_level: a.priority_level
  };
};

const extractQrToken = (raw) => {
  if (!raw) return '';
  const text = String(raw).trim();
  if (!text) return '';
  if (text.includes('token=')) {
    try {
      const url = new URL(text);
      const token = url.searchParams.get('token');
      if (token) return token;
    } catch {
      const match = text.match(/token=([^&]+)/);
      if (match) return decodeURIComponent(match[1]);
    }
  }
  return text;
};

export default function ReceptionistAppointments() {
  const walkInDraftKey = 'receptionist_walkin_draft';
  const vitalsDraftKey = 'receptionist_vitals_draft';
  const [appointments, setAppointments] = useState([]);
  const [date, setDate] = useState(formatDate(new Date()));
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [clinicInfo, setClinicInfo] = useState({ clinic_id: null, doctor_id: null });
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInResults, setWalkInResults] = useState([]);
  const [walkInNotes, setWalkInNotes] = useState('');
  const [walkInPriority, setWalkInPriority] = useState('normal');
  const [nextInLine, setNextInLine] = useState(null);
  const [vitalsFor, setVitalsFor] = useState(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [vitalsForm, setVitalsForm] = useState({
    blood_pressure: '',
    pulse_rate: '',
    temperature: '',
    weight: '',
    height: '',
    oxygen_saturation: '',
    notes: '',
  });

  useEffect(() => {
    const walkInDraft = loadDraft(walkInDraftKey);
    if (walkInDraft) {
      setWalkInPhone(walkInDraft.walkInPhone || '');
      setWalkInNotes(walkInDraft.walkInNotes || '');
      setWalkInPriority(walkInDraft.walkInPriority || 'normal');
    }

    const vitalsDraft = loadDraft(vitalsDraftKey);
    if (vitalsDraft?.vitalsForm) {
      setVitalsForm((prev) => ({ ...prev, ...vitalsDraft.vitalsForm }));
    }
  }, []);

  useEffect(() => {
    saveDraft(walkInDraftKey, { walkInPhone, walkInNotes, walkInPriority });
  }, [walkInPhone, walkInNotes, walkInPriority]);

  useEffect(() => {
    if (!vitalsFor) return;
    saveDraft(vitalsDraftKey, { vitalsForId: vitalsFor.id, vitalsForm });
  }, [vitalsFor, vitalsForm]);

  const load = useCallback(() => {
    setLoading(true);
    const params = { date };
    if (statusFilter) params.status = statusFilter;
    appointmentAPI.getAll(params)
      .then(({ data }) => setAppointments(data.appointments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [date, statusFilter]);

  useEffect(() => {
    load();
    receptionistAPI.getDashboard()
      .then(({ data }) => setClinicInfo({ clinic_id: data.clinic_id, doctor_id: data.doctor_id }))
      .catch(() => {});
  }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener('queue_update', handler);
    return () => window.removeEventListener('queue_update', handler);
  }, [load]);

  useEffect(() => {
    const handler = (e) => setNextInLine(e.detail?.next || null);
    window.addEventListener('queue_progress', handler);
    return () => window.removeEventListener('queue_progress', handler);
  }, []);

  useEffect(() => {
    const computed = computeNextFromAppointments(appointments);
    setNextInLine(computed);
  }, [appointments]);

  const handleScan = async (text) => {
    try {
      const token = extractQrToken(text);
      const { data } = await appointmentAPI.checkInQr(token);
      if (data?.appointment_id) {
        setAppointments((prev) =>
          prev.map((a) =>
            String(a.id) === String(data.appointment_id)
              ? { ...a, status: data.status || 'checked_in', checked_in_at: new Date().toISOString() }
              : a
          )
        );
      }
      toast.success('Patient checked in');
      setScanOpen(false);
      load();
    } catch {
      toast.error('Scan failed');
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const { data } = await appointmentAPI.updateStatus(id, { status });
      setAppointments((prev) => prev.map((appt) => (
        appt.id === id ? { ...appt, status } : appt
      )));
      toast.success(data?.offlineQueued ? 'Status saved offline and queued for sync' : 'Status updated');
      if (!data?.offlineQueued) load();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const requeue = async (id) => {
    try {
      const { data } = await appointmentAPI.requeue(id);
      toast.success(`Re-queued. New Queue #${data.queue_number}`);
      load();
    } catch {
      toast.error('Failed to re-queue');
    }
  };

  const searchPatient = async () => {
    if (!walkInPhone) return toast.error('Enter patient phone');
    try {
      const { data } = await patientAPI.search(walkInPhone);
      setWalkInResults(data.patients || []);
      if ((data.patients || []).length === 0) toast.error('No patient found');
    } catch {
      toast.error('Failed to search patient');
    }
  };

  const createWalkIn = async (patientId) => {
    if (!clinicInfo.clinic_id || !clinicInfo.doctor_id) {
      return toast.error('Clinic or doctor not assigned to receptionist');
    }
    try {
      const { data } = await appointmentAPI.walkIn({
        patient_id: patientId,
        doctor_id: clinicInfo.doctor_id,
        clinic_id: clinicInfo.clinic_id,
        notes: walkInNotes,
        priority_level: walkInPriority,
      });
      toast.success(`Walk-in registered. Queue #${data.queue_number}`);
      setWalkInResults([]);
      setWalkInPhone('');
      setWalkInNotes('');
      setWalkInPriority('normal');
      clearDraft(walkInDraftKey);
      load();
    } catch {
      toast.error('Failed to register walk-in');
    }
  };

  const openVitals = (appt) => {
    const saved = loadDraft(vitalsDraftKey);
    setVitalsFor(appt);
    setVitalsForm(
      saved?.vitalsForId === appt.id
        ? {
            blood_pressure: saved.vitalsForm?.blood_pressure || '',
            pulse_rate: saved.vitalsForm?.pulse_rate || '',
            temperature: saved.vitalsForm?.temperature || '',
            weight: saved.vitalsForm?.weight || '',
            height: saved.vitalsForm?.height || '',
            oxygen_saturation: saved.vitalsForm?.oxygen_saturation || '',
            notes: saved.vitalsForm?.notes || '',
          }
        : {
            blood_pressure: '',
            pulse_rate: '',
            temperature: '',
            weight: '',
            height: '',
            oxygen_saturation: '',
            notes: '',
          }
    );
  };

  const saveVitals = async () => {
    if (!vitalsFor) return;
    try {
      const { data } = await appointmentAPI.recordVitals(vitalsFor.id, vitalsForm);
      toast.success(data?.offlineQueued ? 'Vitals saved offline and queued for sync' : 'Vitals saved');
      setVitalsFor(null);
      setVitalsForm({
        blood_pressure: '',
        pulse_rate: '',
        temperature: '',
        weight: '',
        height: '',
        oxygen_saturation: '',
        notes: '',
      });
      clearDraft(vitalsDraftKey);
    } catch {
      toast.error('Failed to save vitals');
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Walk-in Booking</div>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Patient Phone</label>
              <PhoneInput value={walkInPhone} onChange={setWalkInPhone} />
            </div>
            <div className="form-group">
              <label className="form-label">Notes (Optional)</label>
              <input className="form-input" value={walkInNotes} onChange={(e) => setWalkInNotes(e.target.value)} placeholder="Reason or notes" />
            </div>
          </div>
          <div className="form-group" style={{ maxWidth: 260 }}>
            <label className="form-label">Priority</label>
            <select className="form-select" value={walkInPriority} onChange={(e) => setWalkInPriority(e.target.value)}>
              <option value="normal">Normal</option>
              <option value="priority">Priority (Emergency)</option>
            </select>
          </div>
          <div className="form-hint" style={{ marginBottom: 10 }}>
            Walk-in notes and open vitals draft auto-save on this device while you work offline.
          </div>
          <button className="btn btn-outline" onClick={searchPatient}>Search Patient</button>

          {walkInResults.length > 0 && (
            <div className="table-container" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Phone</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {walkInResults.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.phone}</td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={() => createWalkIn(p.id)}>
                          Add Walk-in
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card">
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="card-title">Clinic Appointments</div>
            <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => setScanOpen(true)}>Scan QR</button>
          <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked_in">Checked In</option>
            <option value="in_consultation">In Consultation</option>
            <option value="completed">Completed</option>
            <option value="no_show">No Show</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
        <div className="card-body">
          <QrScannerModal open={scanOpen} onClose={() => setScanOpen(false)} onScan={handleScan} />
          {vitalsFor && (
            <div style={{ border: '1px solid var(--border-light)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                Record Vitals - {vitalsFor.patient_name}
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Blood Pressure</label>
                  <input className="form-input" value={vitalsForm.blood_pressure} onChange={(e) => setVitalsForm({ ...vitalsForm, blood_pressure: e.target.value })} placeholder="120/80" />
                </div>
                <div className="form-group">
                  <label className="form-label">Pulse</label>
                  <input className="form-input" value={vitalsForm.pulse_rate} onChange={(e) => setVitalsForm({ ...vitalsForm, pulse_rate: e.target.value })} placeholder="72" />
                </div>
                <div className="form-group">
                  <label className="form-label">Temperature</label>
                  <input className="form-input" value={vitalsForm.temperature} onChange={(e) => setVitalsForm({ ...vitalsForm, temperature: e.target.value })} placeholder="36.6" />
                </div>
                <div className="form-group">
                  <label className="form-label">Weight (kg)</label>
                  <input className="form-input" value={vitalsForm.weight} onChange={(e) => setVitalsForm({ ...vitalsForm, weight: e.target.value })} placeholder="70" />
                </div>
                <div className="form-group">
                  <label className="form-label">Height (cm)</label>
                  <input className="form-input" value={vitalsForm.height} onChange={(e) => setVitalsForm({ ...vitalsForm, height: e.target.value })} placeholder="170" />
                </div>
                <div className="form-group">
                  <label className="form-label">SpO2 (%)</label>
                  <input className="form-input" value={vitalsForm.oxygen_saturation} onChange={(e) => setVitalsForm({ ...vitalsForm, oxygen_saturation: e.target.value })} placeholder="98" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input className="form-input" value={vitalsForm.notes} onChange={(e) => setVitalsForm({ ...vitalsForm, notes: e.target.value })} placeholder="Optional notes" />
              </div>
            <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={saveVitals}>Save Vitals</button>
                <button className="btn btn-ghost" onClick={() => setVitalsFor(null)}>Cancel</button>
              </div>
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Live Queue Timeline</div>
            <div style={{ marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>Next in line: </span>
              {nextInLine ? (
                <span style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  #{formatQueueNumber(nextInLine.queue_number)} - {nextInLine.patient_name} - {formatSession(nextInLine)}
                  {nextInLine.priority_level === 'priority' && (
                    <span className="badge badge-warning">Priority</span>
                  )}
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>-</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => nextInLine && updateStatus(nextInLine.appointment_id, 'checked_in')}
              disabled={!nextInLine}
              title="Call the next patient"
            >
              Call Next
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => nextInLine && updateStatus(nextInLine.appointment_id, 'no_show')}
              disabled={!nextInLine}
              title="Skip this patient (No Show)"
            >
              Skip
            </button>
          </div>
            {appointments.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No queue for selected date.</div>
            ) : (
              <div style={{ borderLeft: '2px solid var(--border-light)', paddingLeft: 12 }}>
                {appointments
                  .slice()
                  .sort((a, b) => `${a.appointment_time}`.localeCompare(`${b.appointment_time}`) || (a.queue_number || 0) - (b.queue_number || 0))
                  .map((a, idx) => (
                    <div key={`q-${a.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: idx === appointments.length - 1 ? 0 : 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--primary)' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>
                        {formatSession(a)} - {a.patient_name}
                        </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>Queue #{formatQueueNumber(a.queue_number)}</span>
                      {a.priority_level === 'priority' && <span className="badge badge-warning">Priority</span>}
                    </div>
                      </div>
                      <span className={`badge ${statusBadge(a.status)}`}>{a.status}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        {loading ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
        ) : appointments.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>No appointments found.</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Status</th>
                  <th>Queue</th>
                  <th>Vitals</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt) => (
                  <tr key={appt.id}>
                    <td>{formatSession(appt)}</td>
                    <td>{appt.patient_name}</td>
                    <td>{appt.doctor_name}</td>
                    <td><span className={`badge ${statusBadge(appt.status)}`}>{appt.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>#{formatQueueNumber(appt.queue_number)}</span>
                        {appt.priority_level === 'priority' && <span className="badge badge-warning">Priority</span>}
                      </div>
                    </td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => openVitals(appt)}>
                        Record
                      </button>
                    </td>
                    <td>
                      <select
                        className="form-select"
                        defaultValue=""
                        onChange={(e) => e.target.value && updateStatus(appt.id, e.target.value)}
                      >
                        <option value="">Update</option>
                        <option value="confirmed">Confirm</option>
                        <option value="checked_in">Check In</option>
                        <option value="in_consultation">Start Consultation</option>
                        <option value="completed">Complete</option>
                        <option value="no_show">No Show</option>
                        <option value="cancelled">Cancel</option>
                      </select>
                      {appt.status === 'no_show' && (
                        <button className="btn btn-outline btn-sm" style={{ marginTop: 6 }} onClick={() => requeue(appt.id)}>
                          Re-queue
                        </button>
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
    </div>
  );
}






