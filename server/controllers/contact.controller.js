const { pool } = require('../config/database');

exports.createContactMessage = async (req, res) => {
  const { name, email, phone, subject, message } = req.body || {};

  if (!name || !message) {
    return res.status(400).json({ error: 'Name and message are required' });
  }

  try {
    await pool.query(
      'INSERT INTO contact_messages (name, email, phone, subject, message, status) VALUES (?, ?, ?, ?, ?, ?)',
      [name.trim(), email?.trim() || null, phone?.trim() || null, subject?.trim() || null, message.trim(), 'new']
    );
    res.json({ message: 'Message received' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
