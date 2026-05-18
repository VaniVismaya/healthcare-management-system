import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { subscriptionAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { ROLE_PLAN_FIELDS, formatLimitValue } from '../../utils/subscriptionPlanConfig';

const roleLabels = {
  patient: 'Patient Plans',
  doctor: 'Doctor Plans',
  laboratory: 'Laboratory Plans',
  pharmacist: 'Pharmacy Plans',
};

export default function RoleSubscriptionPlans() {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [latestRequest, setLatestRequest] = useState(null);
  const [requestTitle, setRequestTitle] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [savingRequest, setSavingRequest] = useState(false);

  const config = useMemo(() => ROLE_PLAN_FIELDS[user?.role] || { limitFields: [], moduleFields: [] }, [user?.role]);
  const canRequestCustom = ['doctor', 'laboratory', 'pharmacist'].includes(user?.role);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await subscriptionAPI.getOverview();
      setPlans(data.plans || []);
      setCurrentPlan(data.current_plan || null);
      setLatestRequest(data.latest_request || null);
      if (data.current_plan) {
        updateUser({ current_plan: data.current_plan, subscription_plan: data.current_plan.name, current_plan_id: data.current_plan.id });
      }
    } catch {
      toast.error('Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submitRequest = async () => {
    if (!requestMessage.trim()) {
      toast.error('Please describe what you need in the custom plan');
      return;
    }
    setSavingRequest(true);
    try {
      await subscriptionAPI.requestCustomPlan({
        requested_title: requestTitle.trim(),
        message: requestMessage.trim(),
      });
      toast.success('Custom plan request sent');
      setRequestTitle('');
      setRequestMessage('');
      load();
    } catch {
      // toast handled by interceptor
    } finally {
      setSavingRequest(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="card">
        <div className="card-header">
          <div className="card-title">{roleLabels[user?.role] || 'Plans'}</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading plans...</div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ padding: 16, borderRadius: 16, border: '1px solid #dbeafe', background: '#eff6ff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Current Plan</div>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>{currentPlan?.name || user?.subscription_plan || 'Free'}</div>
                    <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                      {currentPlan?.price ? `INR ${Number(currentPlan.price).toFixed(2)}` : 'INR 0.00'}{' '}
                      {currentPlan?.duration_days === -1 ? '· No expiry' : currentPlan?.duration_days ? `· ${currentPlan.duration_days} days` : ''}
                    </div>
                  </div>
                  <div style={{ alignSelf: 'center' }}>
                    <span className="badge badge-success">Current Plan</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 16 }}>
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    style={{
                      border: plan.id === currentPlan?.id ? '2px solid #0ea5e9' : '1px solid #e5e7eb',
                      borderRadius: 18,
                      padding: 18,
                      background: '#fff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 20 }}>{plan.name}</div>
                        <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                          {plan.price ? `INR ${Number(plan.price).toFixed(2)}` : 'Free'} · {plan.duration_days === -1 ? 'No expiry' : `${plan.duration_days} days`}
                        </div>
                        {plan.description && <div style={{ marginTop: 8, color: 'var(--text-muted)' }}>{plan.description}</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        {plan.is_default && <span className="badge badge-primary">Default</span>}
                        {plan.id === currentPlan?.id && <span className="badge badge-success">Current</span>}
                        {plan.plan_type === 'custom' && <span className="badge badge-warning">Custom</span>}
                      </div>
                    </div>

                    {Array.isArray(plan.features) && plan.features.length > 0 && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontWeight: 600, marginBottom: 6 }}>Highlights</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {plan.features.map((feature) => (
                            <span key={`${plan.id}_${feature}`} className="badge badge-outline">{feature}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {(config.limitFields.length > 0 || config.moduleFields.length > 0) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 16 }}>
                        <div>
                          <div style={{ fontWeight: 600, marginBottom: 8 }}>Limits</div>
                          <div style={{ display: 'grid', gap: 8 }}>
                            {config.limitFields.map((field) => (
                              <div key={`${plan.id}_${field.key}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
                                <span style={{ color: 'var(--text-muted)' }}>{field.label}</span>
                                <strong>{formatLimitValue(plan.limits?.[field.key])}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, marginBottom: 8 }}>Modules</div>
                          <div style={{ display: 'grid', gap: 8 }}>
                            {config.moduleFields.map((field) => (
                              <div key={`${plan.id}_${field.key}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
                                <span style={{ color: 'var(--text-muted)' }}>{field.label}</span>
                                <strong>{plan.modules?.[field.key] ? 'Included' : 'Not included'}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {canRequestCustom && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Request Custom Plan</div>
          </div>
          <div className="card-body">
            {latestRequest && (
              <div style={{ marginBottom: 16, padding: 14, borderRadius: 14, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
                <div style={{ fontWeight: 600 }}>Latest Request</div>
                <div style={{ marginTop: 6, fontSize: 14 }}>
                  Status: <span className={`badge ${latestRequest.status === 'pending' ? 'badge-warning' : latestRequest.status === 'rejected' ? 'badge-danger' : 'badge-success'}`}>{latestRequest.status}</span>
                </div>
                {latestRequest.message && <div style={{ marginTop: 8, color: 'var(--text-muted)' }}>{latestRequest.message}</div>}
                {latestRequest.admin_notes && <div style={{ marginTop: 8 }}><strong>Admin Notes:</strong> {latestRequest.admin_notes}</div>}
              </div>
            )}

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Request Title</label>
                <input className="form-input" value={requestTitle} onChange={(e) => setRequestTitle(e.target.value)} placeholder="Example: Need multi-clinic unlimited plan" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">What do you need?</label>
              <textarea
                className="form-input"
                rows="5"
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Tell admin which modules and limits you need. Example: 5 clinics, unlimited guest doctors, video consultations, more staff accounts."
              />
              <div className="form-hint">Admin will review this request and contact you for the custom plan.</div>
            </div>
            <button className="btn btn-primary" onClick={submitRequest} disabled={savingRequest || latestRequest?.status === 'pending'}>
              {latestRequest?.status === 'pending' ? 'Pending Request Submitted' : savingRequest ? 'Sending...' : 'Send Custom Plan Request'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
