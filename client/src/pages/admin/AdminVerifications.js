import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../utils/api';
import { CheckCircle, XCircle, Eye, Building2, User, FlaskConical, Pill } from 'lucide-react';
import toast from 'react-hot-toast';

const roleIcon = { doctor: { icon: User, color: '#00B894', bg: '#E8F8F4' }, laboratory: { icon: FlaskConical, color: '#7C3AED', bg: '#F3EDFE' }, pharmacist: { icon: Pill, color: '#F59E0B', bg: '#FEF3C7' } };

export default function AdminVerifications() {
  const [data, setData] = useState({ users: [], clinics: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('users');
  const [modal, setModal] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [remarks, setRemarks] = useState('');

  const baseUrl = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';
  const buildFileUrl = (path) => {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const load = () => {
    setLoading(true);
    adminAPI.getPending().then(({ data }) => setData(data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openView = async (type, item) => {
    setViewLoading(true);
    try {
      if (type === 'user') {
        const { data } = await adminAPI.getUserDetails(item.id);
        setViewItem({ type, data: data.user, extra: data });
      } else {
        const { data } = await adminAPI.getClinicDetails(item.id);
        setViewItem({ type, data: data.clinic, extra: data });
      }
    } catch {
      toast.error('Failed to load details');
    } finally {
      setViewLoading(false);
    }
  };

  const handleVerify = async (id, is_verified, type = 'user') => {
    try {
      if (type === 'user') await adminAPI.verifyUser(id, { is_verified, remarks });
      else await adminAPI.verifyClinic(id, { is_verified, admin_remarks: remarks });
      toast.success(`${is_verified ? 'Verified' : 'Rejected'} successfully`);
      setModal(null); setRemarks('');
      load();
    } catch {}
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Verification Requests</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Review documents and approve verified providers</p>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
          Providers ({data.users?.length || 0})
        </button>
        <button className={`tab ${tab === 'clinics' ? 'active' : ''}`} onClick={() => setTab('clinics')}>
          Clinics ({data.clinics?.length || 0})
        </button>
      </div>

      {loading ? <div className="loading-page"><div className="spinner" /></div> : (
        <>
          {tab === 'users' && (
            <div className="card">
              {data.users?.length === 0 ? (
                <div className="empty-state"><User size={48} /><h3>No pending verifications</h3></div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr><th>Provider</th><th>Role</th><th>Profile Info</th><th>License / Reg No.</th><th>Phone</th><th>Registered</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {data.users?.map(user => {
                        const ri = roleIcon[user.role] || { icon: User, color: '#0A7EA4', bg: '#E8F4F8' };
                        return (
                          <tr key={user.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: ri.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <ri.icon size={17} color={ri.color} />
                                </div>
                                <div>
                                  <div style={{ fontWeight: 600 }}>{user.name}</div>
                                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user.email}</div>
                                </div>
                              </div>
                            </td>
                            <td><span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>{user.role}</span></td>
                            <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{user.profile_info || '-'}</td>
                            <td>{user.license_number || '-'}</td>
                            <td>{user.phone}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(user.created_at).toLocaleDateString()}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button className="btn btn-outline btn-sm" onClick={() => openView('user', user)}>
                                  <Eye size={13} /> View
                                </button>
                                {user.certificate_path && (
                                  <a href={`${process.env.REACT_APP_API_URL?.replace('/api', '')}/${user.certificate_path}`} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm" title="View Certificate">
                                    <Eye size={13} />
                                  </a>
                                )}
                                <button className="btn btn-sm btn-secondary" onClick={() => { setModal({ id: user.id, name: user.name, type: 'user', action: 'approve', licenseNumber: user.license_number, profileInfo: user.profile_info }); }}>
                                  <CheckCircle size={13} /> Verify
                                </button>
                                <button className="btn btn-sm btn-danger" onClick={() => { setModal({ id: user.id, name: user.name, type: 'user', action: 'reject', licenseNumber: user.license_number, profileInfo: user.profile_info }); }}>
                                  <XCircle size={13} /> Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'clinics' && (
            <div className="card">
              {data.clinics?.length === 0 ? (
                <div className="empty-state"><Building2 size={48} /><h3>No pending clinic verifications</h3></div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr><th>Clinic</th><th>Owner</th><th>City</th><th>Registration No.</th><th>Registered</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {data.clinics?.map(clinic => (
                        <tr key={clinic.id}>
                          <td><div style={{ fontWeight: 600 }}>{clinic.name}</div></td>
                          <td><div style={{ fontSize: 13 }}>{clinic.owner_name}<br /><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{clinic.owner_phone}</span></div></td>
                          <td>{clinic.city}</td>
                          <td>{clinic.registration_number || '-'}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(clinic.created_at).toLocaleDateString()}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-outline btn-sm" onClick={() => openView('clinic', clinic)}>
                                <Eye size={13} /> View
                              </button>
                              {clinic.certificate_path && (
                                <a href={`${process.env.REACT_APP_API_URL?.replace('/api', '')}/${clinic.certificate_path}`} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm"><Eye size={13} /></a>
                              )}
                              <button className="btn btn-sm btn-secondary" onClick={() => setModal({ id: clinic.id, name: clinic.name, type: 'clinic', action: 'approve' })}>
                                <CheckCircle size={13} /> Verify
                              </button>
                              <button className="btn btn-sm btn-danger" onClick={() => setModal({ id: clinic.id, name: clinic.name, type: 'clinic', action: 'reject' })}>
                                <XCircle size={13} /> Reject
                              </button>
                            </div>
                          </td>
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

      {/* Confirm Modal */}
      {modal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{modal.action === 'approve' ? '✅ Verify' : '❌ Reject'} {modal.type === 'user' ? 'Registration' : 'Clinic'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setModal(null)}><XCircle size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 16 }}>
                {modal.action === 'approve' ? 'Approve' : 'Reject'} <strong>{modal.name}</strong>?
              </p>
              {modal.type === 'user' && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                  {modal.profileInfo && (<div>Profile: {modal.profileInfo}</div>)}
                  {modal.licenseNumber && (<div>License / Reg No: {modal.licenseNumber}</div>)}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Remarks {modal.action === 'reject' && <span className="required">*</span>}</label>
                <textarea className="form-textarea" placeholder="Optional admin remarks..." value={remarks} onChange={e => setRemarks(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button
                className={`btn ${modal.action === 'approve' ? 'btn-secondary' : 'btn-danger'}`}
                onClick={() => handleVerify(modal.id, modal.action === 'approve', modal.type)}
              >
                {modal.action === 'approve' ? <><CheckCircle size={14} /> Verify</> : <><XCircle size={14} /> Reject</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewItem && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Verification Details</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setViewItem(null)}>X</button>
            </div>
            <div className="modal-body">
              {viewLoading ? (
                <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
              ) : (
                <>
                  {viewItem.type === 'user' && (
                    <>
                      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12 }}>
                        {viewItem.data.profile_image ? (
                          <img src={buildFileUrl(viewItem.data.profile_image)} alt="Profile" style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', border: '1px solid #e5e7eb' }} />
                        ) : (
                          <div style={{ width: 56, height: 56, borderRadius: 10, background: '#eef2f7' }} />
                        )}
                        <div>
                          <div style={{ fontWeight: 700 }}>{viewItem.data.name}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            {viewItem.data.role} - {viewItem.data.email || 'no email'} - {viewItem.data.phone || 'no phone'}
                          </div>
                        </div>
                      </div>
                      {viewItem.data.doctor_specialization && (
                        <div style={{ marginBottom: 6 }}><strong>Specialization:</strong> {viewItem.data.doctor_specialization}</div>
                      )}
                      {viewItem.data.qualification && (
                        <div style={{ marginBottom: 6 }}><strong>Qualification:</strong> {viewItem.data.qualification}</div>
                      )}
                      {viewItem.extra?.doctor_departments?.length > 0 && (
                        <div style={{ marginBottom: 6 }}><strong>Departments:</strong> {viewItem.extra.doctor_departments.join(', ')}</div>
                      )}
                      {viewItem.data.license_number && (
                        <div style={{ marginBottom: 6 }}><strong>License / Reg No:</strong> {viewItem.data.license_number}</div>
                      )}
                      {viewItem.data.certificate_path && (
                        <div style={{ marginBottom: 6 }}>
                          <a className="btn btn-outline btn-sm" href={buildFileUrl(viewItem.data.certificate_path)} target="_blank" rel="noreferrer">
                            View Certificate
                          </a>
                        </div>
                      )}
                      {viewItem.data.lab_registration_number && (
                        <div style={{ marginBottom: 6 }}><strong>Lab Registration:</strong> {viewItem.data.lab_registration_number}</div>
                      )}
                      {viewItem.data.lab_certificate_path && (
                        <div style={{ marginBottom: 6 }}>
                          <a className="btn btn-outline btn-sm" href={buildFileUrl(viewItem.data.lab_certificate_path)} target="_blank" rel="noreferrer">
                            View Lab Certificate
                          </a>
                        </div>
                      )}
                      {viewItem.data.pharmacy_license_number && (
                        <div style={{ marginBottom: 6 }}><strong>Pharmacy License:</strong> {viewItem.data.pharmacy_license_number}</div>
                      )}
                      {viewItem.data.pharmacy_certificate_path && (
                        <div style={{ marginBottom: 6 }}>
                          <a className="btn btn-outline btn-sm" href={buildFileUrl(viewItem.data.pharmacy_certificate_path)} target="_blank" rel="noreferrer">
                            View Pharmacy Certificate
                          </a>
                        </div>
                      )}
                      {Array.isArray(viewItem.extra?.lab_photos) && viewItem.extra.lab_photos.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontWeight: 600, marginBottom: 6 }}>Lab Photos</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {viewItem.extra.lab_photos.map((p, idx) => (
                              <a key={`lab_${idx}`} href={buildFileUrl(p)} target="_blank" rel="noreferrer">
                                <img src={buildFileUrl(p)} alt="Lab" style={{ width: 70, height: 70, borderRadius: 8, objectFit: 'cover', border: '1px solid #e5e7eb' }} />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      {Array.isArray(viewItem.extra?.pharmacy_photos) && viewItem.extra.pharmacy_photos.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontWeight: 600, marginBottom: 6 }}>Pharmacy Photos</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {viewItem.extra.pharmacy_photos.map((p, idx) => (
                              <a key={`pharm_${idx}`} href={buildFileUrl(p)} target="_blank" rel="noreferrer">
                                <img src={buildFileUrl(p)} alt="Pharmacy" style={{ width: 70, height: 70, borderRadius: 8, objectFit: 'cover', border: '1px solid #e5e7eb' }} />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {viewItem.type === 'clinic' && (
                    <>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>{viewItem.data.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
                        Owner: {viewItem.data.owner_name} - {viewItem.data.owner_phone} {viewItem.data.owner_email ? `• ${viewItem.data.owner_email}` : ''}
                      </div>
                      {viewItem.data.logo && (
                        <div style={{ marginBottom: 10 }}>
                          <img src={buildFileUrl(viewItem.data.logo)} alt="Clinic logo" style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover', border: '1px solid #e5e7eb' }} />
                        </div>
                      )}
                      <div style={{ marginBottom: 6 }}><strong>City:</strong> {viewItem.data.city}</div>
                      {viewItem.data.registration_number && (
                        <div style={{ marginBottom: 6 }}><strong>Registration No:</strong> {viewItem.data.registration_number}</div>
                      )}
                      {viewItem.data.certificate_path && (
                        <div style={{ marginBottom: 6 }}>
                          <a className="btn btn-outline btn-sm" href={buildFileUrl(viewItem.data.certificate_path)} target="_blank" rel="noreferrer">
                            View Certificate
                          </a>
                        </div>
                      )}
                      {Array.isArray(viewItem.extra?.photos) && viewItem.extra.photos.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontWeight: 600, marginBottom: 6 }}>Clinic Photos</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {viewItem.extra.photos.map((p, idx) => (
                              <a key={`clinic_${idx}`} href={buildFileUrl(p)} target="_blank" rel="noreferrer">
                                <img src={buildFileUrl(p)} alt="Clinic" style={{ width: 70, height: 70, borderRadius: 8, objectFit: 'cover', border: '1px solid #e5e7eb' }} />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setViewItem(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
