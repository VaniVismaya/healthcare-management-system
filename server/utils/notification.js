const { pool } = require('../config/database');

const sendNotification = async (userId, title, message, type, referenceId = null, referenceType = null) => {
  try {
    const [result] = await pool.query(
      'INSERT INTO notifications (user_id, title, message, type, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, title, message, type, referenceId, referenceType]
    );
    return result.insertId;
  } catch (err) {
    console.error('Notification error:', err.message);
  }
};

const sendBulkNotifications = async (userIds, title, message, type, referenceId = null, referenceType = null) => {
  const promises = userIds.map(id => sendNotification(id, title, message, type, referenceId, referenceType));
  return Promise.all(promises);
};

// Emit socket notification
const emitNotification = (io, userId, notification) => {
  if (io) {
    io.to(`user_${userId}`).emit('notification', notification);
  }
};

const sendNotificationWithEmit = async (io, userId, title, message, type, referenceId = null, referenceType = null) => {
  const notifId = await sendNotification(userId, title, message, type, referenceId, referenceType);
  if (!notifId || !io) return null;
  try {
    const [rows] = await pool.query('SELECT * FROM notifications WHERE id = ?', [notifId]);
    if (rows.length) {
      emitNotification(io, userId, rows[0]);
      return rows[0];
    }
  } catch (err) {
    console.error('Notification emit error:', err.message);
  }
  return null;
};

module.exports = { sendNotification, sendBulkNotifications, emitNotification, sendNotificationWithEmit };
