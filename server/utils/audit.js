const { pool } = require('../config/database');

exports.logAudit = async ({
  userId = null,
  action,
  resourceType = null,
  resourceId = null,
  oldValues = null,
  newValues = null,
  ipAddress = null,
  userAgent = null,
}) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        action,
        resourceType,
        resourceId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent,
      ]
    );
  } catch {
    // Ignore audit failures so business actions still complete.
  }
};

exports.logAuditFromRequest = async (req, action, resourceType, resourceId, oldValues, newValues) => {
  return exports.logAudit({
    userId: req.user?.id || null,
    action,
    resourceType,
    resourceId,
    oldValues,
    newValues,
    ipAddress: req.ip || null,
    userAgent: req.headers['user-agent'] || null,
  });
};
