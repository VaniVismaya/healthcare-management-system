import React, { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { appointmentAPI, patientAPI, labAPI } from '../../utils/api';
import QRCode from 'react-qr-code';
import { normalizeAppointmentDate, todayLocalDate, appointmentSortKey } from '../../utils/appointmentDate';

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

const apiBase = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

const getMeetUrl = (appt) => {
  if (appt?.video_meeting_url) return appt.video_meeting_url;
  const id = appt?.uuid || appt?.id;
  return `https://meet.jit.si/med-appoint-${id}`;
};

const isZoomUrl = (url) => /zoom\.us/i.test(String(url || ''));

const isVideoAppointment = (appt) => {
  if (!appt) return false;
  if (appt.is_video === true || appt.is_video === 1) return true;
  const mode = String(appt.consultation_mode || appt.appointment_mode || appt.mode || '').toLowerCase();
  if (['video', 'online', 'virtual', 'tele', 'telemedicine'].includes(mode)) return true;
  const reason = String(appt.reason_for_visit || appt.notes || '').toLowerCase();
  return reason.includes('[video]') || reason.includes('video consultation');
};

export default function PatientAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [date, setDate] = useState(todayLocalDate());
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [queueTimeline, setQueueTimeline] = useState([]);
  const [timelineClinicId, setTimelineClinicId] = useState('');
  const [nextInLine, setNextInLine] = useState(null);
  const [estimatedWait, setEstimatedWait] = useState(null);
  const [visitSummary, setVisitSummary] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [videoForId, setVideoForId] = useState(null);
  const [qrInfo, setQrInfo] = useState({ open: false, token: '', appt: null, loading: false });

  const load = useCallback(() => {
    setLoading(true);
    const params = { date };
    if (statusFilter) params.status = statusFilter;
    appointmentAPI.getAll(params)
      .then(({ data }) =>
        setAppointments(
          (data.appointments || []).map((appt) => ({
            ...appt,
            normalized_date: normalizeAppointmentDate(appt.appointment_date),
          }))
        )
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter, date]);

  useEffect(() => { load(); }, [load]);

  const loadSummary = useCallback(() => {
    setSummaryLoading(true);
    patientAPI.getSummary()
      .then(({ data }) => setVisitSummary(data.visits || []))
      .catch(() => setVisitSummary([]))
      .finally(() => setSummaryLoading(false));
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const clinicOptions = useMemo(() => {
    const map = new Map();
    appointments.forEach((a) => {
      if (!map.has(a.clinic_id)) map.set(a.clinic_id, a.clinic_name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [appointments]);

  useEffect(() => {
    if (clinicOptions.length && !timelineClinicId) {
      setTimelineClinicId(clinicOptions[0].id);
    }
  }, [clinicOptions, timelineClinicId]);

  const loadTimeline = useCallback(async () => {
    if (!timelineClinicId) return setQueueTimeline([]);
    try {
      const { data } = await appointmentAPI.getQueueTimeline({ clinic_id: timelineClinicId, date });
      setQueueTimeline(
        (data.timeline || []).map((item) => ({
          ...item,
          normalized_date: normalizeAppointmentDate(item.appointment_date),
        }))
      );
    } catch {
      setQueueTimeline([]);
    }
  }, [timelineClinicId, date]);

  useEffect(() => { loadTimeline(); }, [loadTimeline]);

  useEffect(() => {
    const handler = () => {
      load();
      loadTimeline();
    };
    window.addEventListener('queue_update', handler);
    return () => window.removeEventListener('queue_update', handler);
  }, [load, loadTimeline]);

  useEffect(() => {
    const handler = (e) => {
      const payload = e.detail;
      if (!payload) return;
      if (
        payload.clinic_id &&
        String(payload.clinic_id) === String(timelineClinicId) &&
        normalizeAppointmentDate(payload.appointment_date) === date
      ) {
        setNextInLine(payload.next || null);
      }
    };
    window.addEventListener('queue_progress', handler);
    return () => window.removeEventListener('queue_progress', handler);
  }, [timelineClinicId, date]);

  useEffect(() => {
    if (!queueTimeline.length) return setEstimatedWait(null);
    const myIndex = queueTimeline.findIndex((q) => q.is_me);
    if (myIndex === -1) return setEstimatedWait(null);
    const currentIndex = queueTimeline.findIndex((q) => {
      if (nextInLine?.queue_number) return q.queue_number === nextInLine.queue_number;
      return ['pending','confirmed','checked_in'].includes(q.status);
    });
    if (currentIndex === -1) return setEstimatedWait(null);
    const slot = queueTimeline[myIndex]?.slot_duration_minutes || 15;
    const diff = Math.max(0, myIndex - currentIndex);
    setEstimatedWait(diff * slot);
  }, [queueTimeline, nextInLine]);

  const myQueueItems = queueTimeline
    .filter((q) => q.is_me)
    .slice()
    .sort((a, b) => appointmentSortKey(a).localeCompare(appointmentSortKey(b)) || (a.queue_number || 0) - (b.queue_number || 0));
  const videoFor = appointments.find((a) => String(a.id) === String(videoForId)) || null;
  const videoUrl = videoFor ? getMeetUrl(videoFor) : '';
  const zoomJoin = isZoomUrl(videoUrl);

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

  const openQr = async (appt) => {
    setQrInfo({ open: true, token: '', appt, loading: true });
    try {
      const { data } = await appointmentAPI.getQr(appt.id);
      setQrInfo({ open: true, token: data.token, appt, loading: false });
    } catch {
      toast.error('Failed to load QR');
      setQrInfo({ open: false, token: '', appt: null, loading: false });
    }
  };

  return (
    <div>
      {videoFor && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
        >
          <div style={{ width: '100%', maxWidth: 1100, background: '#fff', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ fontWeight: 700 }}>
                Video Consultation - {videoFor.doctor_name}
              </div>
              <button className="btn btn-ghost" onClick={() => setVideoForId(null)}>Close</button>
            </div>
            <div style={{ padding: 12 }}>
  {videoFor.status === 'in_consultation' ? (
    zoomJoin ? (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Zoom meeting ready</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Zoom meetings cannot be embedded. Click below to open in a new tab.
        </div>
        <a className="btn btn-primary" href={videoUrl} target="_blank" rel="noreferrer">
          Open Zoom Meeting
        </a>
      </div>
    ) : (
      <iframe
        title="Video Consultation"
        src={videoUrl}
        style={{ width: '100%', height: '70vh', border: 'none', borderRadius: 8 }}
        allow="camera; microphone; fullscreen; speaker; display-capture"
      />
    )
  ) : (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Waiting Room</div>
      <div style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        Your doctor hasn't started the consultation yet. We'll connect you as soon as it begins.
      </div>
      <button className="btn btn-outline" onClick={() => load()}>
        Refresh Status
      </button>
    </div>
  )}
</div>
</div>
        </div>
      )}
      {qrInfo.open && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Patient Check-in QR</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setQrInfo({ open: false, token: '', appt: null, loading: false })}>X</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              {qrInfo.loading ? (
                <div style={{ color: 'var(--text-muted)' }}>Generating QR...</div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                    <QRCode value={qrInfo.token || ' '} size={180} />
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Show this QR at the clinic reception to check in.
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setQrInfo({ open: false, token: '', appt: null, loading: false })}>Close</button>
            </div>
          </div>
        </div>
      )}
      <div className="card">
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="card-title">My Appointments</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <select className="form-select" style={{ maxWidth: 200 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked_in">Checked In</option>
            <option value="in_consultation">In Consultation</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
      <div className="card-body">
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Queue Timeline</div>
          {clinicOptions.length > 1 && (
            <div className="form-group" style={{ maxWidth: 320, marginBottom: 10 }}>
              <label className="form-label">Clinic</label>
              <select className="form-select" value={timelineClinicId} onChange={(e) => setTimelineClinicId(e.target.value)}>
                {clinicOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div style={{ marginBottom: 8, fontSize: 13 }}>
            <span style={{ color: 'var(--text-muted)' }}>Your Queue: </span>
            {myQueueItems[0] ? (
              <span style={{ fontWeight: 700 }}>
                #{formatQueueNumber(myQueueItems[0].queue_number)} - {formatSession(myQueueItems[0])}
                {myQueueItems[0].priority_level === 'priority' && (
                  <span className="badge badge-warning" style={{ marginLeft: 6 }}>Priority</span>
                )}
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>-</span>
            )}
            {estimatedWait !== null && (
              <span style={{ marginLeft: 12, color: 'var(--text-muted)' }}>Estimated wait: <strong>{estimatedWait} min</strong></span>
            )}
          </div>
          {myQueueItems.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No queue data for you.</div>
          ) : (
            <div style={{ borderLeft: '2px solid var(--border-light)', paddingLeft: 12 }}>
              {myQueueItems.map((q, idx) => (
                <div key={`${q.queue_number}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: idx === myQueueItems.length - 1 ? 0 : 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 999, background: q.is_me ? 'var(--primary)' : 'var(--border)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: q.is_me ? 700 : 600 }}>
                      {formatSession(q)} - Queue #{formatQueueNumber(q.queue_number)}
                      {q.is_me ? ' (You)' : ''}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{q.status}</div>
                    {q.priority_level === 'priority' && (
                      <div style={{ marginTop: 4 }}>
                        <span className="badge badge-warning">Priority</span>
                      </div>
                    )}
                  </div>
                  <span className={`badge ${q.status === 'completed' ? 'badge-success' : q.status === 'checked_in' || q.status === 'in_consultation' ? 'badge-warning' : 'badge-primary'}`}>
                    {q.status}
                  </span>
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
                  <th>Date</th>
                  <th>Session</th>
                  <th>Doctor</th>
                  <th>Clinic</th>
                  <th>Status</th>
                  <th>Queue</th>
                  <th>Video</th>
                  <th>QR</th>
                </tr>
              </thead>
              <tbody>
                  {appointments.map((appt) => (
                    <tr key={appt.id}>
                    <td>{appt.normalized_date || normalizeAppointmentDate(appt.appointment_date)}</td>
                      <td>{formatSession(appt)}</td>
                    <td>{appt.doctor_name}</td>
                    <td>{appt.clinic_name}</td>
                    <td><span className="badge badge-primary">{appt.status}</span></td>
                    <td>
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <span>#{formatQueueNumber(appt.queue_number)}</span>
    {appt.priority_level === 'priority' && <span className="badge badge-warning">Priority</span>}
  </div>
</td>
                    <td>
                      {isVideoAppointment(appt) ? (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => setVideoForId(appt.id)}
                          disabled={['cancelled', 'no_show', 'completed'].includes(appt.status)}
                          title="Open video consultation"
                        >
                          Join
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>In-person</span>
                      )}
                    </td>
                    <td>
                      {['cancelled', 'no_show', 'completed'].includes(appt.status) ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>-</span>
                      ) : (
                        <button className="btn btn-outline btn-sm" onClick={() => openQr(appt)}>
                          Show QR
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

    <div className="card" style={{ marginTop: 20 }}>
      <div className="card-header">
        <div className="card-title">Past Visit Summary</div>
      </div>
      <div className="card-body">
        {summaryLoading ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
        ) : visitSummary.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>No completed visits yet.</div>
        ) : (
          visitSummary.map((v) => (
            <div key={v.appointment_id} style={{ border: '1px solid var(--border-light)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                  <div style={{ fontWeight: 700 }}>{normalizeAppointmentDate(v.appointment_date)} - {formatTime(v.appointment_time)}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{v.doctor_name} - {v.clinic_name}</div>
                  </div>
                <span className="badge badge-success">Completed</span>
              </div>
              <div style={{ marginTop: 10, fontSize: 13 }}>
                <div><strong>Diagnosis:</strong> {v.diagnosis || '-'}</div>
                <div style={{ marginTop: 6 }}>
                  <strong>Vitals:</strong>{' '}
                  {v.vitals ? (
                    <>
                      BP {v.vitals.blood_pressure || '-'}{' '}
                      - Pulse {v.vitals.pulse_rate || '-'}{' '}
                      - Temp {v.vitals.temperature || '-'} C{' '}
                      - SpO2 {v.vitals.oxygen_saturation || '-'}%
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>Not recorded</span>
                  )}
                </div>
                <div style={{ marginTop: 6 }}><strong>Prescription:</strong></div>
                {v.medicines.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)' }}>No medicines recorded.</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {v.medicines.map((m) => (
                      <span key={m.id} className="badge badge-primary">
                        {m.medicine_name}{m.dosage ? ` ${m.dosage}` : ''}{m.frequency ? ` - ${m.frequency}` : ''}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 10 }}><strong>Lab Reports:</strong></div>
                {v.lab_reports.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)' }}>No lab reports.</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                    {v.lab_reports.map((r) => (
                      <button key={r.report_id} className="btn btn-outline btn-sm" onClick={() => viewReport(r.report_id)}>
                        {r.test_name || r.report_title || 'Report'}
                        {r.result_flag && (
                          <span className={`badge ${r.result_flag === 'normal' ? 'badge-success' : 'badge-warning'}`} style={{ marginLeft: 6 }}>
                            {r.result_flag}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  </div>
  );
}












