const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate, authorize('receptionist'));

router.get('/dashboard', async (req, res) => {
  try {
    const [rp] = await pool.query('SELECT clinic_id, doctor_id FROM receptionist_profiles WHERE user_id = ?', [req.user.id]);
    if (!rp.length) return res.status(404).json({ error: 'Profile not found' });
    
    const clinicId = rp[0].clinic_id;
    const today = new Date().toISOString().split('T')[0];
    
    const [[todayAppts]] = await pool.query("SELECT COUNT(*) as c FROM appointments WHERE clinic_id=? AND appointment_date=?", [clinicId, today]);
    const [[checkedIn]] = await pool.query("SELECT COUNT(*) as c FROM appointments WHERE clinic_id=? AND appointment_date=? AND status='checked_in'", [clinicId, today]);
    const [[pending]] = await pool.query("SELECT COUNT(*) as c FROM appointments WHERE clinic_id=? AND appointment_date=? AND status='pending'", [clinicId, today]);
    const [[completed]] = await pool.query("SELECT COUNT(*) as c FROM appointments WHERE clinic_id=? AND appointment_date=? AND status='completed'", [clinicId, today]);
    
    res.json({ today_total: todayAppts.c, checked_in: checkedIn.c, pending: pending.c, completed: completed.c, clinic_id: clinicId, doctor_id: rp[0].doctor_id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Shift handover notes
router.get('/handover', async (req, res) => {
  try {
    const [rp] = await pool.query('SELECT clinic_id FROM receptionist_profiles WHERE user_id = ?', [req.user.id]);
    if (!rp.length) return res.status(404).json({ error: 'Profile not found' });
    const clinicId = rp[0].clinic_id;
    const [rows] = await pool.query(
      `SELECT hn.id, hn.shift_date, hn.shift_type, hn.notes, hn.created_at,
              u.name as created_by_name
       FROM shift_handover_notes hn
       LEFT JOIN users u ON hn.created_by = u.id
       WHERE hn.clinic_id = ?
       ORDER BY hn.created_at DESC
       LIMIT 50`,
      [clinicId]
    );
    res.json({ notes: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/handover', async (req, res) => {
  const { shift_date, shift_type, notes } = req.body;
  if (!notes) return res.status(400).json({ error: 'Notes are required' });
  try {
    const [rp] = await pool.query('SELECT clinic_id FROM receptionist_profiles WHERE user_id = ?', [req.user.id]);
    if (!rp.length) return res.status(404).json({ error: 'Profile not found' });
    const clinicId = rp[0].clinic_id;
    const date = shift_date || new Date().toISOString().slice(0, 10);
    const type = ['morning','afternoon','evening','night'].includes(String(shift_type)) ? shift_type : 'morning';
    const [result] = await pool.query(
      `INSERT INTO shift_handover_notes (clinic_id, created_by, role_label, shift_date, shift_type, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [clinicId, req.user.id, 'receptionist', date, type, notes]
    );
    res.status(201).json({ note_id: result.insertId, message: 'Handover note added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
