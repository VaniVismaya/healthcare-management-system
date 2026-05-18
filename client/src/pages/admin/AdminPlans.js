import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { adminAPI } from '../../utils/api';
import { ROLE_PLAN_FIELDS, formatLimitValue } from '../../utils/subscriptionPlanConfig';

const roleOptions = ['doctor', 'laboratory', 'pharmacist', 'patient'];

const createEmptyForm = () => ({
  id: null,
  name: '',
  code: '',
  description: '',
  role: 'doctor',
  plan_type: 'standard',
  target_user_id: null,
  is_default: false,
  display_order: 0,
  price: '',
  duration_days: '-1',
  max_appointments: '',
  features: '',
  modules: {},
  limits: {},
  is_active: true,
});

const parseCsv = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const prettyRole = (role) =>
  ({
    doctor: 'Doctor',
    laboratory: 'Laboratory',
    pharmacist: 'Pharmacist',
    patient: 'Patient',
  }[role] || role);

export default function AdminPlans() {
  const [plans, setPlans] = useState([]);
  const [requests, setRequests] = useState([]);
  const [bookingFee, setBookingFee] = useState('0');
  const [feeSaving, setFeeSaving] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requestActionLoading, setRequestActionLoading] = useState(null);
  const [form, setForm] = useState(createEmptyForm());
  const [requestContext, setRequestContext] = useState(null);

  const config = useMemo(
    () => ROLE_PLAN_FIELDS[form.role] || { limitFields: [], moduleFields: [] },
    [form.role]
  );

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: planData }, { data: requestData }] = await Promise.all([
        adminAPI.getPlans(),
        adminAPI.getPlanRequests(),
      ]);
      setPlans(planData.plans || []);
      setRequests(requestData.requests || []);
    } catch {
      toast.error('Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const loadBookingFee = () => {
    adminAPI.getBookingFee()
      .then(({ data }) => setBookingFee(String(data?.booking_fee ?? 0)))
      .catch(() => {});
  };

  useEffect(() => {
    load();
    loadBookingFee();
  }, []);

  const updateLimit = (key, value) => {
    setForm((prev) => ({
      ...prev,
      limits: { ...prev.limits, [key]: value === '' ? '' : Number(value) },
    }));
  };

  const updateModule = (key, value) => {
    setForm((prev) => ({
      ...prev,
      modules: { ...prev.modules, [key]: value },
    }));
  };

  const resetForm = () => {
    setForm(createEmptyForm());
    setRequestContext(null);
  };

  const startCustomPlanForRequest = (request) => {
    setRequestContext(request);
    setForm({
      ...createEmptyForm(),
      role: request.role,
      name: `${prettyRole(request.role)} Custom`,
      code: '',
      plan_type: 'custom',
      target_user_id: request.user_id,
      description: `Custom plan for ${request.requester_name}`,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const editPlan = (plan) => {
    setRequestContext(
      plan.plan_type === 'custom' && plan.target_user_id
        ? {
            user_id: plan.target_user_id,
            requester_name: plan.target_user_name,
            requester_email: plan.target_user_email,
            requester_phone: plan.target_user_phone,
            role: plan.role,
          }
        : null
    );
    setForm({
      id: plan.id,
      name: plan.name || '',
      code: plan.code || '',
      description: plan.description || '',
      role: plan.role || 'doctor',
      plan_type: plan.plan_type || 'standard',
      target_user_id: plan.target_user_id || null,
      is_default: !!plan.is_default,
      display_order: plan.display_order ?? 0,
      price: plan.price ?? '',
      duration_days: plan.duration_days ?? '-1',
      max_appointments: plan.max_appointments ?? '',
      features: Array.isArray(plan.features) ? plan.features.join(', ') : '',
      modules: plan.modules || {},
      limits: plan.limits || {},
      is_active: plan.is_active !== false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const savePlan = async () => {
    if (!form.name.trim()) return toast.error('Plan name is required');
    if (form.price === '') return toast.error('Plan price is required');
    if (form.duration_days === '') return toast.error('Duration is required');

    const payload = {
      ...form,
      target_user_id: form.plan_type === 'custom' ? form.target_user_id : null,
      price: Number(form.price),
      duration_days: Number(form.duration_days),
      max_appointments: form.max_appointments === '' ? null : Number(form.max_appointments),
      features: parseCsv(form.features),
      limits: Object.fromEntries(
        Object.entries(form.limits || {}).filter(([, value]) => value !== '' && value !== null && value !== undefined)
      ),
    };

    setSavingPlan(true);
    try {
      const { data } = await adminAPI.savePlan(payload, form.id);
      const planId = data.plan_id || form.id;
      if (requestContext?.user_id && planId) {
        await adminAPI.assignPlan(planId, requestContext.user_id);
        const relatedRequest = requests.find((item) => item.user_id === requestContext.user_id && item.status === 'pending');
        if (relatedRequest) {
          await adminAPI.updatePlanRequest(relatedRequest.id, {
            status: 'accepted',
            admin_notes: `Custom plan created and assigned: ${payload.name}`,
          });
        }
      }
      toast.success(form.id ? 'Plan updated' : 'Plan created');
      resetForm();
      load();
    } catch {
      // handled by interceptor
    } finally {
      setSavingPlan(false);
    }
  };

  const saveBookingFee = async () => {
    setFeeSaving(true);
    try {
      const fee = Number(bookingFee || 0);
      await adminAPI.setBookingFee({ booking_fee: Number.isFinite(fee) ? fee : 0 });
      toast.success('Booking fee updated');
      loadBookingFee();
    } catch {
      toast.error('Failed to update booking fee');
    } finally {
      setFeeSaving(false);
    }
  };

  const updateRequestStatus = async (requestId, status, adminNotes = '') => {
    setRequestActionLoading(requestId);
    try {
      await adminAPI.updatePlanRequest(requestId, { status, admin_notes: adminNotes });
      toast.success('Request updated');
      load();
    } catch {
      // handled by interceptor
    } finally {
      setRequestActionLoading(null);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Appointment Booking Fee</div>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Booking Fee (INR)</label>
              <input className="form-input" type="number" min="0" value={bookingFee} onChange={(e) => setBookingFee(e.target.value)} />
              <div className="form-hint">Patients must pay this booking amount before the appointment is confirmed.</div>
            </div>
          </div>
          <button className="btn btn-primary" onClick={saveBookingFee} disabled={feeSaving}>
            {feeSaving ? 'Saving...' : 'Save Booking Fee'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div className="card-title">{form.id ? 'Edit Plan' : requestContext ? 'Create Custom Plan' : 'Create Plan'}</div>
          {(form.id || requestContext) && (
            <button className="btn btn-outline btn-sm" onClick={resetForm}>Clear</button>
          )}
        </div>
        <div className="card-body">
          {requestContext && (
            <div style={{ marginBottom: 16, padding: 14, borderRadius: 14, border: '1px solid #dbeafe', background: '#eff6ff' }}>
              <div style={{ fontWeight: 600 }}>Custom Plan Target</div>
              <div style={{ marginTop: 4 }}>
                {requestContext.requester_name} · {requestContext.requester_email || requestContext.requester_phone || 'No contact'}
              </div>
            </div>
          )}

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Plan Name</label>
              <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Plan Code</label>
              <input className="form-input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })} placeholder="optional_auto_generated" />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, modules: {}, limits: {} })}>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>{prettyRole(role)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Plan Type</label>
              <select
                className="form-select"
                value={form.plan_type}
                onChange={(e) => setForm({ ...form, plan_type: e.target.value, target_user_id: e.target.value === 'custom' ? form.target_user_id : null })}
              >
                <option value="standard">Standard Role Plan</option>
                <option value="custom">Custom Plan For Specific User</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input" rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Price (INR)</label>
              <input className="form-input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Duration (days)</label>
              <input className="form-input" type="number" value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: e.target.value })} />
              <div className="form-hint">Use `-1` for no expiry.</div>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Max Appointments</label>
              <input className="form-input" type="number" value={form.max_appointments} onChange={(e) => setForm({ ...form, max_appointments: e.target.value })} />
              <div className="form-hint">Use `-1` for unlimited.</div>
            </div>
            <div className="form-group">
              <label className="form-label">Display Order</label>
              <input className="form-input" type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Highlights</label>
            <input className="form-input" value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} placeholder="Comma separated highlights" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Limits</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {config.limitFields.map((field) => (
                  <div className="form-group" key={field.key}>
                    <label className="form-label">{field.label}</label>
                    <input
                      className="form-input"
                      type="number"
                      value={form.limits?.[field.key] ?? ''}
                      onChange={(e) => updateLimit(field.key, e.target.value)}
                      placeholder="-1 for unlimited"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Modules</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {config.moduleFields.map((field) => (
                  <label key={field.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={!!form.modules?.[field.key]}
                      onChange={(e) => updateModule(field.key, e.target.checked)}
                    />
                    <span>{field.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
              <span>Default plan for this role</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              <span>Active</span>
            </label>
          </div>

          <button className="btn btn-primary" onClick={savePlan} disabled={savingPlan} style={{ marginTop: 18 }}>
            {savingPlan ? 'Saving...' : form.id ? 'Update Plan' : requestContext ? 'Create & Assign Custom Plan' : 'Save Plan'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Custom Plan Requests</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : requests.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No custom plan requests yet.</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {requests.map((request) => (
                <div key={request.id} style={{ border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{request.requester_name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                        {prettyRole(request.role)} · {request.requester_email || request.requester_phone || 'No contact'} · Current plan: {request.current_plan_name || 'Free'}
                      </div>
                      {request.requested_title && <div style={{ marginTop: 6, fontWeight: 600 }}>{request.requested_title}</div>}
                      <div style={{ marginTop: 6 }}>{request.message}</div>
                      {request.admin_notes && <div style={{ marginTop: 6, color: 'var(--text-muted)' }}><strong>Admin Notes:</strong> {request.admin_notes}</div>}
                    </div>
                    <div>
                      <span className={`badge ${request.status === 'pending' ? 'badge-warning' : request.status === 'rejected' ? 'badge-danger' : 'badge-success'}`}>{request.status}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => startCustomPlanForRequest(request)}>
                      Create Custom Plan
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={requestActionLoading === request.id}
                      onClick={() => updateRequestStatus(request.id, 'accepted', 'Accepted. Admin will contact the requester.')}
                    >
                      Accept
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={requestActionLoading === request.id}
                      onClick={() => updateRequestStatus(request.id, 'contacted', 'Contacted requester regarding plan customization.')}
                    >
                      Mark Contacted
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={requestActionLoading === request.id}
                      onClick={() => updateRequestStatus(request.id, 'rejected', 'Request closed by admin.')}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Configured Plans</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : plans.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No plans configured.</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {plans.map((plan) => (
                <div key={plan.id} style={{ border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 700 }}>{plan.name}</div>
                        {plan.is_default && <span className="badge badge-primary">Default</span>}
                        {plan.plan_type === 'custom' && <span className="badge badge-warning">Custom</span>}
                        {!plan.is_active && <span className="badge badge-danger">Inactive</span>}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                        {prettyRole(plan.role)} · {plan.price ? `INR ${Number(plan.price).toFixed(2)}` : 'Free'} · {plan.duration_days === -1 ? 'No expiry' : `${plan.duration_days} days`}
                      </div>
                      {plan.description && <div style={{ marginTop: 6 }}>{plan.description}</div>}
                      {plan.target_user_name && (
                        <div style={{ marginTop: 6, color: 'var(--text-muted)' }}>
                          For: {plan.target_user_name} · {plan.target_user_email || plan.target_user_phone || 'No contact'}
                        </div>
                      )}
                    </div>
                    <div>
                      <button className="btn btn-outline btn-sm" onClick={() => editPlan(plan)}>Edit</button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 16 }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>Limits</div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {(ROLE_PLAN_FIELDS[plan.role]?.limitFields || []).map((field) => (
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
                        {(ROLE_PLAN_FIELDS[plan.role]?.moduleFields || []).map((field) => (
                          <div key={`${plan.id}_${field.key}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
                            <span style={{ color: 'var(--text-muted)' }}>{field.label}</span>
                            <strong>{plan.modules?.[field.key] ? 'Included' : 'Not included'}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
