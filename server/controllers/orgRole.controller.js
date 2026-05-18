const { pool } = require('../config/database');

const canManageOrg = async (user, orgType, orgId) => {
  if (user.role === 'admin') return true;
  if (orgType === 'clinic') {
    const [rows] = await pool.query(
      'SELECT id FROM clinics WHERE id = ? AND owner_doctor_id = ?',
      [orgId, user.id]
    );
    return rows.length > 0;
  }
  if (orgType === 'laboratory') {
    const [rows] = await pool.query(
      'SELECT user_id FROM laboratory_profiles WHERE user_id = ?',
      [user.id]
    );
    return rows.length > 0 && Number(orgId) === Number(user.id);
  }
  if (orgType === 'pharmacy') {
    const [rows] = await pool.query(
      'SELECT user_id FROM pharmacist_profiles WHERE user_id = ?',
      [user.id]
    );
    return rows.length > 0 && Number(orgId) === Number(user.id);
  }
  return false;
};

const roleBaseMatchesOrg = (roleName, orgType) => {
  if (orgType === 'clinic') return roleName === 'receptionist';
  if (orgType === 'laboratory') return roleName === 'laboratory';
  if (orgType === 'pharmacy') return roleName === 'pharmacist';
  return false;
};

exports.listRoles = async (req, res) => {
  const { org_type, org_id } = req.query;
  if (!org_type || !org_id) return res.status(400).json({ error: 'org_type and org_id are required' });
  try {
    const canManage = await canManageOrg(req.user, org_type, org_id);
    if (!canManage) return res.status(403).json({ error: 'Unauthorized' });

    const [roles] = await pool.query(
      `SELECT r.id, r.name, r.description,
              GROUP_CONCAT(p.code) as permissions
       FROM org_roles r
       LEFT JOIN org_role_permissions rp ON rp.org_role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
       WHERE r.org_type = ? AND r.org_id = ?
       GROUP BY r.id
       ORDER BY r.name`,
      [org_type, org_id]
    );
    const mapped = roles.map((r) => ({ ...r, permissions: r.permissions ? r.permissions.split(',') : [] }));
    res.json({ roles: mapped });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createRole = async (req, res) => {
  const { org_type, org_id, name, description, permissions } = req.body;
  if (!org_type || !org_id || !name) return res.status(400).json({ error: 'org_type, org_id, and name are required' });
  try {
    const canManage = await canManageOrg(req.user, org_type, org_id);
    if (!canManage) return res.status(403).json({ error: 'Unauthorized' });

    const [result] = await pool.query(
      'INSERT INTO org_roles (org_type, org_id, name, description, created_by) VALUES (?, ?, ?, ?, ?)',
      [org_type, org_id, name, description || null, req.user.id]
    );
    const roleId = result.insertId;

    if (Array.isArray(permissions) && permissions.length) {
      const [permRows] = await pool.query('SELECT id FROM permissions WHERE code IN (?)', [permissions]);
      if (permRows.length) {
        const rows = permRows.map((p) => [roleId, p.id]);
        await pool.query('INSERT INTO org_role_permissions (org_role_id, permission_id) VALUES ?', [rows]);
      }
    }

    res.status(201).json({ message: 'Role created', role_id: roleId });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updatePermissions = async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body;
  try {
    const [roleRows] = await pool.query('SELECT org_type, org_id FROM org_roles WHERE id = ?', [id]);
    if (!roleRows.length) return res.status(404).json({ error: 'Role not found' });
    const role = roleRows[0];

    const canManage = await canManageOrg(req.user, role.org_type, role.org_id);
    if (!canManage) return res.status(403).json({ error: 'Unauthorized' });

    await pool.query('DELETE FROM org_role_permissions WHERE org_role_id = ?', [id]);
    if (Array.isArray(permissions) && permissions.length) {
      const [permRows] = await pool.query('SELECT id FROM permissions WHERE code IN (?)', [permissions]);
      if (permRows.length) {
        const rows = permRows.map((p) => [id, p.id]);
        await pool.query('INSERT INTO org_role_permissions (org_role_id, permission_id) VALUES ?', [rows]);
      }
    }
    res.json({ message: 'Role permissions updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.assignRole = async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  try {
    const [roleRows] = await pool.query('SELECT org_type, org_id FROM org_roles WHERE id = ?', [id]);
    if (!roleRows.length) return res.status(404).json({ error: 'Role not found' });
    const role = roleRows[0];

    const canManage = await canManageOrg(req.user, role.org_type, role.org_id);
    if (!canManage) return res.status(403).json({ error: 'Unauthorized' });

    const [userRows] = await pool.query(
      `SELECT u.id, r.name as role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
      [user_id]
    );
    if (!userRows.length) return res.status(404).json({ error: 'User not found' });
    if (!roleBaseMatchesOrg(userRows[0].role, role.org_type)) {
      return res.status(400).json({ error: 'User role does not match organization type' });
    }

    await pool.query('INSERT IGNORE INTO org_user_roles (user_id, org_role_id) VALUES (?, ?)', [user_id, id]);
    res.json({ message: 'Role assigned' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
