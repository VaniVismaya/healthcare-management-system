import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminAPI } from '../../utils/api';

const roleOptions = ['', 'doctor', 'patient', 'laboratory', 'pharmacist', 'receptionist'];

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [verified, setVerified] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewUser, setViewUser] = useState(null);
  const [viewAppointments, setViewAppointments] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewExtra, setViewExtra] = useState(null);

  const baseUrl = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';
  const buildFileUrl = (path) => {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const load = () => {
    setLoading(true);
    adminAPI.getUsers({ search, role, is_verified: verified })
      .then(({ data }) => setUsers(data.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, role, verified]);

  const toggleUser = async (id) => {
    try {
      await adminAPI.toggleUser(id);
      toast.success('User status updated');
      load();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const verifyUser = async (id, is_verified) => {
    try {
      await adminAPI.verifyUser(id, { is_verified });
      toast.success('Verification updated');
      load();
    } catch {
      toast.error('Failed to update verification');
    }
  };

  const openUser = async (u) => {
    setViewLoading(true);
    try {
      const { data } = await adminAPI.getUserDetails(u.id);
      setViewUser(data.user);
      setViewAppointments(data.appointments || []);
      setViewExtra(data);
    } catch {
      toast.error('Failed to load user details');
    } finally {
      setViewLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="card-title">User Registry</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="form-input" placeholder="Search name/email/phone" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
            {roleOptions.map((r) => (
              <option key={r || 'all'} value={r}>{r ? r : 'All Roles'}</option>
            ))}
          </select>
          <select className="form-select" value={verified} onChange={(e) => setVerified(e.target.value)}>
            <option value="">All</option>
            <option value="1">Verified</option>
            <option value="0">Unverified</option>
          </select>
        </div>
      </div>
      <div className="card-body">
        {loading ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
        ) : users.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>No users found.</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Appointments</th>
                  <th>Verified</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.email || '-'}</div>
                    </td>
                    <td>{u.phone}</td>
                    <td><span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>{u.role}</span></td>
                    <td>
                      {u.role === 'patient'
                        ? (u.patient_appointments ?? 0)
                        : u.role === 'doctor'
                          ? (u.doctor_appointments ?? 0)
                          : '-'}
                    </td>
                    <td>
                      <span className={`badge ${u.is_verified ? 'badge-success' : 'badge-warning'}`}>
                        {u.is_verified ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => openUser(u)}>
                        View
                      </button>
                      {['doctor','laboratory','pharmacist'].includes(u.role) && (
                        <button className="btn btn-outline btn-sm" onClick={() => verifyUser(u.id, u.is_verified ? 0 : 1)}>
                          {u.is_verified ? 'Unverify' : 'Verify'}
                        </button>
                      )}
                      <button className="btn btn-outline btn-sm" onClick={() => toggleUser(u.id)}>
                        {u.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewUser && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>User Details</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => { setViewUser(null); setViewExtra(null); }}>X</button>
            </div>
            <div className="modal-body">
              {viewLoading ? (
                <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12 }}>
                    {viewUser.profile_image ? (
                      <img
                        src={buildFileUrl(viewUser.profile_image)}
                        alt="Profile"
                        style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', border: '1px solid #e5e7eb' }}
                      />
                    ) : (
                      <div style={{ width: 64, height: 64, borderRadius: 12, background: '#eef2f7' }} />
                    )}
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>{viewUser.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {viewUser.role} - {viewUser.email || 'no email'} - {viewUser.phone || 'no phone'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <strong>Current Plan:</strong> {viewUser.current_plan?.name || viewUser.current_plan_name || viewUser.subscription_plan || 'Free'}
                    </div>
                    <div>
                      <strong>Verified:</strong> {viewUser.is_verified ? 'Yes' : 'No'}
                    </div>
                  </div>
                  {viewUser.subscription_expires_at && (
                    <div style={{ marginTop: 8 }}>
                      <strong>Plan Expiry:</strong> {new Date(viewUser.subscription_expires_at).toLocaleDateString()}
                    </div>
                  )}

                  {viewUser.role === 'doctor' && (
                    <>
                      <div style={{ marginTop: 12 }}>
                        <strong>Primary Specialization:</strong> {viewUser.primary_specialization || viewUser.doctor_specialization || '-'}
                      </div>
                      {Array.isArray(viewUser.additional_specializations) && viewUser.additional_specializations.length > 0 && (
                        <div style={{ marginTop: 6 }}>
                          <strong>Additional Specializations:</strong> {viewUser.additional_specializations.join(', ')}
                        </div>
                      )}
                      {Array.isArray(viewUser.educations) && viewUser.educations.length > 0 && (
                        <div style={{ marginTop: 6 }}>
                          <strong>Education:</strong> {viewUser.educations.join(', ')}
                        </div>
                      )}
                      {viewUser.qualification && (
                        <div style={{ marginTop: 6 }}><strong>Qualification:</strong> {viewUser.qualification}</div>
                      )}
                      {viewExtra?.doctor_departments?.length > 0 && (
                        <div style={{ marginTop: 6 }}>
                          <strong>Departments:</strong> {viewExtra.doctor_departments.join(', ')}
                        </div>
                      )}
                      {viewUser.license_number && (
                        <div style={{ marginTop: 6 }}><strong>License No:</strong> {viewUser.license_number}</div>
                      )}
                      {viewUser.experience_years !== undefined && viewUser.experience_years !== null && (
                        <div style={{ marginTop: 6 }}><strong>Experience:</strong> {viewUser.experience_years} yrs</div>
                      )}
                      {Array.isArray(viewUser.consultation_fee_rules) && viewUser.consultation_fee_rules.length > 0 ? (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontWeight: 600, marginBottom: 6 }}>Clinic-wise Consultation Fees</div>
                          <div style={{ display: 'grid', gap: 8 }}>
                            {viewUser.consultation_fee_rules.map((item) => (
                              <div key={`fee_rule_${item.id}`} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                                <div style={{ fontWeight: 600 }}>{item.clinic_name}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                  {item.department_name || 'All Departments'} • {item.consultation_type?.replace('_', ' ') || 'in_person'} • {item.priority_level === 'priority' ? 'High Priority' : 'Normal'}
                                </div>
                                <div style={{ marginTop: 4, fontSize: 13 }}>
                                  <strong>New:</strong> INR {Number(item.new_patient_fee || 0).toFixed(2)}
                                  {item.follow_up_fee !== null && item.follow_up_fee !== undefined ? ` • Follow-up: INR ${Number(item.follow_up_fee).toFixed(2)}` : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : viewUser.consultation_fee !== undefined && viewUser.consultation_fee !== null ? (
                        <div style={{ marginTop: 6 }}><strong>Consultation Fee (legacy):</strong> INR {viewUser.consultation_fee}</div>
                      ) : null}
                      {viewUser.languages && (
                        <div style={{ marginTop: 6 }}><strong>Languages:</strong> {viewUser.languages}</div>
                      )}
                      {viewUser.bio && (
                        <div style={{ marginTop: 6 }}><strong>Bio:</strong> {viewUser.bio}</div>
                      )}
                      {viewUser.certificate_path && (
                        <div style={{ marginTop: 10 }}>
                          <a className="btn btn-outline btn-sm" href={buildFileUrl(viewUser.certificate_path)} target="_blank" rel="noreferrer">
                            View License Certificate
                          </a>
                        </div>
                      )}
                      {Array.isArray(viewUser.specialization_certificates) && viewUser.specialization_certificates.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontWeight: 600, marginBottom: 6 }}>Specialization Certificates</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {viewUser.specialization_certificates.map((item) => (
                              <a
                                key={`spec_doc_${item.specialization_id}`}
                                className="btn btn-outline btn-sm"
                                href={buildFileUrl(item.certificate_path)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {item.name}{item.is_primary ? ' (Primary)' : ''}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      {Array.isArray(viewUser.education_certificates) && viewUser.education_certificates.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontWeight: 600, marginBottom: 6 }}>Education Certificates</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {viewUser.education_certificates.map((item) => (
                              <a
                                key={`edu_doc_${item.education_id}`}
                                className="btn btn-outline btn-sm"
                                href={buildFileUrl(item.certificate_path)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {item.name}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      {viewExtra?.clinics?.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                          <div style={{ fontWeight: 600, marginBottom: 6 }}>Clinics</div>
                          {viewExtra.clinics.map((c) => (
                            <div key={c.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, marginBottom: 10 }}>
                              <div style={{ fontWeight: 600 }}>{c.name}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {c.registration_number || 'No registration'} • {c.city}, {c.state}
                              </div>
                              <div style={{ marginTop: 6, fontSize: 13 }}>
                                <strong>Phone:</strong> {c.phone || '-'} • <strong>Email:</strong> {c.email || '-'}
                              </div>
                              {c.logo && (
                                <div style={{ marginTop: 6 }}>
                                  <img src={buildFileUrl(c.logo)} alt="Clinic logo" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, border: '1px solid #e5e7eb' }} />
                                </div>
                              )}
                              {c.certificate_path && (
                                <div style={{ marginTop: 6 }}>
                                  <a className="btn btn-outline btn-sm" href={buildFileUrl(c.certificate_path)} target="_blank" rel="noreferrer">View Clinic Certificate</a>
                                </div>
                              )}
                              {Array.isArray(c.photos) && c.photos.length > 0 && (
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                                  {c.photos.map((p, idx) => (
                                    <a key={`${c.id}_photo_${idx}`} href={buildFileUrl(p)} target="_blank" rel="noreferrer">
                                      <img src={buildFileUrl(p)} alt="Clinic" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {viewUser.role === 'laboratory' && (
                    <>
                      <div style={{ marginTop: 12 }}>
                        <strong>Lab Name:</strong> {viewUser.lab_name || viewUser.profile_info || '-'}
                      </div>
                      {viewUser.lab_registration_number && (
                        <div style={{ marginTop: 6 }}><strong>Registration No:</strong> {viewUser.lab_registration_number}</div>
                      )}
                      {viewUser.lab_phone && (
                        <div style={{ marginTop: 6 }}><strong>Phone:</strong> {viewUser.lab_phone}</div>
                      )}
                      {viewUser.lab_email && (
                        <div style={{ marginTop: 6 }}><strong>Email:</strong> {viewUser.lab_email}</div>
                      )}
                      {viewUser.lab_address && (
                        <div style={{ marginTop: 6 }}>
                          <strong>Address:</strong> {viewUser.lab_address}, {viewUser.lab_city}, {viewUser.lab_state} {viewUser.lab_pincode}
                        </div>
                      )}
                      {viewExtra?.lab_departments?.length > 0 && (
                        <div style={{ marginTop: 6 }}>
                          <strong>Departments:</strong> {viewExtra.lab_departments.join(', ')}
                        </div>
                      )}
                      {(viewUser.working_hours_start || viewUser.working_hours_end) && (
                        <div style={{ marginTop: 6 }}>
                          <strong>Working Hours:</strong> {viewUser.working_hours_start || '-'} - {viewUser.working_hours_end || '-'}
                        </div>
                      )}
                      {viewUser.working_days && (
                        <div style={{ marginTop: 6 }}><strong>Working Days:</strong> {viewUser.working_days}</div>
                      )}
                      {viewUser.lab_logo && (
                        <div style={{ marginTop: 6 }}>
                          <img src={buildFileUrl(viewUser.lab_logo)} alt="Lab logo" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, border: '1px solid #e5e7eb' }} />
                        </div>
                      )}
                      {viewUser.lab_certificate_path && (
                        <div style={{ marginTop: 10 }}>
                          <a className="btn btn-outline btn-sm" href={buildFileUrl(viewUser.lab_certificate_path)} target="_blank" rel="noreferrer">View Certificate</a>
                        </div>
                      )}
                      {Array.isArray(viewExtra?.lab_photos) && viewExtra.lab_photos.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                          {viewExtra.lab_photos.map((p, idx) => (
                            <a key={`lab_photo_${idx}`} href={buildFileUrl(p)} target="_blank" rel="noreferrer">
                              <img src={buildFileUrl(p)} alt="Lab" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {viewUser.role === 'pharmacist' && (
                    <>
                      <div style={{ marginTop: 12 }}>
                        <strong>Pharmacy:</strong> {viewUser.pharmacy_name || viewUser.profile_info || '-'}
                      </div>
                      {viewUser.pharmacy_license_number && (
                        <div style={{ marginTop: 6 }}><strong>License No:</strong> {viewUser.pharmacy_license_number}</div>
                      )}
                      {viewUser.pharmacy_phone && (
                        <div style={{ marginTop: 6 }}><strong>Phone:</strong> {viewUser.pharmacy_phone}</div>
                      )}
                      {viewUser.pharmacy_address && (
                        <div style={{ marginTop: 6 }}>
                          <strong>Address:</strong> {viewUser.pharmacy_address}, {viewUser.pharmacy_city}, {viewUser.pharmacy_state} {viewUser.pharmacy_pincode}
                        </div>
                      )}
                      {viewUser.gstin && (
                        <div style={{ marginTop: 6 }}><strong>GSTIN:</strong> {viewUser.gstin}</div>
                      )}
                      {viewUser.pharmacy_certificate_path && (
                        <div style={{ marginTop: 10 }}>
                          <a className="btn btn-outline btn-sm" href={buildFileUrl(viewUser.pharmacy_certificate_path)} target="_blank" rel="noreferrer">View License Certificate</a>
                        </div>
                      )}
                      {Array.isArray(viewExtra?.pharmacy_photos) && viewExtra.pharmacy_photos.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                          {viewExtra.pharmacy_photos.map((p, idx) => (
                            <a key={`pharm_photo_${idx}`} href={buildFileUrl(p)} target="_blank" rel="noreferrer">
                              <img src={buildFileUrl(p)} alt="Pharmacy" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {viewUser.role === 'patient' && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ marginBottom: 10 }}>
                        {viewUser.date_of_birth && (<div><strong>DOB:</strong> {viewUser.date_of_birth}</div>)}
                        {viewUser.gender && (<div><strong>Gender:</strong> {viewUser.gender}</div>)}
                        {viewUser.blood_group && (<div><strong>Blood Group:</strong> {viewUser.blood_group}</div>)}
                        {(viewUser.patient_address || viewUser.patient_city) && (
                          <div><strong>Address:</strong> {viewUser.patient_address || ''} {viewUser.patient_city || ''} {viewUser.patient_state || ''} {viewUser.patient_pincode || ''}</div>
                        )}
                        {(viewUser.emergency_contact_name || viewUser.emergency_contact_phone) && (
                          <div><strong>Emergency:</strong> {viewUser.emergency_contact_name || '-'} ({viewUser.emergency_contact_phone || '-'})</div>
                        )}
                        {viewUser.insurance_provider && (
                          <div><strong>Insurance:</strong> {viewUser.insurance_provider} ({viewUser.insurance_number || '-'})</div>
                        )}
                      </div>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>Recent Appointments</div>
                      {viewAppointments.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)' }}>No appointments yet.</div>
                      ) : (
                        <div className="table-container">
                          <table>
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Doctor</th>
                                <th>Clinic</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {viewAppointments.map((a) => (
                                <tr key={a.id}>
                                  <td>{a.appointment_date}</td>
                                  <td>{a.doctor_name}</td>
                                  <td>{a.clinic_name}</td>
                                  <td>{a.status}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => { setViewUser(null); setViewExtra(null); }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
