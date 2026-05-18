import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { orgRoleAPI, clinicAPI, labAPI, pharmacistAPI } from '../../utils/api';
import PhoneInput from '../../components/common/PhoneInput';

const permissionCatalog = {
  clinic: [
    { code: 'receptionist.appointments.manage', label: 'Manage appointments (walk-in, status)' },
    { code: 'receptionist.patients.checkin', label: 'Record vitals / check-in' },
  ],
  laboratory: [
    { code: 'lab.profile.edit', label: 'Edit lab profile' },
    { code: 'lab.tests.manage', label: 'Manage lab tests & pricing' },
    { code: 'lab.orders.manage', label: 'Manage lab orders' },
    { code: 'lab.reports.manage', label: 'Upload lab reports' },
  ],
  pharmacy: [
    { code: 'pharmacy.profile.edit', label: 'Edit pharmacy profile' },
    { code: 'pharmacy.medicines.manage', label: 'Manage medicines' },
    { code: 'pharmacy.stock.manage', label: 'Manage stock & alerts' },
  ],
};

const OrgRoleManager = ({ orgType, orgOptions }) => {
  const [orgId, setOrgId] = useState(orgOptions?.[0]?.id || '');
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [editRoleId, setEditRoleId] = useState('');
  const [assignRoleId, setAssignRoleId] = useState('');
  const [staffUserId, setStaffUserId] = useState('');
  const [receptionists, setReceptionists] = useState([]);
  const [staffName, setStaffName] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRoleId, setStaffRoleId] = useState('');
  const [departments, setDepartments] = useState([]);
  const [staffDepartments, setStaffDepartments] = useState([]);
  const [createdStaff, setCreatedStaff] = useState(null);

  const permissions = useMemo(() => permissionCatalog[orgType] || [], [orgType]);

  const loadRoles = async (targetOrgId) => {
    if (!targetOrgId) return;
    setLoading(true);
    try {
      const { data } = await orgRoleAPI.list({ org_type: orgType, org_id: targetOrgId });
      setRoles(data.roles || []);
    } catch {
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const loadReceptionists = async (targetOrgId) => {
    if (orgType !== 'clinic' || !targetOrgId) return;
    try {
      const { data } = await clinicAPI.getReceptionists(targetOrgId);
      setReceptionists(data.receptionists || []);
    } catch {
      setReceptionists([]);
    }
  };

  const loadDepartments = async () => {
    if (orgType !== 'laboratory') return;
    try {
      const { data } = await labAPI.getDepartments();
      setDepartments(data.departments || []);
    } catch {
      setDepartments([]);
    }
  };

  useEffect(() => {
    if (orgOptions?.length && !orgId) setOrgId(orgOptions[0].id);
  }, [orgOptions, orgId]);

  useEffect(() => {
    if (orgId) {
      loadRoles(orgId);
      loadReceptionists(orgId);
      loadDepartments();
    }
  }, [orgId]);

  const togglePermission = (code) => {
    setSelectedPermissions((prev) => (
      prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]
    ));
  };

  const handleCreateRole = async () => {
    if (!name.trim()) return toast.error('Role name required');
    try {
      await orgRoleAPI.create({
        org_type: orgType,
        org_id: orgId,
        name: name.trim(),
        description: description.trim(),
        permissions: selectedPermissions,
      });
      toast.success('Role created');
      setName('');
      setDescription('');
      setSelectedPermissions([]);
      loadRoles(orgId);
    } catch {
      toast.error('Failed to create role');
    }
  };

  const handleUpdateRole = async () => {
    if (!editRoleId) return toast.error('Select a role to update');
    try {
      await orgRoleAPI.updatePermissions(editRoleId, { permissions: selectedPermissions });
      toast.success('Permissions updated');
      setEditRoleId('');
      setSelectedPermissions([]);
      loadRoles(orgId);
    } catch {
      toast.error('Failed to update permissions');
    }
  };

  const handleAssign = async () => {
    if (!assignRoleId) return toast.error('Select a role');
    if (orgType === 'clinic') {
      if (!staffUserId) return toast.error('Select receptionist');
    } else {
      if (!staffUserId) return toast.error('Enter staff user id');
    }
    try {
      await orgRoleAPI.assign(assignRoleId, { user_id: staffUserId });
      toast.success('Role assigned');
      setAssignRoleId('');
      setStaffUserId('');
    } catch {
      toast.error('Failed to assign role');
    }
  };

  const handleCreateStaff = async () => {
    if (!orgId) return toast.error('Select organization');
    if (!staffName.trim()) return toast.error('Staff name required');
    if (!staffPhone.trim() && !staffEmail.trim()) return toast.error('Phone or email required');
    if ((orgType === 'laboratory' || orgType === 'pharmacy') && !staffRoleId) {
      return toast.error('Select a role for staff');
    }
    try {
      let response;
      const payload = {
        name: staffName.trim(),
        phone: staffPhone.trim() || null,
        email: staffEmail.trim() || null,
        password: staffPassword.trim() || undefined,
        org_role_id: staffRoleId || undefined,
      };
      if (orgType === 'clinic') {
        response = await clinicAPI.addReceptionist({ ...payload, clinic_id: orgId });
        loadReceptionists(orgId);
      } else if (orgType === 'laboratory') {
        response = await labAPI.createStaff({ ...payload, department_ids: staffDepartments });
      } else {
        response = await pharmacistAPI.createStaff(payload);
      }
      const data = response?.data || {};
      setCreatedStaff({
        userId: data.user_id,
        tempPassword: data.temp_password,
        message: data.message || 'Staff account created',
      });
      if (data.user_id) setStaffUserId(String(data.user_id));
      setStaffName('');
      setStaffPhone('');
      setStaffEmail('');
      setStaffPassword('');
      setStaffRoleId('');
      setStaffDepartments([]);
      toast.success(data.message || 'Staff account created');
    } catch {
      toast.error('Failed to create staff account');
    }
  };

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="card-title">Staff Roles & Permissions</div>
        {orgOptions?.length > 0 && (
          <select className="form-select" style={{ maxWidth: 280 }} value={orgId} onChange={(e) => setOrgId(e.target.value)}>
            {orgOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        )}
      </div>
      <div className="card-body">
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Create Staff Account</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" value={staffName} onChange={(e) => setStaffName(e.target.value)} placeholder="Staff name" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <PhoneInput value={staffPhone} onChange={setStaffPhone} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} placeholder="staff@example.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Temp Password (optional)</label>
              <input className="form-input" value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} placeholder="Leave blank to auto-generate" />
            </div>
            <div className="form-group">
              <label className="form-label">{orgType === 'clinic' ? 'Assign Role (optional)' : 'Assign Role *'}</label>
              <select className="form-select" value={staffRoleId} onChange={(e) => setStaffRoleId(e.target.value)}>
                <option value="">{orgType === 'clinic' ? 'Select role' : 'Select role (required)'}</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            {orgType === 'laboratory' && departments.length > 0 && (
              <div className="form-group">
                <label className="form-label">Lab Departments (optional)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 140, overflow: 'auto', padding: 6, border: '1px solid var(--border)', borderRadius: 8 }}>
                  {departments.map((d) => (
                    <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={staffDepartments.includes(d.id)}
                        onChange={(e) => {
                          setStaffDepartments((prev) => (
                            e.target.checked ? [...prev, d.id] : prev.filter((id) => id !== d.id)
                          ));
                        }}
                      />
                      {d.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="form-group" style={{ alignSelf: 'end' }}>
              <button className="btn btn-primary" onClick={handleCreateStaff} disabled={loading}>Create Staff</button>
            </div>
          </div>
          {createdStaff && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600 }}>{createdStaff.message}</div>
              {createdStaff.userId && <div style={{ marginTop: 6 }}>User ID: <strong>{createdStaff.userId}</strong></div>}
              {createdStaff.tempPassword && <div style={{ marginTop: 6 }}>Temp Password: <strong>{createdStaff.tempPassword}</strong></div>}
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Create Role</div>
            <div className="form-group">
              <label className="form-label">Role Name</label>
              <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Front Desk" />
            </div>
            <div className="form-group">
              <label className="form-label">Description (Optional)</label>
              <input className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" />
            </div>
            <div className="form-group">
              <label className="form-label">Permissions</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {permissions.map((p) => (
                  <label key={p.code} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={selectedPermissions.includes(p.code)}
                      onChange={() => togglePermission(p.code)}
                    />
                    <span><strong>{p.code}</strong> - {p.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleCreateRole} disabled={loading}>Create Role</button>
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Update Role Permissions</div>
            <div className="form-group">
              <label className="form-label">Select Role</label>
              <select className="form-select" value={editRoleId} onChange={(e) => {
                const next = e.target.value;
                setEditRoleId(next);
                const role = roles.find((r) => String(r.id) === String(next));
                setSelectedPermissions(role?.permissions || []);
              }}>
                <option value="">Select role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-outline" onClick={handleUpdateRole} disabled={loading}>Update Permissions</button>

            <div style={{ fontWeight: 700, margin: '20px 0 8px' }}>Assign Role to Staff</div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={assignRoleId} onChange={(e) => setAssignRoleId(e.target.value)}>
                <option value="">Select role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{orgType === 'clinic' ? 'Receptionist' : 'Staff User ID'}</label>
              {orgType === 'clinic' ? (
                <select className="form-select" value={staffUserId} onChange={(e) => setStaffUserId(e.target.value)}>
                  <option value="">Select receptionist</option>
                  {receptionists.map((r) => (
                    <option key={r.user_id} value={r.user_id}>
                      {r.name} ({r.phone || r.email || r.user_id})
                    </option>
                  ))}
                </select>
              ) : (
                <input className="form-input" value={staffUserId} onChange={(e) => setStaffUserId(e.target.value)} placeholder="Enter user id" />
              )}
            </div>
            <button className="btn btn-primary" onClick={handleAssign} disabled={loading}>Assign Role</button>
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Current Roles</div>
          {roles.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No roles created yet.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Description</th>
                    <th>Permissions</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 700 }}>{r.name}</td>
                      <td>{r.description || '-'}</td>
                      <td>
                        {r.permissions?.length ? r.permissions.map((p) => (
                          <span key={p} className="badge badge-primary" style={{ marginRight: 6 }}>
                            {p}
                          </span>
                        )) : <span style={{ color: 'var(--text-muted)' }}>None</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrgRoleManager;
