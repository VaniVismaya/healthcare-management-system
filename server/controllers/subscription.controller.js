const { pool } = require('../config/database');
const { formatPlanRow } = require('../utils/subscription');

exports.getOverview = async (req, res) => {
  try {
    const role = req.user.role;
    const [plans] = await pool.query(
      `SELECT sp.*
       FROM subscription_plans sp
       WHERE sp.is_active = 1
         AND sp.role = ?
         AND (sp.plan_type = 'standard' OR sp.target_user_id = ?)
       ORDER BY sp.is_default DESC, sp.display_order ASC, sp.price ASC, sp.id ASC`,
      [role, req.user.id]
    );

    const [currentPlanRows] = await pool.query(
      `SELECT sp.*
       FROM users u
       LEFT JOIN subscription_plans sp ON sp.id = u.current_plan_id
       WHERE u.id = ? LIMIT 1`,
      [req.user.id]
    );

    const [requests] = await pool.query(
      `SELECT *
       FROM subscription_plan_requests
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json({
      plans: (plans || []).map(formatPlanRow),
      current_plan: currentPlanRows[0] ? formatPlanRow(currentPlanRows[0]) : null,
      latest_request: requests[0] || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.requestCustomPlan = async (req, res) => {
  const { requested_title, message } = req.body;
  if (!['doctor', 'laboratory', 'pharmacist'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Custom plan requests are not available for this account type' });
  }
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'Please describe what you need in the custom plan' });
  }
  try {
    const [pending] = await pool.query(
      `SELECT id
       FROM subscription_plan_requests
       WHERE user_id = ? AND status = 'pending'
       LIMIT 1`,
      [req.user.id]
    );
    if (pending.length) {
      return res.status(409).json({ error: 'You already have a pending custom plan request' });
    }

    await pool.query(
      `INSERT INTO subscription_plan_requests (user_id, role, requested_title, message)
       VALUES (?, ?, ?, ?)`,
      [req.user.id, req.user.role, requested_title || null, String(message).trim()]
    );

    res.json({ message: 'Custom plan request submitted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
