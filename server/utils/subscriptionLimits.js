const { getDefaultPlanForRole, getPlanById } = require('./subscription');

class SubscriptionLimitError extends Error {
  constructor(message, code = 'PLAN_LIMIT_EXCEEDED', statusCode = 403, details = {}) {
    super(message);
    this.name = 'SubscriptionLimitError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getEffectiveUserPlan = async (pool, userId) => {
  const [[user]] = await pool.query(
    `SELECT u.id, r.name as role, u.current_plan_id
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  );

  if (!user) {
    throw new SubscriptionLimitError('User not found for subscription validation', 'PLAN_USER_NOT_FOUND', 404);
  }

  const plan = user.current_plan_id
    ? await getPlanById(pool, user.current_plan_id)
    : await getDefaultPlanForRole(pool, user.role);

  return {
    user,
    plan,
  };
};

const assertModuleEnabled = (plan, moduleKey, fallbackLabel) => {
  if (!moduleKey || !plan) return;
  const modules = plan.modules || {};
  if (modules[moduleKey] === false) {
    throw new SubscriptionLimitError(
      `${fallbackLabel || 'This feature'} is not available in your current plan`,
      'PLAN_MODULE_DISABLED',
      403,
      { moduleKey, planName: plan.name }
    );
  }
};

const assertWithinLimit = (plan, limitKey, currentCount, fallbackLabel) => {
  if (!limitKey || !plan) return;
  const limits = plan.limits || {};
  const limitValue = normalizeNumber(limits[limitKey]);

  if (limitValue === null || limitValue === -1) return;

  if (Number(currentCount || 0) >= limitValue) {
    throw new SubscriptionLimitError(
      `${fallbackLabel || 'Current plan limit reached'}. Upgrade your plan to continue.`,
      'PLAN_LIMIT_EXCEEDED',
      403,
      { limitKey, currentCount, limitValue, planName: plan.name }
    );
  }
};

const enforcePlanRule = async (pool, userId, options = {}) => {
  const { plan } = await getEffectiveUserPlan(pool, userId);
  const {
    moduleKey,
    moduleLabel,
    limitKey,
    limitLabel,
    currentCount,
  } = options;

  assertModuleEnabled(plan, moduleKey, moduleLabel);
  if (currentCount !== undefined) {
    assertWithinLimit(plan, limitKey, currentCount, limitLabel);
  }

  return plan;
};

module.exports = {
  SubscriptionLimitError,
  enforcePlanRule,
  getEffectiveUserPlan,
};
