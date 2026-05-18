import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminAPI } from '../../utils/api';

export default function AdminClinics() {
  const [clinics, setClinics] = useState([]);
  const [search, setSearch] = useState('');
  const [verified, setVerified] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewClinic, setViewClinic] = useState(null);
  const [viewPhotos, setViewPhotos] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);

  const baseUrl = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';
  const buildFileUrl = (path) => {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const load = () => {
    setLoading(true);
    adminAPI.getClinics({ search, is_verified: verified })
      .then(({ data }) => setClinics(data.clinics || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, verified]);

  const verifyClinic = async (id, is_verified) => {
    try {
      await adminAPI.verifyClinic(id, { is_verified, admin_remarks: '' });
      toast.success('Clinic updated');
      load();
    } catch {
      toast.error('Failed to update clinic');
    }
  };

  const openClinic = async (c) => {
    setViewLoading(true);
    try {
      const { data } = await adminAPI.getClinicDetails(c.id);
      setViewClinic(data.clinic);
      setViewPhotos(data.photos || []);
    } catch {
      toast.error('Failed to load clinic details');
    } finally {
      setViewLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="card-title">Clinic Directory</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="form-input" placeholder="Search clinic/owner/city" value={search} onChange={(e) => setSearch(e.target.value)} />
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
        ) : clinics.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>No clinics found.</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Clinic</th>
                  <th>Owner</th>
                  <th>City</th>
                  <th>Verified</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clinics.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.registration_number || '-'}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{c.owner_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.owner_phone}</div>
                    </td>
                    <td>{c.city}</td>
                    <td>
                      <span className={`badge ${c.is_verified ? 'badge-success' : 'badge-warning'}`}>
                        {c.is_verified ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => openClinic(c)}>
                        View
                      </button>
                      {c.certificate_path && (
                        <a href={`${process.env.REACT_APP_API_URL?.replace('/api', '')}/${c.certificate_path}`} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                          Certificate
                        </a>
                      )}
                      <button className="btn btn-outline btn-sm" onClick={() => verifyClinic(c.id, c.is_verified ? 0 : 1)}>
                        {c.is_verified ? 'Unverify' : 'Verify'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewClinic && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Clinic Details</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => { setViewClinic(null); setViewPhotos([]); }}>X</button>
            </div>
            <div className="modal-body">
              {viewLoading ? (
                <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
              ) : (
                <>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{viewClinic.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                    Owner: {viewClinic.owner_name} • {viewClinic.owner_phone} • {viewClinic.owner_email || 'no email'}
                  </div>
                  {viewClinic.logo && (
                    <div style={{ marginBottom: 10 }}>
                      <img src={buildFileUrl(viewClinic.logo)} alt="Clinic logo" style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 12, border: '1px solid #e5e7eb' }} />
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div><strong>Registration No:</strong> {viewClinic.registration_number || '-'}</div>
                    <div><strong>Phone:</strong> {viewClinic.phone || '-'}</div>
                    <div><strong>Email:</strong> {viewClinic.email || '-'}</div>
                    <div><strong>Verified:</strong> {viewClinic.is_verified ? 'Yes' : 'No'}</div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <strong>Address:</strong> {viewClinic.address}, {viewClinic.city}, {viewClinic.state} {viewClinic.pincode}
                  </div>
                  {viewClinic.description && (
                    <div style={{ marginTop: 8 }}><strong>Description:</strong> {viewClinic.description}</div>
                  )}
                  {viewClinic.certificate_path && (
                    <div style={{ marginTop: 10 }}>
                      <a className="btn btn-outline btn-sm" href={buildFileUrl(viewClinic.certificate_path)} target="_blank" rel="noreferrer">
                        View Certificate
                      </a>
                    </div>
                  )}
                  {viewClinic.owner_license_number && (
                    <div style={{ marginTop: 8 }}>
                      <strong>Owner License:</strong> {viewClinic.owner_license_number}
                    </div>
                  )}
                  {viewClinic.owner_certificate_path && (
                    <div style={{ marginTop: 8 }}>
                      <a className="btn btn-outline btn-sm" href={buildFileUrl(viewClinic.owner_certificate_path)} target="_blank" rel="noreferrer">
                        Owner Certificate
                      </a>
                    </div>
                  )}
                  {Array.isArray(viewPhotos) && viewPhotos.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>Clinic Photos</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {viewPhotos.map((p, idx) => (
                          <a key={`clinic_photo_${idx}`} href={buildFileUrl(p)} target="_blank" rel="noreferrer">
                            <img src={buildFileUrl(p)} alt="Clinic" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => { setViewClinic(null); setViewPhotos([]); }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
