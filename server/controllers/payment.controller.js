const axios = require('axios');
const crypto = require('crypto');
const PaytmChecksum = require('paytmchecksum');
const Stripe = require('stripe');
const moment = require('moment');
const { pool } = require('../config/database');
const { sendNotification } = require('../utils/notification');
const { createZoomMeeting } = require('../utils/zoom');

const getPaytmBaseUrl = () => {
  const env = String(process.env.PAYTM_ENV || 'staging').toLowerCase();
  return env === 'production' ? 'https://securegw.paytm.in' : 'https://securegw-stage.paytm.in';
};

const getRazorpayClient = () => ({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const getStripeClient = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
};

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
  } catch {
    // ignore progression failures
  }
};

const createAppointmentFromPayment = async (payload, userId, paymentRef) => {
  const {
    doctor_id,
    clinic_id,
    appointment_date,
    appointment_time,
    reason_for_visit,
    consultation_mode,
    session_id,
    priority_level
  } = payload;

  const priority = String(priority_level || '').toLowerCase() === 'priority' ? 'priority' : 'normal';
  if (!session_id) throw new Error('Session is required');

  const [schedule] = await pool.query(
    `SELECT * FROM doctor_schedules WHERE id = ? AND doctor_id = ? AND clinic_id = ? AND is_active = 1`,
    [session_id, doctor_id, clinic_id]
  );
  if (!schedule.length) throw new Error('Invalid session selected');
  const sched = schedule[0];
  if (sched.day_of_week !== moment(appointment_date).day()) {
    throw new Error('Session does not match selected date');
  }

  const [existing] = await pool.query(
    `SELECT COUNT(*) as count FROM appointments 
     WHERE doctor_id = ? AND clinic_id = ? AND appointment_date = ? AND session_id = ?
     AND status NOT IN ('cancelled', 'no_show')`,
    [doctor_id, clinic_id, appointment_date, session_id]
  );
  const maxPatients = Number(sched.max_patients_per_slot || 0) || 30;
  if (existing[0].count >= maxPatients) {
    throw new Error('Session is fully booked');
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
  }

  const bookingFee = await getBookingFee();
  const [result] = await pool.query(
    `INSERT INTO appointments 
     (patient_id, doctor_id, clinic_id, appointment_date, appointment_time, slot_number, queue_number, session_id, priority_level,
      reason_for_visit, consultation_mode, video_provider, video_meeting_url, video_host_url,
      booked_by, booked_by_user_id, booking_fee, payment_status, payment_reference)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
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
      'patient',
      userId,
      bookingFee,
      bookingFee > 0 ? 'paid' : 'free',
      paymentRef || null
    ]
  );

  return { appointmentId: result.insertId, queueNumber };
};

exports.initiatePaytm = async (req, res) => {
  const {
    doctor_id,
    clinic_id,
    appointment_date,
    appointment_time,
    reason_for_visit,
    consultation_mode,
    session_id,
    priority_level
  } = req.body;

  try {
    const bookingFee = await getBookingFee();
    if (bookingFee <= 0) {
      return res.status(400).json({ error: 'Booking fee is not enabled' });
    }
    if (!doctor_id || !clinic_id || !appointment_date || !session_id) {
      return res.status(400).json({ error: 'Missing required booking details' });
    }

    const MID = process.env.PAYTM_MID;
    const MERCHANT_KEY = process.env.PAYTM_MERCHANT_KEY;
    const WEBSITE = process.env.PAYTM_WEBSITE || 'DEFAULT';
    const CALLBACK_URL = process.env.PAYTM_CALLBACK_URL || 'http://localhost:5000/api/payments/paytm/callback';

    if (!MID || !MERCHANT_KEY) {
      return res.status(500).json({ error: 'Paytm is not configured. Add MID and MERCHANT_KEY.' });
    }

    const orderId = `BOOK${Date.now()}${req.user.id}`;
    const amount = Number(bookingFee).toFixed(2);
    const baseUrl = getPaytmBaseUrl();

    const paytmParams = {
      body: {
        requestType: 'Payment',
        mid: MID,
        websiteName: WEBSITE,
        orderId,
        callbackUrl: CALLBACK_URL,
        txnAmount: {
          value: amount,
          currency: 'INR'
        },
        userInfo: {
          custId: `CUST_${req.user.id}`,
          mobile: req.user.phone || undefined,
          email: req.user.email || undefined
        }
      }
    };

    const checksum = await PaytmChecksum.generateSignature(JSON.stringify(paytmParams.body), MERCHANT_KEY);
    paytmParams.head = { signature: checksum };

    const initUrl = `${baseUrl}/theia/api/v1/initiateTransaction?mid=${MID}&orderId=${orderId}`;
    const response = await axios.post(initUrl, paytmParams, { headers: { 'Content-Type': 'application/json' } });
    const txnToken = response.data?.body?.txnToken;
    if (!txnToken) {
      return res.status(500).json({ error: 'Failed to initiate Paytm transaction' });
    }

    const appointmentPayload = {
      doctor_id,
      clinic_id,
      appointment_date,
      appointment_time,
      reason_for_visit,
      consultation_mode,
      session_id,
      priority_level
    };

    await pool.query(
      `INSERT INTO payment_orders (order_id, user_id, amount, status, gateway, appointment_payload)
       VALUES (?, ?, ?, 'created', 'paytm', ?)`,
      [orderId, req.user.id, amount, JSON.stringify(appointmentPayload)]
    );

    res.json({
      order_id: orderId,
      txn_token: txnToken,
      amount,
      mid: MID,
      callback_url: CALLBACK_URL,
      env: process.env.PAYTM_ENV || 'staging'
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Paytm initiation failed' });
  }
};

exports.paytmCallback = async (req, res) => {
  const body = { ...req.body };
  const checksum = body.CHECKSUMHASH;
  delete body.CHECKSUMHASH;

  const MERCHANT_KEY = process.env.PAYTM_MERCHANT_KEY;
  const isValid = await PaytmChecksum.verifySignature(body, MERCHANT_KEY, checksum || '');
  const orderId = body.ORDERID;
  const status = body.STATUS;
  const txnId = body.TXNID || null;

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3001';

  if (!orderId) {
    return res.send(`<html><body>Missing order id.</body></html>`);
  }

  try {
    const [orders] = await pool.query('SELECT * FROM payment_orders WHERE order_id = ? LIMIT 1', [orderId]);
    if (!orders.length) {
      return res.send(`<html><body>Order not found. <a href="${clientUrl}">Return</a></body></html>`);
    }
    const order = orders[0];

    if (!isValid) {
      await pool.query(
        'UPDATE payment_orders SET status = ?, callback_payload = ? WHERE order_id = ?',
        ['failed', JSON.stringify({ ...body, CHECKSUMHASH: checksum || '' }), orderId]
      );
      return res.send(`<html><body>Payment verification failed. <a href="${clientUrl}">Return</a></body></html>`);
    }

    if (status !== 'TXN_SUCCESS') {
      await pool.query(
        'UPDATE payment_orders SET status = ?, callback_payload = ? WHERE order_id = ?',
        ['failed', JSON.stringify({ ...body, CHECKSUMHASH: checksum || '' }), orderId]
      );
      return res.send(`<html><body>Payment not successful. <a href="${clientUrl}">Return</a></body></html>`);
    }

    if (order.status === 'paid' && order.appointment_id) {
      return res.send(`<html><body>Payment already processed. <a href="${clientUrl}/patient/book?paytm_order=${orderId}">Go back</a></body></html>`);
    }

    const appointmentPayload = order.appointment_payload ? JSON.parse(order.appointment_payload) : null;
    if (!appointmentPayload) {
      await pool.query(
        'UPDATE payment_orders SET status = ?, callback_payload = ? WHERE order_id = ?',
        ['failed', JSON.stringify({ ...body, CHECKSUMHASH: checksum || '' }), orderId]
      );
      return res.send(`<html><body>Booking data missing. <a href="${clientUrl}">Return</a></body></html>`);
    }

    const { appointmentId, queueNumber } = await createAppointmentFromPayment(appointmentPayload, order.user_id, txnId || orderId);

    await pool.query(
      `UPDATE payment_orders 
       SET status = 'paid', appointment_id = ?, queue_number = ?, transaction_id = ?, callback_payload = ?
       WHERE order_id = ?`,
      [appointmentId, queueNumber, txnId, JSON.stringify({ ...body, CHECKSUMHASH: checksum || '' }), orderId]
    );

    const [doctor] = await pool.query('SELECT name FROM users WHERE id = ?', [appointmentPayload.doctor_id]);
    const [patient] = await pool.query('SELECT name FROM users WHERE id = ?', [order.user_id]);
    const [clinic] = await pool.query('SELECT name FROM clinics WHERE id = ?', [appointmentPayload.clinic_id]);

    await sendNotification(order.user_id, 'Appointment Booked',
      `Appointment with Dr. ${doctor[0]?.name || ''} on ${moment(appointmentPayload.appointment_date).format('DD MMM YYYY')}. Queue: #${queueNumber}`,
      'appointment', appointmentId, 'appointment');
    await sendNotification(appointmentPayload.doctor_id, 'New Appointment',
      `New appointment from ${patient[0]?.name || ''} on ${moment(appointmentPayload.appointment_date).format('DD MMM YYYY')}`,
      'appointment', appointmentId, 'appointment');

    const io = req.app.get('io');
    io?.to(`clinic_${appointmentPayload.clinic_id}`).emit('queue_update', {
      appointment_id: appointmentId,
      clinic_id: appointmentPayload.clinic_id,
      status: 'pending',
      queue_number: queueNumber,
      appointment_date: appointmentPayload.appointment_date,
      appointment_time: appointmentPayload.appointment_time,
      type: 'booked'
    });
    io?.to(`user_${order.user_id}`).emit('queue_update', {
      appointment_id: appointmentId,
      clinic_id: appointmentPayload.clinic_id,
      status: 'pending',
      queue_number: queueNumber,
      appointment_date: appointmentPayload.appointment_date,
      appointment_time: appointmentPayload.appointment_time,
      type: 'booked'
    });
    io?.to(`user_${appointmentPayload.doctor_id}`).emit('queue_update', {
      appointment_id: appointmentId,
      clinic_id: appointmentPayload.clinic_id,
      status: 'pending',
      queue_number: queueNumber,
      appointment_date: appointmentPayload.appointment_date,
      appointment_time: appointmentPayload.appointment_time,
      type: 'booked'
    });
    await emitQueueProgress(io, appointmentPayload.clinic_id, appointmentPayload.appointment_date);
    await notifyAdmins(io, 'appointment_booked');

    res.send(`
      <html>
        <body style="font-family: Arial; padding: 20px;">
          <h3>Payment Successful</h3>
          <p>Your appointment is confirmed. Queue number: <strong>#${String(queueNumber).padStart(2, '0')}</strong></p>
          <p><a href="${clientUrl}/patient/book?paytm_order=${orderId}">Return to App</a></p>
          <script>
            setTimeout(function(){ window.location.href = "${clientUrl}/patient/book?paytm_order=${orderId}"; }, 4000);
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    res.send(`<html><body>Payment processed but booking failed: ${err.message}</body></html>`);
  }
};

exports.getPaytmStatus = async (req, res) => {
  const { order_id } = req.query;
  if (!order_id) return res.status(400).json({ error: 'order_id is required' });
  try {
    const [orders] = await pool.query(
      'SELECT order_id, status, appointment_id, queue_number FROM payment_orders WHERE order_id = ? AND user_id = ? LIMIT 1',
      [order_id, req.user.id]
    );
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    res.json(orders[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Razorpay initiate (Payment Link)
exports.initiateRazorpay = async (req, res) => {
  const {
    doctor_id,
    clinic_id,
    appointment_date,
    appointment_time,
    reason_for_visit,
    consultation_mode,
    session_id,
    priority_level
  } = req.body;

  try {
    const bookingFee = await getBookingFee();
    if (bookingFee <= 0) return res.status(400).json({ error: 'Booking fee is not enabled' });
    if (!doctor_id || !clinic_id || !appointment_date || !session_id) {
      return res.status(400).json({ error: 'Missing required booking details' });
    }

    const { key_id, key_secret } = getRazorpayClient();
    if (!key_id || !key_secret) {
      return res.status(500).json({ error: 'Razorpay is not configured' });
    }

    const orderId = `BOOK${Date.now()}${req.user.id}`;
    const amountPaise = Math.round(Number(bookingFee) * 100);
    const callbackBase = process.env.RAZORPAY_CALLBACK_URL || `${process.env.CLIENT_URL || 'http://localhost:3001'}/patient/book`;
    const callbackUrl = `${callbackBase}${callbackBase.includes('?') ? '&' : '?'}razorpay_order=${orderId}`;

    const appointmentPayload = {
      doctor_id,
      clinic_id,
      appointment_date,
      appointment_time,
      reason_for_visit,
      consultation_mode,
      session_id,
      priority_level
    };

    const response = await axios.post(
      'https://api.razorpay.com/v1/payment_links',
      {
        amount: amountPaise,
        currency: 'INR',
        description: 'Appointment Booking Fee',
        reference_id: orderId,
        callback_url: callbackUrl,
        callback_method: 'get',
        customer: {
          name: req.user.name || 'Patient',
          email: req.user.email || undefined,
          contact: req.user.phone || undefined
        },
        notify: { sms: true, email: true }
      },
      { auth: { username: key_id, password: key_secret } }
    );

    const link = response.data;
    if (!link?.id || !link?.short_url) {
      return res.status(500).json({ error: 'Failed to create Razorpay payment link' });
    }

    await pool.query(
      `INSERT INTO payment_orders (order_id, user_id, amount, status, gateway, gateway_order_id, appointment_payload)
       VALUES (?, ?, ?, 'created', 'razorpay', ?, ?)`,
      [orderId, req.user.id, Number(bookingFee).toFixed(2), link.id, JSON.stringify(appointmentPayload)]
    );

    res.json({
      order_id: orderId,
      payment_url: link.short_url,
      callback_url: callbackUrl
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Razorpay initiation failed' });
  }
};

exports.razorpayWebhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return res.status(500).send('Webhook not configured');

  const signature = req.headers['x-razorpay-signature'];
  const body = req.body instanceof Buffer ? req.body.toString() : JSON.stringify(req.body || {});
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');

  if (!signature || signature !== expected) {
    return res.status(400).send('Invalid signature');
  }

  try {
    const payload = JSON.parse(body);
    const event = payload.event || '';
    const entity = payload.payload?.payment_link?.entity || null;
    if (!entity) return res.status(200).send('No payment link payload');

    const paymentLinkId = entity.id;
    const referenceId = entity.reference_id;
    const status = entity.status;

    const [orders] = await pool.query(
      'SELECT * FROM payment_orders WHERE (gateway_order_id = ? OR order_id = ?) AND gateway = ? LIMIT 1',
      [paymentLinkId, referenceId, 'razorpay']
    );
    if (!orders.length) return res.status(200).send('Order not found');
    const order = orders[0];

    if (status !== 'paid' || order.status === 'paid') {
      return res.status(200).send('No action');
    }

    const appointmentPayload = order.appointment_payload ? JSON.parse(order.appointment_payload) : null;
    if (!appointmentPayload) {
      await pool.query(
        'UPDATE payment_orders SET status = ?, callback_payload = ? WHERE order_id = ?',
        ['failed', body, order.order_id]
      );
      return res.status(200).send('Missing booking data');
    }

    const { appointmentId, queueNumber } = await createAppointmentFromPayment(appointmentPayload, order.user_id, paymentLinkId);
    await pool.query(
      `UPDATE payment_orders
       SET status = 'paid', appointment_id = ?, queue_number = ?, gateway_payment_id = ?, callback_payload = ?
       WHERE order_id = ?`,
      [appointmentId, queueNumber, paymentLinkId, body, order.order_id]
    );

    const io = req.app.get('io');
    io?.to(`clinic_${appointmentPayload.clinic_id}`).emit('queue_update', {
      appointment_id: appointmentId,
      clinic_id: appointmentPayload.clinic_id,
      status: 'pending',
      queue_number: queueNumber,
      appointment_date: appointmentPayload.appointment_date,
      appointment_time: appointmentPayload.appointment_time,
      type: 'booked'
    });
    await emitQueueProgress(io, appointmentPayload.clinic_id, appointmentPayload.appointment_date);
    await notifyAdmins(io, 'appointment_booked');

    res.status(200).send('OK');
  } catch (err) {
    res.status(500).send('Webhook error');
  }
};

exports.getRazorpayStatus = async (req, res) => {
  const { order_id } = req.query;
  if (!order_id) return res.status(400).json({ error: 'order_id is required' });
  try {
    const [orders] = await pool.query(
      'SELECT order_id, status, appointment_id, queue_number FROM payment_orders WHERE order_id = ? AND user_id = ? LIMIT 1',
      [order_id, req.user.id]
    );
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    res.json(orders[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Stripe initiate (Checkout Session)
exports.initiateStripe = async (req, res) => {
  const {
    doctor_id,
    clinic_id,
    appointment_date,
    appointment_time,
    reason_for_visit,
    consultation_mode,
    session_id,
    priority_level
  } = req.body;

  try {
    const bookingFee = await getBookingFee();
    if (bookingFee <= 0) return res.status(400).json({ error: 'Booking fee is not enabled' });
    if (!doctor_id || !clinic_id || !appointment_date || !session_id) {
      return res.status(400).json({ error: 'Missing required booking details' });
    }

    const stripe = getStripeClient();
    if (!stripe) return res.status(500).json({ error: 'Stripe is not configured' });

    const orderId = `BOOK${Date.now()}${req.user.id}`;
    const successBase = process.env.STRIPE_SUCCESS_URL || `${process.env.CLIENT_URL || 'http://localhost:3001'}/patient/book?stripe_order={ORDER_ID}`;
    const successUrl = successBase.replace('{ORDER_ID}', orderId);
    const cancelUrl = process.env.STRIPE_CANCEL_URL || `${process.env.CLIENT_URL || 'http://localhost:3001'}/patient/book`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: orderId,
      customer_email: req.user.email || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'inr',
            unit_amount: Math.round(Number(bookingFee) * 100),
            product_data: { name: 'Appointment Booking Fee' }
          }
        }
      ],
      metadata: {
        order_id: orderId
      }
    });

    const appointmentPayload = {
      doctor_id,
      clinic_id,
      appointment_date,
      appointment_time,
      reason_for_visit,
      consultation_mode,
      session_id,
      priority_level
    };

    await pool.query(
      `INSERT INTO payment_orders (order_id, user_id, amount, status, gateway, gateway_order_id, appointment_payload)
       VALUES (?, ?, ?, 'created', 'stripe', ?, ?)`,
      [orderId, req.user.id, Number(bookingFee).toFixed(2), session.id, JSON.stringify(appointmentPayload)]
    );

    res.json({
      order_id: orderId,
      payment_url: session.url
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Stripe initiation failed' });
  }
};

exports.stripeWebhook = async (req, res) => {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) return res.status(500).send('Webhook not configured');

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.metadata?.order_id || session.client_reference_id;
    try {
      const [orders] = await pool.query(
        'SELECT * FROM payment_orders WHERE order_id = ? AND gateway = ? LIMIT 1',
        [orderId, 'stripe']
      );
      if (orders.length) {
        const order = orders[0];
        if (order.status !== 'paid') {
          const appointmentPayload = order.appointment_payload ? JSON.parse(order.appointment_payload) : null;
          if (appointmentPayload) {
            const { appointmentId, queueNumber } = await createAppointmentFromPayment(appointmentPayload, order.user_id, session.id);
            await pool.query(
              `UPDATE payment_orders
               SET status = 'paid', appointment_id = ?, queue_number = ?, gateway_payment_id = ?, callback_payload = ?
               WHERE order_id = ?`,
              [appointmentId, queueNumber, session.payment_intent || null, JSON.stringify(session), orderId]
            );
          }
        }
      }
    } catch {
      // ignore webhook failures
    }
  }

  res.json({ received: true });
};

exports.getStripeStatus = async (req, res) => {
  const { order_id } = req.query;
  if (!order_id) return res.status(400).json({ error: 'order_id is required' });
  try {
    const [orders] = await pool.query(
      'SELECT order_id, status, appointment_id, queue_number FROM payment_orders WHERE order_id = ? AND user_id = ? LIMIT 1',
      [order_id, req.user.id]
    );
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    res.json(orders[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
