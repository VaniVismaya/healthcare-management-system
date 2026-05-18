const { pool } = require('../config/database');
require('dotenv').config();

// Generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Send OTP via Twilio (falls back to console in dev)
const sendOTP = async (phone, purpose = 'login') => {
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRE_MINUTES) || 10) * 60000);

  // Invalidate old OTPs
  await pool.query(
    'UPDATE otp_verifications SET is_used = 1 WHERE phone = ? AND purpose = ? AND is_used = 0',
    [phone, purpose]
  );

  // Store new OTP
  await pool.query(
    'INSERT INTO otp_verifications (phone, otp, purpose, expires_at) VALUES (?, ?, ?, ?)',
    [phone, otp, purpose, expiresAt]
  );

  // Send via Twilio if configured
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID !== 'your_twilio_account_sid') {
    const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await twilio.messages.create({
      body: `Your MediCare Pro OTP is: ${otp}. Valid for ${process.env.OTP_EXPIRE_MINUTES || 10} minutes. Do not share.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone
    });
  } else {
    // Development fallback - log OTP
    console.log(`\n📱 OTP for ${phone}: ${otp} (${purpose})\n`);
  }

  return otp;
};

const verifyOTP = async (phone, otp) => {
  const [records] = await pool.query(
    'SELECT * FROM otp_verifications WHERE phone = ? AND otp = ? AND is_used = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
    [phone, otp]
  );

  if (!records.length) return false;

  await pool.query('UPDATE otp_verifications SET is_used = 1 WHERE id = ?', [records[0].id]);
  return true;
};

module.exports = { sendOTP, verifyOTP };
