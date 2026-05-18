const { pool } = require('../config/database');
const { sendNotification } = require('../utils/notification');
const moment = require('moment');
const { createZoomMeeting } = require('../utils/zoom');
const jwt = require('jsonwebtoken');
const { enforcePlanRule, SubscriptionLimitError } = require('../utils/subscriptionLimits');

const ensureSettingsTable = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(64) PRIMARY KEY,
      setting_value VARCHAR(255),
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );
};

const getBookingFee = async () => {
  await ensureSettingsTable();
  const [rows] = await pool.query(
    "SELECT setting_value FROM system_settings WHERE setting_key = 'booking_fee' LIMIT 1"
  );
  const fee = rows.length ? Number(rows[0].setting_value) : 0;
  return Number.isFinite(fee) ? fee : 0;
};

const isVideoMode = (mode, reason) => {
  const m = String(mode || '').toLowerCase();
  if (['video', 'online', 'virtual', 'tele', 'telemedicine'].includes(m)) return true;
  const r = String(reason || '').toLowerCase();
  return r.includes('[video]') || r.includes('video consultation');
};

const getSchedulesForDate = async (doctorId, clinicId, date) => {
  const dayOfWeek = moment(date).day();
  const [overrideSchedules] = await pool.query(
    `SELECT * FROM doctor_schedules
     WHERE doctor_id = ? AND clinic_id = ? AND override_date = ? AND is_active = 1
     ORDER BY start_time ASC`,
    [doctorId, clinicId, date]
  );
  if (overrideSchedules.length) {
    return { schedules: overrideSchedules, usesOverride: true };
  }

  const [weeklySchedules] = await pool.query(
    `SELECT * FROM doctor_schedules
     WHERE doctor_id = ? AND clinic_id = ? AND day_of_week = ? AND is_active = 1 AND override_date IS NULL
     ORDER BY start_time ASC`,
    [doctorId, clinicId, dayOfWeek]
  );
  return { schedules: weeklySchedules, usesOverride: false };
};

const notifyAdmins = async (io, type) => {
  try {
    const [admins] = await pool.query(
      `SELECT u.id FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE r.name = 'admin' AND u.is_active = 1`
    );
    admins.forEach((a) => {
      io?.to(`user_${a.id}`).emit('admin_counts_refresh', { type });
    });
  } catch {
    // ignore admin notify failures
  }
};

const emitQueueProgress = async (io, clinicId, date) => {
  if (!clinicId || !date) return;
  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.queue_number, a.appointment_time, a.status, a.priority_level, p.name as patient_name,
              ds.session_label, ds.start_time as session_start_time, ds.end_time as session_end_time
       FROM appointments a
       JOIN users p ON a.patient_id = p.id
       LEFT JOIN doctor_schedules ds ON a.session_id = ds.id
       WHERE a.clinic_id = ? AND a.appointment_date = ?
         AND a.status IN ('pending','confirmed','checked_in')
       ORDER BY COALESCE(ds.start_time, a.appointment_time) ASC, a.queue_number ASC
       LIMIT 1`,
      [clinicId, date]
    );
    const next = rows[0] || null;
    io?.to(`clinic_${clinicId}`).emit('queue_progress', {
      clinic_id: clinicId,
      appointment_date: date,
      next: next
        ? {
            appointment_id: next.id,
            queue_number: next.queue_number,
            appointment_time: next.appointment_time,
            status: next.status,
            patient_name: next.patient_name,
            session_label: next.session_label,
            session_start_time: next.session_start_time,
            session_end_time: next.session_end_time,
            priority_level: next.priority_level
          }
        : null
    });

    const [patients] = await pool.query(
      'SELECT DISTINCT patient_id FROM appointments WHERE clinic_id = ? AND appointment_date = ? AND status NOT IN (\'cancelled\',\'no_show\')',
      [clinicId, date]
    );
    patients.forEach((p) => {
      io?.to(`user_${p.patient_id}`).emit('queue_progress', {
        clinic_id: clinicId,
        appointment_date: date,
        next: next
          ? {
              appointment_id: next.id,
              queue_number: next.queue_number,
              appointment_time: next.appointment_time,
              status: next.status,
              session_label: next.session_label,
              session_start_time: next.session_start_time,
              session_end_time: next.session_end_time,
              priority_level: next.priority_level
            }
          : null
      });
    });
  } catch {
    // ignore progression failures
  }
};

// Get available slots for a doctor on a date
exports.getAvailableSlots = async (req, res) => {
  const { doctor_id, clinic_id, date } = req.query;
  try {
    const { schedules: loadedSchedules, usesOverride } = await getSchedulesForDate(doctor_id, clinic_id, date);
    let schedules = loadedSchedules;

    if (!schedules.length) return res.json({ slots: [], message: 'No sessions for this day' });

    // Check leaves
    const [leaves] = await pool.query(
      'SELECT * FROM doctor_leaves WHERE doctor_id = ? AND leave_date = ?',
      [doctor_id, date]
    );
    if (leaves.length && leaves[0].leave_type === 'full_day') {
      return res.json({ slots: [], message: 'Doctor is on leave' });
    }
    if (leaves.length && !usesOverride) {
      const leaveType = leaves[0].leave_type;
      if (leaveType === 'morning') {
        schedules = schedules.filter((s) => String(s.start_time) >= '12:00:00' && !String(s.session_label || '').toLowerCase().includes('morning'));
      }
      if (leaveType === 'evening') {
        schedules = schedules.filter((s) => String(s.start_time) < '12:00:00' && !String(s.session_label || '').toLowerCase().includes('evening'));
      }
    }

    const sessions = [];
    for (const s of schedules) {
      const [bookings] = await pool.query(
        `SELECT COUNT(*) as count FROM appointments 
         WHERE doctor_id = ? AND clinic_id = ? AND appointment_date = ? AND session_id = ?
         AND status NOT IN ('cancelled', 'no_show')`,
        [doctor_id, clinic_id, date, s.id]
      );
      const booked = bookings[0].count;
      const maxPatients = Number(s.max_patients_per_slot || 0) || 30;
      const available = Math.max(0, maxPatients - booked);
      sessions.push({
        session_id: s.id,
        label: s.session_label || 'Session',
        start_time: s.start_time,
        end_time: s.end_time,
        max_patients: maxPatients,
        booked_count: booked,
        available_count: available,
        is_available: available > 0,
        avg_minutes: s.slot_duration_minutes || 15
      });
    }

    res.json({ slots: sessions, schedule: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Book appointment
exports.bookAppointment = async (req, res) => {
  const { doctor_id, clinic_id, appointment_date, appointment_time, reason_for_visit, consultation_mode, session_id, priority_level, payment_status, payment_reference } = req.body;
  const patient_id = req.user.role === 'patient' ? req.user.id : req.body.patient_id;

  try {
    const priority = String(priority_level || '').toLowerCase() === 'priority' ? 'priority' : 'normal';
    if (!session_id) {
      return res.status(400).json({ error: 'Session is required' });
    }

    const bookingFee = await getBookingFee();
    const paymentStatus = String(payment_status || '').toLowerCase();
    if (bookingFee > 0 && paymentStatus !== 'paid') {
      return res.status(400).json({ error: 'Payment required to book this appointment' });
    }

    const [schedule] = await pool.query(
      `SELECT * FROM doctor_schedules WHERE id = ? AND doctor_id = ? AND clinic_id = ? AND is_active = 1`,
      [session_id, doctor_id, clinic_id]
    );
    if (!schedule.length) return res.status(400).json({ error: 'Invalid session selected' });
    const sched = schedule[0];
    const requestedDate = moment(appointment_date).format('YYYY-MM-DD');
    if (sched.override_date) {
      if (moment(sched.override_date).format('YYYY-MM-DD') !== requestedDate) {
        return res.status(400).json({ error: 'Selected custom session does not match the chosen date' });
      }
    } else if (sched.day_of_week !== moment(appointment_date).day()) {
      return res.status(400).json({ error: 'Session does not match selected date' });
    }

    const [existing] = await pool.query(
      `SELECT COUNT(*) as count FROM appointments 
       WHERE doctor_id = ? AND clinic_id = ? AND appointment_date = ? AND session_id = ?
       AND status NOT IN ('cancelled', 'no_show')`,
      [doctor_id, clinic_id, appointment_date, session_id]
    );
    const maxPatients = Number(sched.max_patients_per_slot || 0) || 30;
    if (existing[0].count >= maxPatients) {
      return res.status(400).json({ error: 'Session is fully booked' });
    }
    const queueNumber = existing[0].count + 1;
    const slotNumber = queueNumber;
    const sessionStartTime = sched.start_time;

    const isVideo = isVideoMode(consultation_mode, reason_for_visit);
    let videoProvider = null;
    let videoMeetingUrl = null;
    let videoHostUrl = null;

    const bookingStartTime = sessionStartTime || appointment_time;
    if (isVideo) {
      try {
        const startIso = moment(`${appointment_date} ${bookingStartTime}`).toISOString();
        const durationMinutes = schedule.length ? Number(schedule[0].slot_duration_minutes || 30) : 30;
        const meeting = await createZoomMeeting({
          topic: `Consultation - Dr ${doctor_id}`,
          startTime: startIso,
          durationMinutes
        });
        videoProvider = 'zoom';
        videoMeetingUrl = meeting.join_url || null;
        videoHostUrl = meeting.start_url || null;
      } catch (err) {
        return res.status(500).json({ error: 'Zoom meeting creation failed. Please configure Zoom.' });
      }
    }

    const [result] = await pool.query(
      `INSERT INTO appointments 
       (patient_id, doctor_id, clinic_id, appointment_date, appointment_time, slot_number, queue_number, session_id, priority_level, reason_for_visit, consultation_mode, video_provider, video_meeting_url, video_host_url, booked_by, booked_by_user_id, booking_fee, payment_status, payment_reference)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patient_id,
        doctor_id,
        clinic_id,
        appointment_date,
        sessionStartTime || appointment_time,
        slotNumber,
        queueNumber,
        session_id,
        priority,
        reason_for_visit,
        isVideo ? 'video' : 'in_person',
        videoProvider,
        videoMeetingUrl,
        videoHostUrl,
        req.user.role,
        req.user.id,
        bookingFee,
        bookingFee > 0 ? 'paid' : 'free',
        payment_reference || null
      ]
    );

    const appointmentId = result.insertId;

    // Notifications
    const [doctor] = await pool.query('SELECT name FROM users WHERE id = ?', [doctor_id]);
    const [patient] = await pool.query('SELECT name FROM users WHERE id = ?', [patient_id]);
    const [clinic] = await pool.query('SELECT name FROM clinics WHERE id = ?', [clinic_id]);

    await sendNotification(patient_id, 'Appointment Booked',
      `Appointment with Dr. ${doctor[0].name} on ${moment(appointment_date).format('DD MMM YYYY')} (${sched.session_label || 'Session'}). Queue: #${queueNumber}`,
      'appointment', appointmentId, 'appointment');

    await sendNotification(doctor_id, 'New Appointment',
      `New appointment from ${patient[0].name} on ${moment(appointment_date).format('DD MMM YYYY')} (${sched.session_label || 'Session'})`,
      'appointment', appointmentId, 'appointment');

    // Notify receptionists
    const [receptionists] = await pool.query(
      'SELECT user_id FROM receptionist_profiles WHERE clinic_id = ?', [clinic_id]
    );
    for (const r of receptionists) {
      await sendNotification(r.user_id, 'New Appointment',
        `${patient[0].name} booked with Dr. ${doctor[0].name}`, 'appointment', appointmentId, 'appointment');
    }

    const io = req.app.get('io');
    io?.to(`clinic_${clinic_id}`).emit('queue_update', {
      appointment_id: appointmentId,
      clinic_id,
      status: 'pending',
      queue_number: queueNumber,
      appointment_date,
      appointment_time,
      type: 'booked'
    });
    io?.to(`user_${patient_id}`).emit('queue_update', {
      appointment_id: appointmentId,
      clinic_id,
      status: 'pending',
      queue_number: queueNumber,
      appointment_date,
      appointment_time,
      type: 'booked'
    });
    io?.to(`user_${doctor_id}`).emit('queue_update', {
      appointment_id: appointmentId,
      clinic_id,
      status: 'pending',
      queue_number: queueNumber,
      appointment_date,
      appointment_time,
      type: 'booked'
    });
    await emitQueueProgress(io, clinic_id, appointment_date);
    await notifyAdmins(io, 'appointment_booked');

    res.status(201).json({ message: 'Appointment booked successfully', appointment_id: appointmentId, queue_number: queueNumber });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get booking fee (for patients)
exports.getBookingFee = async (req, res) => {
  try {
    const fee = await getBookingFee();
    res.json({ booking_fee: fee });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get appointments (filtered by role)
exports.getAppointments = async (req, res) => {
  const { date, status, clinic_id } = req.query;
  const user = req.user;

  try {
    let query = `
      SELECT a.*, 
        p.name as patient_name, p.phone as patient_phone,
        d.name as doctor_name,
        c.name as clinic_name,
        ds.session_label, ds.start_time as session_start_time, ds.end_time as session_end_time, ds.slot_duration_minutes as avg_minutes
      FROM appointments a
      JOIN users p ON a.patient_id = p.id
      JOIN users d ON a.doctor_id = d.id
      JOIN clinics c ON a.clinic_id = c.id
      LEFT JOIN doctor_schedules ds ON a.session_id = ds.id
      WHERE 1=1
    `;
    const params = [];

    if (user.role === 'patient') {
      query += ' AND a.patient_id = ?'; params.push(user.id);
    } else if (user.role === 'doctor') {
      query += ' AND a.doctor_id = ?'; params.push(user.id);
    } else if (user.role === 'receptionist') {
      const [rp] = await pool.query('SELECT clinic_id FROM receptionist_profiles WHERE user_id = ?', [user.id]);
      if (rp.length) { query += ' AND a.clinic_id = ?'; params.push(rp[0].clinic_id); }
    }

    if (date) { query += ' AND a.appointment_date = ?'; params.push(date); }
    if (status) { query += ' AND a.status = ?'; params.push(status); }
    if (clinic_id && user.role !== 'patient') { query += ' AND a.clinic_id = ?'; params.push(clinic_id); }

    query += ' ORDER BY a.appointment_date DESC, a.appointment_time ASC';

    const [appointments] = await pool.query(query, params);
    res.json({ appointments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get queue timeline for a clinic/date
exports.getQueueTimeline = async (req, res) => {
  const { clinic_id, date } = req.query;
  const user = req.user;
  if (!clinic_id || !date) return res.status(400).json({ error: 'clinic_id and date are required' });

  try {
    if (user.role === 'patient') {
      const [owns] = await pool.query(
        'SELECT id FROM appointments WHERE patient_id = ? AND clinic_id = ? AND appointment_date = ? LIMIT 1',
        [user.id, clinic_id, date]
      );
      if (!owns.length) return res.status(403).json({ error: 'Access denied' });
    }

    const [rows] = await pool.query(
      `SELECT a.id, a.queue_number, a.appointment_time, a.status, a.patient_id, a.doctor_id, a.priority_level,
              p.name as patient_name,
              COALESCE(ds.slot_duration_minutes, 15) as slot_duration_minutes,
              ds.session_label, ds.start_time as session_start_time, ds.end_time as session_end_time
       FROM appointments a
       JOIN users p ON a.patient_id = p.id
       LEFT JOIN doctor_schedules ds ON a.session_id = ds.id
       WHERE a.clinic_id = ? AND a.appointment_date = ?
         AND a.status NOT IN ('cancelled','no_show')
       ORDER BY COALESCE(ds.start_time, a.appointment_time) ASC, a.queue_number ASC`,
      [clinic_id, date]
    );

    let timeline = rows;
    if (user.role === 'patient') {
      timeline = rows.map((r) => ({
        queue_number: r.queue_number,
        appointment_time: r.appointment_time,
        status: r.status,
        is_me: r.patient_id === user.id,
        slot_duration_minutes: r.slot_duration_minutes,
        priority_level: r.priority_level,
        session_label: r.session_label,
        session_start_time: r.session_start_time,
        session_end_time: r.session_end_time
      }));
    }

    res.json({ timeline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update appointment status
exports.updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  try {
    const updates = { status };
    if (status === 'checked_in') updates.checked_in_at = new Date();
    if (status === 'completed') updates.checked_out_at = new Date();

    await pool.query('UPDATE appointments SET ?, notes = ? WHERE id = ?', [updates, notes || null, id]);

    const [appt] = await pool.query(
      'SELECT a.*, p.name as patient_name FROM appointments a JOIN users p ON a.patient_id = p.id WHERE a.id = ?', [id]
    );

    if (appt.length) {
      const statusMessages = {
        confirmed: 'Your appointment has been confirmed',
        checked_in: 'You have been checked in',
        in_consultation: 'Your consultation has started',
        completed: 'Your appointment is completed',
        cancelled: 'Your appointment has been cancelled',
        no_show: 'Marked as no-show'
      };
      if (statusMessages[status]) {
        await sendNotification(appt[0].patient_id, 'Appointment Update', statusMessages[status], 'appointment', id, 'appointment');
      }
    }

    if (appt.length) {
      const io = req.app.get('io');
      io?.to(`clinic_${appt[0].clinic_id}`).emit('queue_update', {
        appointment_id: id,
        clinic_id: appt[0].clinic_id,
        status,
        queue_number: appt[0].queue_number,
        appointment_date: appt[0].appointment_date,
        appointment_time: appt[0].appointment_time,
        type: 'status_update'
      });
      io?.to(`user_${appt[0].patient_id}`).emit('queue_update', {
        appointment_id: id,
        clinic_id: appt[0].clinic_id,
        status,
        queue_number: appt[0].queue_number,
        appointment_date: appt[0].appointment_date,
        appointment_time: appt[0].appointment_time,
        type: 'status_update'
      });
      io?.to(`user_${appt[0].doctor_id}`).emit('queue_update', {
        appointment_id: id,
        clinic_id: appt[0].clinic_id,
        status,
        queue_number: appt[0].queue_number,
        appointment_date: appt[0].appointment_date,
        appointment_time: appt[0].appointment_time,
        type: 'status_update'
      });
      await emitQueueProgress(io, appt[0].clinic_id, moment(appt[0].appointment_date).format('YYYY-MM-DD'));
      await notifyAdmins(io, 'appointment_status');
    }

    res.json({ message: 'Status updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Generate QR token for patient check-in
exports.getQrToken = async (req, res) => {
  const { id } = req.params;
  try {
    if (req.user.role !== 'patient') {
      return res.status(403).json({ error: 'Only patients can access QR' });
    }
    const [rows] = await pool.query(
      `SELECT id, patient_id, clinic_id, appointment_date, status
       FROM appointments WHERE id = ? AND patient_id = ?`,
      [id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Appointment not found' });
    const appt = rows[0];
    if (['cancelled', 'no_show'].includes(appt.status)) {
      return res.status(400).json({ error: 'Appointment is not active' });
    }
    const token = jwt.sign(
      {
        appt_id: appt.id,
        patient_id: appt.patient_id,
        clinic_id: appt.clinic_id,
        appointment_date: appt.appointment_date
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '2d' }
    );
    res.json({ token, appointment_id: appt.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Check-in appointment by QR scan
exports.checkInByQr = async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'QR token required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const appointmentId = decoded.appt_id;
    const patientId = decoded.patient_id;
    if (!appointmentId || !patientId) return res.status(400).json({ error: 'Invalid QR token' });

    const [rows] = await pool.query(
      `SELECT * FROM appointments WHERE id = ? AND patient_id = ?`,
      [appointmentId, patientId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Appointment not found' });
    const appt = rows[0];

    if (['cancelled', 'no_show'].includes(appt.status)) {
      return res.status(400).json({ error: 'Appointment not active' });
    }

    const today = moment().format('YYYY-MM-DD');
    if (String(appt.appointment_date) !== today) {
      return res.status(400).json({ error: 'Check-in allowed only on appointment date' });
    }

    if (req.user.role === 'doctor' && Number(appt.doctor_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Not your appointment' });
    }
    if (req.user.role === 'receptionist') {
      const [rowsRec] = await pool.query(
        'SELECT clinic_id FROM receptionist_profiles WHERE user_id = ? LIMIT 1',
        [req.user.id]
      );
      const recClinic = rowsRec[0]?.clinic_id;
      if (!recClinic || Number(recClinic) !== Number(appt.clinic_id)) {
        return res.status(403).json({ error: 'Not your clinic appointment' });
      }
    }

    if (['checked_in', 'in_consultation', 'completed'].includes(appt.status)) {
      return res.json({ message: 'Already checked in', appointment_id: appt.id, status: appt.status });
    }

    await pool.query(
      'UPDATE appointments SET status = ?, checked_in_at = NOW() WHERE id = ?',
      ['checked_in', appt.id]
    );

    await sendNotification(appt.patient_id, 'Appointment Update', 'You have been checked in', 'appointment', appt.id, 'appointment');

    const io = req.app.get('io');
    io?.to(`clinic_${appt.clinic_id}`).emit('queue_update', {
      appointment_id: appt.id,
      clinic_id: appt.clinic_id,
      status: 'checked_in',
      queue_number: appt.queue_number,
      appointment_date: appt.appointment_date,
      appointment_time: appt.appointment_time,
      type: 'status_update'
    });
    io?.to(`user_${appt.patient_id}`).emit('queue_update', {
      appointment_id: appt.id,
      clinic_id: appt.clinic_id,
      status: 'checked_in',
      queue_number: appt.queue_number,
      appointment_date: appt.appointment_date,
      appointment_time: appt.appointment_time,
      type: 'status_update'
    });
    io?.to(`user_${appt.doctor_id}`).emit('queue_update', {
      appointment_id: appt.id,
      clinic_id: appt.clinic_id,
      status: 'checked_in',
      queue_number: appt.queue_number,
      appointment_date: appt.appointment_date,
      appointment_time: appt.appointment_time,
      type: 'status_update'
    });
    await emitQueueProgress(io, appt.clinic_id, moment(appt.appointment_date).format('YYYY-MM-DD'));
    await notifyAdmins(io, 'appointment_status');

    res.json({ message: 'Checked in', appointment_id: appt.id, status: 'checked_in' });
  } catch (err) {
    res.status(400).json({ error: 'Invalid or expired QR token' });
  }
};

// Walk-in appointment
exports.walkInAppointment = async (req, res) => {
  const { patient_id, doctor_id, clinic_id, notes, session_id, priority_level } = req.body;

  try {
    const priority = String(priority_level || '').toLowerCase() === 'priority' ? 'priority' : 'normal';
    const today = moment().format('YYYY-MM-DD');
    const now = moment().format('HH:mm:ss');

    const [leaves] = await pool.query(
      'SELECT * FROM doctor_leaves WHERE doctor_id = ? AND leave_date = ?',
      [doctor_id, today]
    );
    if (leaves.length && leaves[0].leave_type === 'full_day') {
      return res.status(400).json({ error: 'Doctor is on leave today' });
    }

    const { schedules: loadedSchedules, usesOverride } = await getSchedulesForDate(doctor_id, clinic_id, today);
    let schedules = loadedSchedules;
    if (leaves.length && !usesOverride) {
      const leaveType = leaves[0].leave_type;
      if (leaveType === 'morning') {
        schedules = schedules.filter((s) => String(s.start_time) >= '12:00:00' && !String(s.session_label || '').toLowerCase().includes('morning'));
      }
      if (leaveType === 'evening') {
        schedules = schedules.filter((s) => String(s.start_time) < '12:00:00' && !String(s.session_label || '').toLowerCase().includes('evening'));
      }
    }
    if (!schedules.length) return res.status(400).json({ error: 'No active sessions for today' });

    let selected = null;
    if (session_id) {
      selected = schedules.find((s) => String(s.id) === String(session_id)) || null;
    }
    if (!selected) {
      const nowMoment = moment(`${today} ${now}`);
      selected = schedules.find((s) => {
        const start = moment(`${today} ${s.start_time}`);
        const end = moment(`${today} ${s.end_time}`);
        return nowMoment.isSameOrAfter(start) && nowMoment.isBefore(end);
      }) || null;
    }
    if (!selected) {
      selected = schedules
        .slice()
        .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
        .find((s) => moment(`${today} ${s.start_time}`).isAfter(moment(`${today} ${now}`))) || null;
    }
    if (!selected) return res.status(400).json({ error: 'No upcoming session available for walk-in' });

    const [existing] = await pool.query(
      `SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND clinic_id = ? AND appointment_date = ? AND session_id = ? AND status NOT IN ('cancelled','no_show')`,
      [doctor_id, clinic_id, today, selected.id]
    );
    const maxPatients = Number(selected.max_patients_per_slot || 0) || 30;
    if (existing[0].count >= maxPatients) {
      return res.status(400).json({ error: 'Session is fully booked' });
    }
    const queueNumber = existing[0].count + 1;

    const [result] = await pool.query(
      `INSERT INTO appointments (patient_id, doctor_id, clinic_id, appointment_date, appointment_time, slot_number, queue_number, session_id, priority_level, status, type, notes, booked_by, booked_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'checked_in', 'walk_in', ?, 'receptionist', ?)`,
      [patient_id, doctor_id, clinic_id, today, selected.start_time || now, queueNumber, queueNumber, selected.id, priority, notes, req.user.id]
    );

    const appointmentId = result.insertId;

    const io = req.app.get('io');
    io?.to(`clinic_${clinic_id}`).emit('queue_update', {
      appointment_id: appointmentId,
      clinic_id,
      status: 'checked_in',
      queue_number: queueNumber,
      appointment_date: today,
      appointment_time: now,
      type: 'walk_in'
    });
    io?.to(`user_${patient_id}`).emit('queue_update', {
      appointment_id: appointmentId,
      clinic_id,
      status: 'checked_in',
      queue_number: queueNumber,
      appointment_date: today,
      appointment_time: now,
      type: 'walk_in'
    });
    io?.to(`user_${doctor_id}`).emit('queue_update', {
      appointment_id: appointmentId,
      clinic_id,
      status: 'checked_in',
      queue_number: queueNumber,
      appointment_date: today,
      appointment_time: now,
      type: 'walk_in'
    });
    await emitQueueProgress(io, clinic_id, today);
    await notifyAdmins(io, 'walk_in');

    res.status(201).json({ appointment_id: appointmentId, queue_number: queueNumber, message: 'Walk-in registered' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Re-queue a no-show appointment (assign new queue number)
exports.requeueAppointment = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM appointments WHERE id = ?',
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Appointment not found' });
    const appt = rows[0];
    if (!appt.session_id) return res.status(400).json({ error: 'Session not found for appointment' });
    if (!['no_show', 'cancelled', 'pending', 'confirmed'].includes(appt.status)) {
      return res.status(400).json({ error: 'Only pending/cancelled/no-show appointments can be re-queued' });
    }

    const [[{ maxQueue }]] = await pool.query(
      `SELECT MAX(queue_number) as maxQueue
       FROM appointments
       WHERE clinic_id = ? AND appointment_date = ? AND session_id = ?`,
      [appt.clinic_id, appt.appointment_date, appt.session_id]
    );
    const nextQueue = (maxQueue || 0) + 1;

    await pool.query(
      `UPDATE appointments
       SET queue_number = ?, status = 'confirmed'
       WHERE id = ?`,
      [nextQueue, id]
    );

    const io = req.app.get('io');
    io?.to(`clinic_${appt.clinic_id}`).emit('queue_update', {
      appointment_id: id,
      clinic_id: appt.clinic_id,
      status: 'confirmed',
      queue_number: nextQueue,
      appointment_date: appt.appointment_date,
      appointment_time: appt.appointment_time,
      type: 'requeue'
    });
    io?.to(`user_${appt.patient_id}`).emit('queue_update', {
      appointment_id: id,
      clinic_id: appt.clinic_id,
      status: 'confirmed',
      queue_number: nextQueue,
      appointment_date: appt.appointment_date,
      appointment_time: appt.appointment_time,
      type: 'requeue'
    });

    await emitQueueProgress(io, appt.clinic_id, moment(appt.appointment_date).format('YYYY-MM-DD'));
    await notifyAdmins(io, 'appointment_requeue');

    res.json({ message: 'Appointment re-queued', queue_number: nextQueue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Record patient vitals for an appointment
exports.recordVitals = async (req, res) => {
  const { id } = req.params;
  const {
    blood_pressure, pulse_rate, temperature,
    weight, height, bmi, oxygen_saturation, notes
  } = req.body;

  try {
    const [appt] = await pool.query('SELECT patient_id FROM appointments WHERE id = ?', [id]);
    if (!appt.length) return res.status(404).json({ error: 'Appointment not found' });

    let computedBmi = bmi;
    if (!computedBmi && weight && height) {
      const h = parseFloat(height) / 100;
      const w = parseFloat(weight);
      if (h > 0 && w > 0) computedBmi = (w / (h * h)).toFixed(1);
    }

    const [existing] = await pool.query('SELECT id FROM patient_vitals WHERE appointment_id = ? LIMIT 1', [id]);
    if (existing.length) {
      await pool.query(
        `UPDATE patient_vitals
         SET blood_pressure=?, pulse_rate=?, temperature=?, weight=?, height=?, bmi=?, oxygen_saturation=?, notes=?, recorded_by=?
         WHERE appointment_id = ?`,
        [blood_pressure || null, pulse_rate || null, temperature || null, weight || null, height || null, computedBmi || null,
         oxygen_saturation || null, notes || null, req.user.id, id]
      );
    } else {
      await pool.query(
        `INSERT INTO patient_vitals (appointment_id, patient_id, blood_pressure, pulse_rate, temperature, weight, height, bmi, oxygen_saturation, notes, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, appt[0].patient_id, blood_pressure || null, pulse_rate || null, temperature || null, weight || null, height || null,
         computedBmi || null, oxygen_saturation || null, notes || null, req.user.id]
      );
    }

    res.json({ message: 'Vitals saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
