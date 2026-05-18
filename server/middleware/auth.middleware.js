const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { isDemoAdmin } = require('../utils/demoConfig');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [users] = await pool.query(
      `SELECT u.id, u.uuid, u.name, u.email, u.phone,
              r.name as role,
              u.is_active, u.is_verified, u.subscription_plan, u.current_plan_id, u.subscription_expires_at,
              sp.code as current_plan_code
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN subscription_plans sp ON sp.id = u.current_plan_id
       WHERE u.id = ? AND u.is_active = 1`,
      [decoded.id]
    );

    if (!users.length) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = {
      ...users[0],
      is_demo_admin: isDemoAdmin(users[0]),
    };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

const requirePermission = (...permissions) => {
  return async (req, res, next) => {
    if (!permissions.length) return next();
    try {
      const [[{ count }]] = await pool.query(
        'SELECT COUNT(*) as count FROM org_user_roles WHERE user_id = ?',
        [req.user.id]
      );

      if (count > 0) {
        const [rows] = await pool.query(
          `SELECT DISTINCT p.code
           FROM org_user_roles ur
           JOIN org_role_permissions rp ON rp.org_role_id = ur.org_role_id
           JOIN permissions p ON p.id = rp.permission_id
           WHERE ur.user_id = ? AND p.code IN (?)`,
          [req.user.id, permissions]
        );
        const granted = new Set(rows.map((r) => r.code));
        const missing = permissions.filter((p) => !granted.has(p));
        if (missing.length) {
          return res.status(403).json({ error: 'Access denied. Missing permissions.', missing });
        }
        return next();
      }

      const [rows] = await pool.query(
        `SELECT p.code
         FROM roles r
         JOIN role_permissions rp ON rp.role_id = r.id
         JOIN permissions p ON p.id = rp.permission_id
         WHERE r.name = ? AND p.code IN (?)`,
        [req.user.role, permissions]
      );
      const granted = new Set(rows.map((r) => r.code));
      const missing = permissions.filter((p) => !granted.has(p));
      if (missing.length) {
        return res.status(403).json({ error: 'Access denied. Missing permissions.', missing });
      }
      next();
    } catch {
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
};

const requireAnyPermission = (...permissions) => {
  return async (req, res, next) => {
    if (!permissions.length) return next();
    try {
      const [[{ count }]] = await pool.query(
        'SELECT COUNT(*) as count FROM org_user_roles WHERE user_id = ?',
        [req.user.id]
      );

      if (count > 0) {
        const [rows] = await pool.query(
          `SELECT DISTINCT p.code
           FROM org_user_roles ur
           JOIN org_role_permissions rp ON rp.org_role_id = ur.org_role_id
           JOIN permissions p ON p.id = rp.permission_id
           WHERE ur.user_id = ? AND p.code IN (?)`,
          [req.user.id, permissions]
        );
        if (!rows.length) {
          return res.status(403).json({ error: 'Access denied. Missing permissions.' });
        }
        return next();
      }

      const [rows] = await pool.query(
        `SELECT p.code
         FROM roles r
         JOIN role_permissions rp ON rp.role_id = r.id
         JOIN permissions p ON p.id = rp.permission_id
         WHERE r.name = ? AND p.code IN (?)`,
        [req.user.role, permissions]
      );
      if (!rows.length) {
        return res.status(403).json({ error: 'Access denied. Missing permissions.' });
      }
      next();
    } catch {
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
};

const requireVerified = (req, res, next) => {
  if (!req.user.is_verified) {
    return res.status(403).json({ 
      error: 'Account not verified. Please wait for admin verification.',
      code: 'NOT_VERIFIED'
    });
  }
  next();
};

const blockDemoAdminWrites = (req, res, next) => {
  if (req.user?.is_demo_admin) {
    return res.status(403).json({
      error: 'Demo admin is read-only. You can explore dashboards and details, but editing is disabled.',
      code: 'DEMO_ADMIN_READ_ONLY',
    });
  }
  next();
};

module.exports = { authenticate, authorize, requirePermission, requireAnyPermission, requireVerified, blockDemoAdminWrites };
