import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { clinicAPI, doctorAPI } from '../../utils/api';

const days = [
  { id: 0, label: 'Sunday' },
  { id: 1, label: 'Monday' },
  { id: 2, label: 'Tuesday' },
  { id: 3, label: 'Wednesday' },
  { id: 4, label: 'Thursday' },
  { id: 5, label: 'Friday' },
  { id: 6, label: 'Saturday' },
];

const buildDefaultSessions = () =>
  days.map((d) => ({
    day_of_week: d.id,
    session_label: 'Morning',
    start_time: '09:00',
    end_time: '13:00',
    slot_duration_minutes: 10,
    max_patients_per_slot: 30,
  }));

const emptyOverrideForm = {
  id: '',
  override_date: '',
  session_label: 'Custom Session',
  start_time: '10:00',
  end_time: '13:00',
  slot_duration_minutes: 10,
  max_patients_per_slot: 30,
};

export default function DoctorSchedule() {
  const [clinics, setClinics] = useState([]);
  const [clinicId, setClinicId] = useState('');
  const [sessions, setSessions] = useState(buildDefaultSessions());
  const [overrides, setOverrides] = useState([]);
  const [overrideForm, setOverrideForm] = useState(emptyOverrideForm);
  const [leaves, setLeaves] = useState([]);
  const [leaveForm, setLeaveForm] = useState({ leave_date: '', leave_type: 'full_day', reason: '' });
  const [loading, setLoading] = useState(true);
  const [savingWeekly, setSavingWeekly] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);
  const [savingLeave, setSavingLeave] = useState(false);

  const selectedClinic = useMemo(
    () => clinics.find((c) => String(c.id) === String(clinicId)),
    [clinics, clinicId]
  );

  useEffect(() => {
    clinicAPI.getMyClinics()
      .then(({ data }) => {
        const list = data.clinics || [];
        setClinics(list);
        if (list.length) setClinicId(String(list[0].id));
      })
      .catch(() => {
        toast.error('Failed to load clinics');
      })
      .finally(() => setLoading(false));
  }, []);

  const loadSchedule = async (cid) => {
    if (!cid) return;
    try {
      const { data } = await doctorAPI.getSchedule({ clinic_id: cid });
      const existing = data.schedules || [];
      if (!existing.length) {
        setSessions(buildDefaultSessions());
        return;
      }
      setSessions(existing.map((s) => ({
        day_of_week: s.day_of_week,
        session_label: s.session_label || 'Session',
        start_time: s.start_time?.slice(0, 5) || '09:00',
        end_time: s.end_time?.slice(0, 5) || '13:00',
        slot_duration_minutes: s.slot_duration_minutes || 10,
        max_patients_per_slot: s.max_patients_per_slot || 30,
      })));
    } catch {
      toast.error('Failed to load weekly schedule');
    }
  };

  const loadOverrides = async (cid) => {
    if (!cid) return;
    try {
      const { data } = await doctorAPI.getScheduleOverrides({ clinic_id: cid });
      setOverrides(data.overrides || []);
    } catch {
      toast.error('Failed to load date-wise overrides');
    }
  };

  const loadLeaves = async (cid) => {
    if (!cid) return;
    try {
      const { data } = await doctorAPI.getLeaves({ clinic_id: cid });
      setLeaves(data.leaves || []);
    } catch {
      toast.error('Failed to load unavailable dates');
    }
  };

  useEffect(() => {
    if (!clinicId) return;
    loadSchedule(clinicId);
    loadOverrides(clinicId);
    loadLeaves(clinicId);
    setOverrideForm(emptyOverrideForm);
    setLeaveForm({ leave_date: '', leave_type: 'full_day', reason: '' });
  }, [clinicId]);

  const setRow = (idx, key, value) => {
    setSessions((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };

  const addSession = () => {
    setSessions((prev) => ([
      ...prev,
      {
        day_of_week: 1,
        session_label: 'Evening',
        start_time: '17:00',
        end_time: '20:00',
        slot_duration_minutes: 10,
        max_patients_per_slot: 30,
      },
    ]));
  };

  const removeSession = (idx) => {
    setSessions((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveSchedule = async () => {
    if (!clinicId) return;
    const payload = sessions.map((s) => ({
      day_of_week: Number(s.day_of_week),
      session_label: s.session_label || 'Session',
      start_time: `${s.start_time}:00`,
      end_time: `${s.end_time}:00`,
      slot_duration_minutes: Number(s.slot_duration_minutes) || 10,
      max_patients_per_slot: Number(s.max_patients_per_slot) || 30,
    }));
    setSavingWeekly(true);
    try {
      await doctorAPI.setSchedule({ clinic_id: clinicId, schedules: payload });
      toast.success('Weekly schedule saved');
      loadSchedule(clinicId);
    } catch {
      toast.error('Failed to save weekly schedule');
    } finally {
      setSavingWeekly(false);
    }
  };

  const saveOverride = async () => {
    if (!clinicId) return;
    if (!overrideForm.override_date) return toast.error('Select an override date');
    setSavingOverride(true);
    try {
      await doctorAPI.saveScheduleOverride({
        ...overrideForm,
        clinic_id: clinicId,
        start_time: `${overrideForm.start_time}:00`,
        end_time: `${overrideForm.end_time}:00`,
      });
      toast.success(overrideForm.id ? 'Date-wise override updated' : 'Date-wise override saved');
      setOverrideForm(emptyOverrideForm);
      loadOverrides(clinicId);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to save override');
    } finally {
      setSavingOverride(false);
    }
  };

  const editOverride = (item) => {
    setOverrideForm({
      id: item.id,
      override_date: String(item.override_date).slice(0, 10),
      session_label: item.session_label || 'Custom Session',
      start_time: item.start_time?.slice(0, 5) || '10:00',
      end_time: item.end_time?.slice(0, 5) || '13:00',
      slot_duration_minutes: item.slot_duration_minutes || 10,
      max_patients_per_slot: item.max_patients_per_slot || 30,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeOverride = async (id) => {
    try {
      await doctorAPI.deleteScheduleOverride(id);
      toast.success('Date-wise override removed');
      if (String(overrideForm.id) === String(id)) {
        setOverrideForm(emptyOverrideForm);
      }
      loadOverrides(clinicId);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to remove override');
    }
  };

  const markLeave = async () => {
    if (!leaveForm.leave_date) return toast.error('Select an unavailable date');
    setSavingLeave(true);
    try {
      await doctorAPI.markLeave({ clinic_id: clinicId, ...leaveForm });
      toast.success('Unavailable date saved');
      setLeaveForm({ leave_date: '', leave_type: 'full_day', reason: '' });
      loadLeaves(clinicId);
    } catch {
      toast.error('Failed to save unavailable date');
    } finally {
      setSavingLeave(false);
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Schedule</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : clinics.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No clinics found. Add a clinic first.</div>
          ) : (
            <>
              <div className="form-group" style={{ maxWidth: 360 }}>
                <label className="form-label">Clinic</label>
                <select className="form-select" value={clinicId} onChange={(e) => setClinicId(e.target.value)}>
                  {clinics.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.city ? ` - ${c.city}` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="form-hint" style={{ marginTop: 10 }}>
                Save your weekly schedule once. It will automatically repeat every week for {selectedClinic?.name || 'this clinic'} until you change it.
              </div>

              <div className="table-container" style={{ marginTop: 16 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Session</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Avg Min/Patient</th>
                      <th>Max Patients</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s, idx) => (
                      <tr key={`${s.day_of_week}-${idx}`}>
                        <td>
                          <select className="form-select" value={s.day_of_week} onChange={(e) => setRow(idx, 'day_of_week', e.target.value)}>
                            {days.map((d) => (
                              <option key={d.id} value={d.id}>{d.label}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input className="form-input" value={s.session_label} onChange={(e) => setRow(idx, 'session_label', e.target.value)} placeholder="Morning / Evening" />
                        </td>
                        <td>
                          <input className="form-input" type="time" value={s.start_time} onChange={(e) => setRow(idx, 'start_time', e.target.value)} />
                        </td>
                        <td>
                          <input className="form-input" type="time" value={s.end_time} onChange={(e) => setRow(idx, 'end_time', e.target.value)} />
                        </td>
                        <td>
                          <input className="form-input" type="number" min="5" value={s.slot_duration_minutes} onChange={(e) => setRow(idx, 'slot_duration_minutes', e.target.value)} />
                        </td>
                        <td>
                          <input className="form-input" type="number" min="1" value={s.max_patients_per_slot} onChange={(e) => setRow(idx, 'max_patients_per_slot', e.target.value)} />
                        </td>
                        <td>
                          <button className="btn btn-ghost btn-sm" onClick={() => removeSession(idx)}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="btn btn-outline" onClick={addSession}>Add Weekly Session</button>
                <button className="btn btn-primary" onClick={saveSchedule} disabled={savingWeekly}>
                  {savingWeekly ? 'Saving...' : 'Save Weekly Schedule'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {selectedClinic && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <div className="card-title">Date-wise Custom Hours</div>
            </div>
            <div className="card-body">
              <div className="form-hint" style={{ marginBottom: 16 }}>
                Use this only when a particular date needs different working hours than your normal weekly schedule.
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Override Date</label>
                  <input className="form-input" type="date" value={overrideForm.override_date} onChange={(e) => setOverrideForm((prev) => ({ ...prev, override_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Session Label</label>
                  <input className="form-input" value={overrideForm.session_label} onChange={(e) => setOverrideForm((prev) => ({ ...prev, session_label: e.target.value }))} placeholder="Custom Session" />
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Start Time</label>
                  <input className="form-input" type="time" value={overrideForm.start_time} onChange={(e) => setOverrideForm((prev) => ({ ...prev, start_time: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">End Time</label>
                  <input className="form-input" type="time" value={overrideForm.end_time} onChange={(e) => setOverrideForm((prev) => ({ ...prev, end_time: e.target.value }))} />
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Avg Min/Patient</label>
                  <input className="form-input" type="number" min="5" value={overrideForm.slot_duration_minutes} onChange={(e) => setOverrideForm((prev) => ({ ...prev, slot_duration_minutes: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Patients</label>
                  <input className="form-input" type="number" min="1" value={overrideForm.max_patients_per_slot} onChange={(e) => setOverrideForm((prev) => ({ ...prev, max_patients_per_slot: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={saveOverride} disabled={savingOverride}>
                  {savingOverride ? 'Saving...' : overrideForm.id ? 'Update Custom Hours' : 'Save Custom Hours'}
                </button>
                {overrideForm.id && (
                  <button className="btn btn-ghost" onClick={() => setOverrideForm(emptyOverrideForm)}>
                    Cancel Edit
                  </button>
                )}
              </div>

              <div style={{ marginTop: 24, fontWeight: 700 }}>Saved Date-wise Overrides</div>
              {overrides.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>No date-wise custom hours saved yet.</div>
              ) : (
                <div className="table-container" style={{ marginTop: 8 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Session</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Avg Min/Patient</th>
                        <th>Max Patients</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {overrides.map((item) => (
                        <tr key={item.id}>
                          <td>{String(item.override_date).slice(0, 10)}</td>
                          <td>{item.session_label || 'Custom Session'}</td>
                          <td>{item.start_time?.slice(0, 5)}</td>
                          <td>{item.end_time?.slice(0, 5)}</td>
                          <td>{item.slot_duration_minutes || 10}</td>
                          <td>{item.max_patients_per_slot || 30}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-outline btn-sm" onClick={() => editOverride(item)}>Edit</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => removeOverride(item.id)}>Delete</button>
                            </div>
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
            <div className="card-header">
              <div className="card-title">Unavailable Dates</div>
            </div>
            <div className="card-body">
              <div className="form-hint" style={{ marginBottom: 16 }}>
                Mark full-day or half-day leave only when you are unavailable. This does not require saving the weekly schedule again.
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Unavailable Date</label>
                  <input className="form-input" type="date" value={leaveForm.leave_date} onChange={(e) => setLeaveForm({ ...leaveForm, leave_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Unavailable Type</label>
                  <select className="form-select" value={leaveForm.leave_type} onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}>
                    <option value="full_day">Full Day</option>
                    <option value="morning">Morning Only</option>
                    <option value="evening">Evening Only</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Reason (Optional)</label>
                <input className="form-input" value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} />
              </div>
              <button className="btn btn-outline" onClick={markLeave} disabled={savingLeave}>
                {savingLeave ? 'Saving...' : 'Save Unavailable Date'}
              </button>

              <div style={{ marginTop: 24, fontWeight: 700 }}>Recent Unavailable Dates</div>
              {leaves.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>No unavailable dates saved yet.</div>
              ) : (
                <div className="table-container" style={{ marginTop: 8 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaves.slice(0, 10).map((l) => (
                        <tr key={l.id}>
                          <td>{String(l.leave_date).slice(0, 10)}</td>
                          <td>{l.leave_type}</td>
                          <td>{l.reason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
