const { pool } = require('../config/database');
const { logAuditFromRequest } = require('../utils/audit');

const MASTER_TABLES = {
  departments: {
    table: 'medical_departments',
    label: 'Department',
  },
  specializations: {
    table: 'medical_specializations',
    label: 'Specialization',
  },
  educations: {
    table: 'medical_educations',
    label: 'Education',
  },
};

const getConfig = (key) => MASTER_TABLES[key];

const normalizeBool = (value, fallback = true) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const listPublicFactory = (key) => async (req, res) => {
  const config = getConfig(key);
  try {
    const [rows] = await pool.query(
      `SELECT id, name, description, is_active
       FROM ${config.table}
       WHERE is_active = 1
       ORDER BY name`
    );
    res.json({ [key]: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const listAdminFactory = (key) => async (req, res) => {
  const config = getConfig(key);
  try {
    const [rows] = await pool.query(
      `SELECT id, name, description, is_active, created_at
       FROM ${config.table}
       ORDER BY name`
    );
    res.json({ [key]: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createFactory = (key) => async (req, res) => {
  const config = getConfig(key);
  const name = String(req.body?.name || '').trim();
  const description = String(req.body?.description || '').trim();
  const isActive = normalizeBool(req.body?.is_active, true);

  if (!name) {
    return res.status(400).json({ error: `${config.label} name is required` });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO ${config.table} (name, description, is_active) VALUES (?, ?, ?)`,
      [name, description || null, isActive]
    );
    await logAuditFromRequest(req, `create_${key.slice(0, -1)}`, key, result.insertId, null, {
      name,
      description: description || null,
      is_active: isActive,
    });
    res.status(201).json({ message: `${config.label} created successfully` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateFactory = (key) => async (req, res) => {
  const config = getConfig(key);
  const { id } = req.params;
  const name = String(req.body?.name || '').trim();
  const description = String(req.body?.description || '').trim();
  const isActive = normalizeBool(req.body?.is_active, true);

  if (!name) {
    return res.status(400).json({ error: `${config.label} name is required` });
  }

  try {
    const [beforeRows] = await pool.query(
      `SELECT id, name, description, is_active FROM ${config.table} WHERE id = ?`,
      [id]
    );
    if (!beforeRows.length) {
      return res.status(404).json({ error: `${config.label} not found` });
    }

    const [result] = await pool.query(
      `UPDATE ${config.table}
       SET name = ?, description = ?, is_active = ?
       WHERE id = ?`,
      [name, description || null, isActive, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: `${config.label} not found` });
    }

    await logAuditFromRequest(req, `update_${key.slice(0, -1)}`, key, Number(id), beforeRows[0], {
      name,
      description: description || null,
      is_active: isActive,
    });

    res.json({ message: `${config.label} updated successfully` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.listSpecializations = listPublicFactory('specializations');
exports.listEducations = listPublicFactory('educations');

exports.adminListDepartments = listAdminFactory('departments');
exports.adminCreateDepartment = createFactory('departments');
exports.adminUpdateDepartment = updateFactory('departments');

exports.adminListSpecializations = listAdminFactory('specializations');
exports.adminCreateSpecialization = createFactory('specializations');
exports.adminUpdateSpecialization = updateFactory('specializations');

exports.adminListEducations = listAdminFactory('educations');
exports.adminCreateEducation = createFactory('educations');
exports.adminUpdateEducation = updateFactory('educations');
