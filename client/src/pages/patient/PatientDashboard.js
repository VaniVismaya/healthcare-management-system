import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, FlaskConical, FileText, Activity, Brain, Stethoscope, ArrowRight } from 'lucide-react';
import api, { appointmentAPI, labAPI, prescriptionAPI, doctorAPI } from '../../utils/api';
import { useNavigate } from 'react-router-dom';
import { normalizeAppointmentDate, todayLocalDate, appointmentSortKey } from '../../utils/appointmentDate';

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = ((hour + 11) % 12) + 1;
  return `${displayHour}:${m} ${suffix}`;
};

const normalizeText = (value) => String(value || '').toLowerCase();

const pickSpecialtyFromText = (text, doctors) => {
  const t = normalizeText(text);
  const specialties = Array.from(new Set((doctors || []).map(d => d.specialization).filter(Boolean)));
  let best = '';
  let bestScore = 0;
  specialties.forEach((spec) => {
    const specLower = normalizeText(spec);
    if (!specLower) return;
    let score = 0;
    if (t.includes(specLower)) score += specLower.length + 10;
    specLower.split(/\s+/).forEach((word) => {
      if (word.length >= 4 && t.includes(word)) score += word.length;
    });
    if (score > bestScore) {
      bestScore = score;
      best = spec;
    }
  });
  return best;
};

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

export default function PatientDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, upcoming: 0, labs: 0, prescriptions: 0 });
  const [nextAppointment, setNextAppointment] = useState(null);
  const [todayAppointment, setTodayAppointment] = useState(null);
  const [queueTimeline, setQueueTimeline] = useState([]);
  const [recentLabs, setRecentLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiOpen, setAiOpen] = useState(false);
  const [panelInput, setPanelInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([
    { id: 1, role: 'assistant', text: 'Hi! Describe your symptoms and I will suggest the right doctor type and next step.' },
  ]);
  const [aiDoctors, setAiDoctors] = useState([]);
  const [aiSpecialty, setAiSpecialty] = useState('');
  const [doctorModal, setDoctorModal] = useState(null);

  const load = useCallback(async () => {
    const today = todayLocalDate();
    setLoading(true);
    try {
      const [apptsRes, labsRes, presRes] = await Promise.all([
        appointmentAPI.getAll(),
        labAPI.getOrders(),
        prescriptionAPI.getAll(),
      ]);
      const appts = apptsRes.data?.appointments || [];
      const labs = labsRes.data?.orders || [];
      const pres = presRes.data?.prescriptions || [];

      const normalizedAppointments = appts.map((appt) => ({
        ...appt,
        normalized_date: normalizeAppointmentDate(appt.appointment_date),
      }));

      const upcoming = normalizedAppointments
        .filter(a => a.normalized_date >= today && !['cancelled', 'no_show'].includes(a.status))
        .sort((a, b) => appointmentSortKey(a).localeCompare(appointmentSortKey(b)));

      const todayAppt = upcoming.find(a => a.normalized_date === today) || null;

      setStats({
        total: appts.length,
        upcoming: upcoming.length,
        labs: labs.length,
        prescriptions: pres.length,
      });
      setNextAppointment(upcoming[0] || null);
      setTodayAppointment(todayAppt);
      setRecentLabs(labs.slice(0, 5));

      if (todayAppt?.clinic_id) {
        const { data } = await appointmentAPI.getQueueTimeline({ clinic_id: todayAppt.clinic_id, date: today });
        setQueueTimeline(data.timeline || []);
      } else {
        setQueueTimeline([]);
      }
    } catch {
      setQueueTimeline([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener('queue_update', handler);
    return () => window.removeEventListener('queue_update', handler);
  }, [load]);

  const myQueueItems = queueTimeline.filter((q) => q.is_me);

  const loadAiDoctors = async (textForMatch) => {
    try {
      const { data } = await doctorAPI.search({});
      const list = data?.doctors || [];
      if (!list.length) {
        setAiDoctors([]);
        setAiSpecialty('');
        return;
      }
      const match = pickSpecialtyFromText(textForMatch, list);
      let filtered = list;
      if (match) {
        const matchLower = normalizeText(match);
        filtered = list.filter((d) => {
          const spec = normalizeText(d.specialization);
          const depts = normalizeText(d.departments);
          return spec.includes(matchLower) || depts.includes(matchLower);
        });
      }
      filtered = filtered
        .slice()
        .sort((a, b) => Number(b.experience_years || 0) - Number(a.experience_years || 0))
        .slice(0, 4);
      setAiSpecialty(match || 'Suggested Doctors');
      setAiDoctors(filtered);
    } catch {
      setAiDoctors([]);
      setAiSpecialty('');
    }
  };

  const handleAiSend = async (value) => {
    const text = value.trim();
    if (!text) return;
    const userMsg = { id: Date.now(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    try {
      const { data } = await api.post('/ai/assist', { message: text });
      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        text: data?.reply || 'I could not generate a response right now.',
      };
      setMessages(prev => [...prev, assistantMsg]);
      await loadAiDoctors(data?.reply || text);
    } catch {
      const fallback = {
        id: Date.now() + 2,
        role: 'assistant',
        text: 'AI assistant is unavailable right now. Please try again in a moment.',
      };
      setMessages(prev => [...prev, fallback]);
      await loadAiDoctors(text);
    }
  };

  return (
    <div>
      <div className="stats-grid">
        <StatCard icon={Calendar} color="#0A7EA4" label="Total Appointments" value={stats.total} />
        <StatCard icon={Activity} color="#00B894" label="Upcoming Appointments" value={stats.upcoming} />
        <StatCard icon={FlaskConical} color="#7C3AED" label="Lab Orders" value={stats.labs} />
        <StatCard icon={FileText} color="#F59E0B" label="Prescriptions" value={stats.prescriptions} />
      </div>

      {todayAppointment && (
        <div className="card" style={{ marginBottom: 20, border: '1px solid #E8F4F8' }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700 }}>Today's Queue</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {todayAppointment.doctor_name} - {todayAppointment.clinic_name}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="badge badge-primary">Queue #{todayAppointment.queue_number || '-'}</div>
              <div className="badge badge-warning">{todayAppointment.status}</div>
            </div>
          </div>
        </div>
      )}

      {todayAppointment && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div className="card-title">Clinic Queue Timeline</div>
          </div>
          <div className="card-body">
            {loading ? (
              <div style={{ color: 'var(--text-muted)' }}>Loading queue...</div>
            ) : myQueueItems.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>No queue data for you.</div>
            ) : (
              <div style={{ borderLeft: '2px solid var(--border-light)', paddingLeft: 12 }}>
                {myQueueItems.map((q, idx) => (
                  <div key={`${q.queue_number}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: idx === myQueueItems.length - 1 ? 0 : 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 999, background: q.is_me ? 'var(--primary)' : 'var(--border)' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: q.is_me ? 700 : 600 }}>
                        {formatTime(q.appointment_time)} - Queue #{q.queue_number}
                        {q.is_me ? ' (You)' : ''}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{q.status}</div>
                    </div>
                    <span className={`badge ${q.status === 'completed' ? 'badge-success' : q.status === 'checked_in' || q.status === 'in_consultation' ? 'badge-warning' : 'badge-primary'}`}>
                      {q.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Next Appointment</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : nextAppointment ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{nextAppointment.doctor_name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{nextAppointment.clinic_name}</div>
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>{nextAppointment.normalized_date || normalizeAppointmentDate(nextAppointment.appointment_date)}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{formatTime(nextAppointment.appointment_time)}</div>
              </div>
              <div className="badge badge-primary">Queue #{nextAppointment.queue_number || '-'}</div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>No upcoming appointments.</div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Recent Lab Orders</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : recentLabs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No lab orders yet.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Lab</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLabs.map((order) => (
                    <tr key={order.id}>
                      <td>{order.lab_name || 'Manual'}</td>
                      <td><span className="badge badge-purple">{order.status}</span></td>
                      <td>{order.total_amount ? `INR ${order.total_amount}` : '-'}</td>
                      <td>{order.created_at ? String(order.created_at).slice(0, 10) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {aiOpen && (
        <div className="modal-overlay">
          <div className="modal modal-lg ai-modal">
            <div className="modal-header">
              <h2>AI Chat Doctor Suggest Assistant</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setAiOpen(false)}>X</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 8, color: 'var(--text-muted)', fontSize: 13 }}>
                Describe symptoms, get recommended specialists, and move directly to booking.
              </div>
              <div className="ai-grid">
                <div className="ai-panel">
                  <div className="ai-panel-header">
                    <div>
                      <h3>Symptom Input</h3>
                      <p>AI-powered suggestions (live)</p>
                    </div>
                    <Brain size={20} />
                  </div>
                  <div className="ai-suggestions">
                    {[
                      'Fever, cough, body pain',
                      'Chest discomfort, breathless on stairs',
                      'Stomach pain, nausea after food',
                      'Headache, blurred vision, fatigue',
                      'Child fever with cough',
                    ].map(preset => (
                      <button key={preset} className="chip" onClick={() => setPanelInput(preset)}>{preset}</button>
                    ))}
                  </div>
                  <div className="ai-input">
                    <textarea
                      className="form-textarea"
                      rows={4}
                      placeholder="Type symptoms like: fever, cough, sore throat"
                      value={panelInput}
                      onChange={(e) => setPanelInput(e.target.value)}
                    />
                    <button className="btn btn-primary" onClick={() => { handleAiSend(panelInput); setPanelInput(''); }}>Get Suggestions</button>
                  </div>
                  <div className="ai-cta">
                    <p>Ready to book with a specialist?</p>
                    <button className="btn btn-outline" onClick={() => navigate('/patient/book')}>Book Appointment</button>
                  </div>
                </div>

                <div className="ai-chat">
                  <div className="ai-chat-header">
                    <Stethoscope size={18} /> AI Doctor Assistant
                  </div>
                  <div className="ai-chat-body">
                    {messages.map(msg => (
                      <div key={msg.id} className={`ai-message ${msg.role}`}>
                        <div className="ai-bubble">{msg.text}</div>
                      </div>
                    ))}
                  </div>
                  <div className="ai-chat-footer">
                    <input
                      className="form-input"
                      placeholder="Ask about symptoms or next steps"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAiSend(chatInput); setChatInput(''); } }}
                    />
                    <button className="btn btn-primary" onClick={() => { handleAiSend(chatInput); setChatInput(''); }}><ArrowRight size={15} /></button>
                  </div>
                </div>
              </div>

              {aiDoctors.length > 0 && (
                <div className="ai-doctors">
                  <div className="ai-doctors-header">
                    <h3>{aiSpecialty || 'Suggested Doctors'}</h3>
                    <button className="btn btn-outline btn-sm" onClick={() => navigate('/patient/book')}>See All Doctors</button>
                  </div>
                  <div className="service-card-grid">
                    {aiDoctors.map((doc) => (
                      <div key={doc.id} className="service-card">
                        <div className="service-card-top">
                          <div className="service-avatar">
                            {doc.profile_image ? (
                              <img src={doc.profile_image} alt={doc.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
                            ) : (
                              (doc.name || 'D').slice(0, 1)
                            )}
                          </div>
                          <div>
                            <div className="service-card-title">{doc.name}</div>
                            <div className="service-card-sub">{doc.specialization || 'Specialist'}{doc.experience_years ? ` - ${doc.experience_years} yrs` : ''}</div>
                          </div>
                        </div>
                        <div className="service-card-row">{doc.clinic_name || 'Clinic'} - {doc.city || 'City'}</div>
                        <div className="service-card-footer">
                          <button className="btn btn-outline btn-sm" onClick={() => setDoctorModal(doc)}>View Profile</button>
                          <button className="btn btn-primary btn-sm" onClick={() => navigate('/patient/book')}>Book</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {doctorModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Doctor Profile</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setDoctorModal(null)}>X</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                <div className="service-avatar">
                  {doctorModal.profile_image ? (
                    <img src={doctorModal.profile_image} alt={doctorModal.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
                  ) : (
                    (doctorModal.name || 'D').slice(0, 1)
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 800 }}>{doctorModal.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {doctorModal.specialization || 'Specialist'}{doctorModal.experience_years ? ` - ${doctorModal.experience_years} yrs` : ''}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 13, marginBottom: 10 }}>
                <strong>Clinic:</strong> {doctorModal.clinic_name || 'Clinic'}
              </div>
              <div style={{ fontSize: 13, marginBottom: 10 }}>
                <strong>Location:</strong> {doctorModal.address || doctorModal.city || '-'}
              </div>
              <div style={{ fontSize: 13, marginBottom: 10 }}>
                <strong>Consultation Starts At:</strong> {doctorModal.consultation_fee ? `INR ${doctorModal.consultation_fee}` : 'Fee N/A'}
              </div>
              {doctorModal.bio && (
                <div style={{ fontSize: 13 }}>
                  <strong>About:</strong> {doctorModal.bio}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDoctorModal(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => navigate('/patient/book')}>Book Appointment</button>
            </div>
          </div>
        </div>
      )}
      <button type="button" className="ai-fab" onClick={() => setAiOpen(true)} title="AI Assistant">
        <Brain size={18} />
        <span>AI Assist</span>
      </button>
    </div>
  );
}

