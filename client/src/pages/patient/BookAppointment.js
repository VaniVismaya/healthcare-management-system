import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useLocation } from 'react-router-dom';
import { doctorAPI, appointmentAPI, paymentAPI } from '../../utils/api';

const formatDate = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatSessionLabel = (session) => {
  if (!session) return 'Session';
  const labelRaw = session.label || session.session_label || 'Session';
  const label = /session/i.test(labelRaw) ? labelRaw : `${labelRaw} Session`;
  const start = String(session.start_time || '').slice(0, 5);
  const end = String(session.end_time || '').slice(0, 5);
  if (start && end) return `${label} (${start} - ${end})`;
  if (start) return `${label} (${start})`;
  return label;
};

export default function BookAppointment() {
  const location = useLocation();
  const [search, setSearch] = useState({ name: '', city: '' });
  const [doctors, setDoctors] = useState([]);
  const [allDoctors, setAllDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [appointmentDate, setAppointmentDate] = useState(formatDate(new Date()));
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [reason, setReason] = useState('');
  const [consultationMode, setConsultationMode] = useState('in_person');
  const [priorityLevel, setPriorityLevel] = useState('normal');
  const [loading, setLoading] = useState(false);
  const [bookingInfo, setBookingInfo] = useState(null);
  const [geo, setGeo] = useState({ status: 'idle', lat: null, lng: null, error: '' });
  const [radiusKm, setRadiusKm] = useState(10);
  const [filters, setFilters] = useState({ minExperience: '', sortBy: 'experience_desc' });
  const [bookingFee, setBookingFee] = useState(0);
  const [paying, setPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('razorpay');
  const [paymentOrderId, setPaymentOrderId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [checkingPayment, setCheckingPayment] = useState(false);

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      toast.error('GPS not supported on this device');
      return;
    }
    setGeo({ status: 'loading', lat: null, lng: null, error: '' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGeo({ status: 'ready', lat, lng, error: '' });
        handleSearch({ latitude: lat, longitude: lng, radius_km: radiusKm });
        toast.success('Location detected');
      },
      (err) => {
        setGeo({ status: 'error', lat: null, lng: null, error: err.message || 'Location access denied' });
        toast.error('Location access denied');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleSearch = async (override = null) => {
    setLoading(true);
    setSelectedDoctor(null);
    setSessions([]);
    setSelectedSession(null);
    setBookingInfo(null);
    try {
      const params = { name: search.name, city: search.city };
      if (override?.latitude && override?.longitude) {
        params.latitude = override.latitude;
        params.longitude = override.longitude;
        params.radius_km = override.radius_km || radiusKm;
      } else if (geo.status === 'ready' && geo.lat && geo.lng) {
        params.latitude = geo.lat;
        params.longitude = geo.lng;
        params.radius_km = radiusKm;
      }
      const { data } = await doctorAPI.search(params);
      setAllDoctors(data.doctors || []);
    } catch {
      toast.error('Failed to search doctors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { handleSearch(); }, []);

  useEffect(() => {
    appointmentAPI.getBookingFee()
      .then(({ data }) => setBookingFee(Number(data?.booking_fee || 0)))
      .catch(() => setBookingFee(0));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const paytm = params.get('paytm_order');
    const razor = params.get('razorpay_order');
    const stripe = params.get('stripe_order');
    const orderId = paytm || razor || stripe;
    const method = paytm ? 'paytm' : razor ? 'razorpay' : stripe ? 'stripe' : '';
    if (orderId && method) {
      setPaymentMethod(method);
      setPaymentOrderId(orderId);
      checkPaymentStatus(orderId, method);
      let tries = 0;
      const maxTries = 6;
      const timer = setInterval(() => {
        tries += 1;
        checkPaymentStatus(orderId, method);
        if (tries >= maxTries) clearInterval(timer);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [location.search]);

  useEffect(() => {
    let list = [...allDoctors];
    const minExp = Number(filters.minExperience || 0);
    if (minExp) list = list.filter((d) => Number(d.experience_years || 0) >= minExp);
    if (filters.sortBy === 'experience_desc') {
      list.sort((a, b) => Number(b.experience_years || 0) - Number(a.experience_years || 0));
    } else if (filters.sortBy === 'experience_asc') {
      list.sort((a, b) => Number(a.experience_years || 0) - Number(b.experience_years || 0));
    } else if (filters.sortBy === 'fee_low') {
      list.sort((a, b) => Number(a.consultation_fee || 0) - Number(b.consultation_fee || 0));
    } else if (filters.sortBy === 'fee_high') {
      list.sort((a, b) => Number(b.consultation_fee || 0) - Number(a.consultation_fee || 0));
    } else if (filters.sortBy === 'name') {
      list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    }
    setDoctors(list);
  }, [allDoctors, filters]);

  const loadSlots = async (doctor, dateOverride) => {
    setSelectedDoctor(doctor);
    setSelectedSession(null);
    setBookingInfo(null);
    if (!doctor?.clinic_id) {
      toast.error('Clinic information missing for this doctor');
      setSessions([]);
      return;
    }
    const targetDate = dateOverride || appointmentDate;
    try {
      const { data } = await appointmentAPI.getSlots({
        doctor_id: doctor.id,
        clinic_id: doctor.clinic_id,
        date: targetDate,
      });
      setSessions(data.slots || []);
    } catch {
      toast.error('Failed to load sessions');
    }
  };

  const handleBook = async () => {
    if (!selectedDoctor || !selectedSession) {
      toast.error('Please select a doctor and session');
      return;
    }
    if (bookingFee > 0) {
      if (paymentMethod === 'razorpay') {
        await startRazorpayPayment();
      } else if (paymentMethod === 'stripe') {
        await startStripePayment();
      } else {
        await startPaytmPayment();
      }
      return;
    }
    await submitBooking('free');
  };

  const submitBooking = async (paymentStatus) => {
    setLoading(true);
    try {
      const reasonText = reason.trim();
      const modeTag = consultationMode === 'video' ? '[VIDEO]' : '';
      const reasonForVisit = `${modeTag} ${reasonText}`.trim();
      const { data } = await appointmentAPI.book({
        doctor_id: selectedDoctor.id,
        clinic_id: selectedDoctor.clinic_id,
        appointment_date: appointmentDate,
        session_id: selectedSession.session_id,
        reason_for_visit: reasonForVisit,
        consultation_mode: consultationMode,
        priority_level: priorityLevel,
        payment_status: paymentStatus === 'paid' ? 'paid' : 'free',
        payment_reference: paymentStatus === 'paid' ? `manual-${Date.now()}` : null,
      });
      setBookingInfo({ ...data, doctor: selectedDoctor, session: selectedSession });
      toast.success('Appointment booked');
    } catch {
      toast.error('Booking failed');
    } finally {
      setLoading(false);
    }
  };

  const startPaytmPayment = async () => {
    setPaying(true);
    try {
      const reasonText = reason.trim();
      const modeTag = consultationMode === 'video' ? '[VIDEO]' : '';
      const reasonForVisit = `${modeTag} ${reasonText}`.trim();
      const { data } = await paymentAPI.initiatePaytm({
        doctor_id: selectedDoctor.id,
        clinic_id: selectedDoctor.clinic_id,
        appointment_date: appointmentDate,
        appointment_time: selectedSession?.start_time,
        session_id: selectedSession.session_id,
        reason_for_visit: reasonForVisit,
        consultation_mode: consultationMode,
        priority_level: priorityLevel
      });
      setPaymentOrderId(data.order_id);
      openPaytmCheckout(data);
      toast.success('Payment window opened. Complete payment, then refresh status.');
    } catch {
      toast.error('Payment initiation failed');
    } finally {
      setPaying(false);
    }
  };

  const openPaytmCheckout = (data) => {
    const base = String(data.env || 'staging').toLowerCase() === 'production'
      ? 'https://securegw.paytm.in'
      : 'https://securegw-stage.paytm.in';
    const action = `${base}/theia/api/v1/showPaymentPage?mid=${data.mid}&orderId=${data.order_id}`;
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = action;
    form.target = '_blank';
    const add = (name, value) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };
    add('mid', data.mid);
    add('orderId', data.order_id);
    add('txnToken', data.txn_token);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  const startRazorpayPayment = async () => {
    setPaying(true);
    try {
      const reasonText = reason.trim();
      const modeTag = consultationMode === 'video' ? '[VIDEO]' : '';
      const reasonForVisit = `${modeTag} ${reasonText}`.trim();
      const { data } = await paymentAPI.initiateRazorpay({
        doctor_id: selectedDoctor.id,
        clinic_id: selectedDoctor.clinic_id,
        appointment_date: appointmentDate,
        appointment_time: selectedSession?.start_time,
        session_id: selectedSession.session_id,
        reason_for_visit: reasonForVisit,
        consultation_mode: consultationMode,
        priority_level: priorityLevel
      });
      setPaymentOrderId(data.order_id);
      if (data.payment_url) {
        window.open(data.payment_url, '_blank');
      }
      toast.success('Razorpay payment opened. Complete payment, then refresh status.');
    } catch {
      toast.error('Payment initiation failed');
    } finally {
      setPaying(false);
    }
  };

  const startStripePayment = async () => {
    setPaying(true);
    try {
      const reasonText = reason.trim();
      const modeTag = consultationMode === 'video' ? '[VIDEO]' : '';
      const reasonForVisit = `${modeTag} ${reasonText}`.trim();
      const { data } = await paymentAPI.initiateStripe({
        doctor_id: selectedDoctor.id,
        clinic_id: selectedDoctor.clinic_id,
        appointment_date: appointmentDate,
        appointment_time: selectedSession?.start_time,
        session_id: selectedSession.session_id,
        reason_for_visit: reasonForVisit,
        consultation_mode: consultationMode,
        priority_level: priorityLevel
      });
      setPaymentOrderId(data.order_id);
      if (data.payment_url) {
        window.open(data.payment_url, '_blank');
      }
      toast.success('Stripe checkout opened. Complete payment, then refresh status.');
    } catch {
      toast.error('Payment initiation failed');
    } finally {
      setPaying(false);
    }
  };

  const checkPaymentStatus = async (orderId = paymentOrderId, method = paymentMethod) => {
    if (!orderId || !method) return;
    setCheckingPayment(true);
    try {
      let resp;
      if (method === 'razorpay') resp = await paymentAPI.getRazorpayStatus(orderId);
      else if (method === 'stripe') resp = await paymentAPI.getStripeStatus(orderId);
      else resp = await paymentAPI.getPaytmStatus(orderId);
      const data = resp.data;
      setPaymentStatus(data.status || '');
      if (data.status === 'paid' && data.appointment_id) {
        setBookingInfo({
          queue_number: data.queue_number,
          doctor: selectedDoctor,
          session: selectedSession
        });
        toast.success('Payment confirmed. Appointment booked.');
      }
    } catch {
      toast.error('Unable to check payment status');
    } finally {
      setCheckingPayment(false);
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Find a Doctor</div>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Doctor Name</label>
              <input className="form-input" value={search.name} onChange={(e) => setSearch({ ...search, name: e.target.value })} placeholder="e.g. Rajesh" />
            </div>
            <div className="form-group">
              <label className="form-label">City</label>
              <input className="form-input" value={search.city} onChange={(e) => setSearch({ ...search, city: e.target.value })} placeholder="e.g. Bengaluru" />
            </div>
          </div>
          <div className="form-grid" style={{ marginTop: 6 }}>
            <div className="form-group">
              <label className="form-label">Min Experience (Years)</label>
              <select className="form-select" value={filters.minExperience} onChange={(e) => setFilters({ ...filters, minExperience: e.target.value })}>
                <option value="">Any</option>
                {[1, 3, 5, 8, 10, 15].map((y) => (
                  <option key={y} value={y}>{y}+ years</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Sort By</label>
              <select className="form-select" value={filters.sortBy} onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}>
                <option value="experience_desc">Famous (Most Experienced)</option>
                <option value="experience_asc">Least Experienced</option>
                <option value="fee_low">Lowest Fee</option>
                <option value="fee_high">Highest Fee</option>
                <option value="name">Name (A-Z)</option>
              </select>
            </div>
          </div>
          <div className="form-grid" style={{ alignItems: 'end', marginTop: 6 }}>
            <div className="form-group">
              <label className="form-label">Near Me (GPS)</label>
              <button
                className="btn btn-outline"
                onClick={() => (geo.status === 'ready' ? handleSearch() : handleUseLocation())}
                disabled={geo.status === 'loading'}
              >
                {geo.status === 'loading' ? 'Detecting...' : geo.status === 'ready' ? 'Fetch Nearby' : 'Use My Location'}
              </button>
              {geo.status === 'ready' && (
                <div className="form-hint">Using GPS location for nearby doctors.</div>
              )}
              {geo.status === 'error' && (
                <div className="form-hint" style={{ color: '#B91C1C' }}>{geo.error || 'Location error'}</div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Radius (km)</label>
              <select className="form-select" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} disabled={geo.status !== 'ready'}>
                {[5, 10, 15, 25, 50].map((r) => (
                  <option key={r} value={r}>{r} km</option>
                ))}
              </select>
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Select Doctor</div>
        </div>
        <div className="card-body">
          {doctors.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>Search to see doctors.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Doctor</th>
                    <th>Specialization</th>
                    <th>Clinic</th>
                    <th>City</th>
                    {geo.status === 'ready' && <th>Distance</th>}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {doctors.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {d.profile_image ? (
                            <img src={d.profile_image} alt={d.name} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                              {(d.name || 'D').slice(0, 1)}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 700 }}>{d.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {d.experience_years ? `${d.experience_years} yrs` : '-'} - {d.consultation_fee ? `Starts at INR ${d.consultation_fee}` : 'Fee N/A'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{d.specialization}</td>
                      <td>{d.clinic_name}</td>
                      <td>{d.city}</td>
                      {geo.status === 'ready' && (
                        <td>{d.distance_km ? `${Number(d.distance_km).toFixed(1)} km` : '-'}</td>
                      )}
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={() => loadSlots(d)}>
                          Select
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

      {selectedDoctor && (
        <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Choose Date & Session</div>
        </div>
        <div className="card-body">
            <div className="form-group" style={{ maxWidth: 280 }}>
              <label className="form-label">Appointment Date</label>
              <input
                className="form-input"
                type="date"
                value={appointmentDate}
                onChange={(e) => {
                  const nextDate = e.target.value;
                  setAppointmentDate(nextDate);
                  loadSlots(selectedDoctor, nextDate);
                }}
              />
            </div>

            {sessions.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>No sessions available for this date.</div>
            ) : (
              <>
                {!sessions.some((s) => s.is_available) && (
                  <div style={{ color: '#B45309', background: '#FEF3C7', padding: '8px 12px', borderRadius: 8, marginBottom: 10, fontSize: 12, fontWeight: 600 }}>
                    All sessions are fully booked for this date. Please try another day.
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  {sessions.map((s) => (
                    <button
                      key={s.session_id}
                      className={`btn ${selectedSession?.session_id === s.session_id ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => s.is_available && setSelectedSession(s)}
                      disabled={!s.is_available}
                      title={s.is_available ? 'Available' : 'Full'}
                      style={{ textAlign: 'left', padding: 12 }}
                    >
                      <div style={{ fontWeight: 700 }}>{s.label || 'Session'}</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>
                        {String(s.start_time || '').slice(0, 5)} - {String(s.end_time || '').slice(0, 5)}
                      </div>
                      <div style={{ fontSize: 12, marginTop: 6 }}>
                        Capacity: {s.max_patients} - Booked: {s.booked_count}
                      </div>
                      <div style={{ fontSize: 12 }}>
                        Est. wait: ~{(s.booked_count || 0) * (s.avg_minutes || 10)} min
                      </div>
                      {!s.is_available && (
                        <div style={{ fontSize: 12, marginTop: 4, color: '#B45309' }}>Full</div>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label">Consultation Type</label>
              <select className="form-select" value={consultationMode} onChange={(e) => setConsultationMode(e.target.value)}>
                <option value="in_person">In-Person</option>
                <option value="video">Video Consultation</option>
              </select>
            </div>

            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label">Priority</label>
              <select className="form-select" value={priorityLevel} onChange={(e) => setPriorityLevel(e.target.value)}>
                <option value="normal">Normal</option>
                <option value="priority">Priority (Emergency)</option>
              </select>
              <div className="form-hint">Priority gets the next available queue number. Normal queue stays unchanged.</div>
            </div>

            {bookingFee > 0 && (
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Payment Method</label>
                <select className="form-select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="razorpay">Razorpay</option>
                  <option value="stripe">Stripe</option>
                  <option value="paytm">Paytm</option>
                </select>
                <div className="form-hint">Choose how you want to pay the booking fee.</div>
              </div>
            )}

            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label">Reason for Visit (Optional)</label>
              <textarea className="form-textarea" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={handleBook} disabled={loading || !selectedSession || paying}>
                {loading || paying ? 'Processing...' : bookingFee > 0 ? `Pay INR ${bookingFee} & Book` : 'Book Appointment'}
              </button>
              {bookingFee > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Booking fee set by admin. Payment opens in a new window.
                </div>
              )}
            </div>
            {bookingFee > 0 && paymentOrderId && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Order: {paymentOrderId}</div>
                <button className="btn btn-outline btn-sm" onClick={() => checkPaymentStatus(paymentOrderId)} disabled={checkingPayment}>
                  {checkingPayment ? 'Checking...' : 'Refresh Payment Status'}
                </button>
                {paymentStatus && (
                  <span className={`badge ${paymentStatus === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                    {paymentStatus}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {bookingInfo && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Booking Confirmed</div>
          </div>
          <div className="card-body">
            <div style={{ fontWeight: 700 }}>{bookingInfo.doctor.name}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{bookingInfo.doctor.clinic_name}</div>
            <div style={{ marginTop: 8 }}>
              Date: <strong>{appointmentDate}</strong> - Session: <strong>{formatSessionLabel(bookingInfo.session)}</strong>
            </div>
            <div style={{ marginTop: 4 }}>
              Queue Number: <strong>#{String(bookingInfo.queue_number || '').padStart(2, '0')}</strong>
            </div>
            {priorityLevel === 'priority' && (
              <div style={{ marginTop: 6 }}>
                <span className="badge badge-warning">Priority</span>
              </div>
            )}
          </div>
        </div>
      )}

      {bookingFee > 0 && paymentStatus === 'failed' && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-body" style={{ color: '#B91C1C' }}>
            Payment failed or cancelled. Please try again.
          </div>
        </div>
      )}
    </div>
  );
}

