const parseJsonField = (value, fallback) => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const sanitizePlanPayload = (payload = {}) => {
  const toNumberOrNull = (value, fallback = null) => {
    if (value === '' || value === null || value === undefined) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    name: String(payload.name || '').trim(),
    code: String(payload.code || '').trim().toLowerCase() || null,
    description: String(payload.description || '').trim() || null,
    role: String(payload.role || '').trim() || 'all',
    plan_type: payload.plan_type === 'custom' ? 'custom' : 'standard',
    target_user_id: toNumberOrNull(payload.target_user_id),
    is_default: payload.is_default ? 1 : 0,
    display_order: toNumberOrNull(payload.display_order, 0) ?? 0,
    price: toNumberOrNull(payload.price, 0) ?? 0,
    duration_days: toNumberOrNull(payload.duration_days, -1) ?? -1,
    max_appointments: toNumberOrNull(payload.max_appointments),
    features: Array.isArray(payload.features)
      ? payload.features.filter(Boolean)
      : parseJsonField(payload.features, []),
    modules: parseJsonField(payload.modules, {}),
    limits: parseJsonField(payload.limits, {}),
    is_active: payload.is_active === false || payload.is_active === 0 ? 0 : 1,
  };
};

const formatPlanRow = (row) => {
  if (!row) return null;
  return {
    ...row,
    features: parseJsonField(row.features, []),
    modules: parseJsonField(row.modules, {}),
    limits: parseJsonField(row.limits, {}),
    is_default: !!row.is_default,
    is_active: row.is_active === undefined ? true : !!row.is_active,
  };
};

const getDefaultPlanForRole = async (pool, role) => {
  const [rows] = await pool.query(
    `SELECT *
     FROM subscription_plans
     WHERE role = ? AND is_default = 1 AND is_active = 1
     ORDER BY display_order ASC, id ASC
     LIMIT 1`,
    [role]
  );
  return formatPlanRow(rows[0]);
};

const getPlanById = async (pool, id) => {
  const [rows] = await pool.query('SELECT * FROM subscription_plans WHERE id = ? LIMIT 1', [id]);
  return formatPlanRow(rows[0]);
};

const assignPlanToUser = async (pool, userId, planId) => {
  const plan = await getPlanById(pool, planId);
  if (!plan) {
    throw new Error('Plan not found');
  }

  await pool.query(
    `UPDATE users
     SET current_plan_id = ?,
         subscription_plan = ?,
         subscription_started_at = NOW(),
         subscription_expires_at = CASE
           WHEN ? = -1 THEN NULL
           ELSE DATE_ADD(NOW(), INTERVAL ? DAY)
         END
     WHERE id = ?`,
    [plan.id, plan.name, plan.duration_days, plan.duration_days, userId]
  );

  return plan;
};

module.exports = {
  assignPlanToUser,
  formatPlanRow,
  getDefaultPlanForRole,
  getPlanById,
  parseJsonField,
  sanitizePlanPayload,
};
