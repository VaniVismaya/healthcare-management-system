const { pool } = require('../config/database');

// Public list (active)
exports.listDepartments = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, description, icon FROM medical_departments WHERE is_active = 1 ORDER BY name'
    );
    res.json({ departments: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Admin list (all)
exports.adminList = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, description, icon, is_active, created_at FROM medical_departments ORDER BY name'
    );
    res.json({ departments: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Admin create/update
exports.adminCreate = async (req, res) => {
  const { name, description, icon, is_active } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' });
  try {
    await pool.query(
      'INSERT INTO medical_departments (name, description, icon, is_active) VALUES (?, ?, ?, ?)',
      [name.trim(), description || null, icon || null, is_active !== false]
    );
    res.status(201).json({ message: 'Department created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
