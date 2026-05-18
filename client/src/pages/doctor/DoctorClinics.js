import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { clinicAPI, orgRoleAPI } from '../../utils/api';
import PhoneInput from '../../components/common/PhoneInput';
import LocationSelect from '../../components/common/LocationSelect';
import FilePreview from '../../components/common/FilePreview';

export default function DoctorClinics() {
  const [clinics, setClinics] = useState([]);
  const [clinicRoles, setClinicRoles] = useState({});
  const [clinicStaff, setClinicStaff] = useState({});
  const [rolesLoading, setRolesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: '',
    registration_number: '',
    address: '',
    city: '',
    state: '',
    country: '',
    countryCode: '',
    stateCode: '',
    pincode: '',
    latitude: '',
    longitude: '',
    phone: '',
    email: '',
    description: '',
    certificate: null,
    logo: null,
  });
  const [editingId, setEditingId] = useState(null);
  const [receptionist, setReceptionist] = useState({ name: '', phone: '', email: '', clinic_id: '', org_role_id: '' });
  const [geo, setGeo] = useState({ status: 'idle', error: '' });
  const [photoModal, setPhotoModal] = useState(null);
  const [photoFiles, setPhotoFiles] = useState([]);
  const editingClinic = clinics.find((clinic) => String(clinic.id) === String(editingId));

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await clinicAPI.getMyClinics();
      const clinicList = data.clinics || [];
      setClinics(clinicList);

      const details = await Promise.all(
        clinicList.map(async (clinic) => {
          const [rolesRes, staffRes] = await Promise.allSettled([
            clinicAPI.getRoles(clinic.id),
            clinicAPI.getReceptionists(clinic.id),
          ]);

          return {
            clinicId: clinic.id,
            roles: rolesRes.status === 'fulfilled' ? (rolesRes.value.data?.roles || []) : [],
            staff: staffRes.status === 'fulfilled' ? (staffRes.value.data?.receptionists || []) : [],
          };
        })
      );

      const nextRoles = {};
      const nextStaff = {};
      details.forEach(({ clinicId, roles, staff }) => {
        nextRoles[clinicId] = roles;
        nextStaff[clinicId] = staff;
      });
      setClinicRoles(nextRoles);
      setClinicStaff(nextStaff);
    } catch {
      setClinics([]);
      setClinicRoles({});
      setClinicStaff({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const clinicId = receptionist.clinic_id;
    if (!clinicId) return;
    if (clinicRoles[clinicId] !== undefined) return;

    const loadSelectedClinicRoles = async () => {
      setRolesLoading(true);
      try {
        const { data } = await orgRoleAPI.list({ org_type: 'clinic', org_id: clinicId });
        setClinicRoles((prev) => ({
          ...prev,
          [clinicId]: data.roles || [],
        }));
      } catch {
        setClinicRoles((prev) => ({
          ...prev,
          [clinicId]: [],
        }));
      } finally {
        setRolesLoading(false);
      }
    };

    loadSelectedClinicRoles();
  }, [receptionist.clinic_id, clinicRoles]);

  const submitClinic = async () => {
    if (!form.name || !form.address || !form.country || !form.city || !form.state || !form.pincode) {
      return toast.error('Please fill required clinic fields');
    }
    if (!form.registration_number) {
      return toast.error('Registration number is required');
    }
    if (!editingId && !form.certificate) {
      return toast.error('Clinic certificate is required');
    }
    try {
      if (editingId) {
        if (form.certificate || form.logo) {
          const fd = new FormData();
          Object.entries(form).forEach(([k, v]) => {
            if (v !== '' && v !== null && v !== undefined && k !== 'certificate' && k !== 'logo') fd.append(k, v);
          });
          if (form.certificate) fd.append('certificate', form.certificate);
          if (form.logo) fd.append('logo', form.logo);
          await clinicAPI.update(editingId, fd);
        } else {
          await clinicAPI.update(editingId, {
            name: form.name,
            registration_number: form.registration_number,
            address: form.address,
            country: form.country,
            city: form.city,
            state: form.state,
            pincode: form.pincode,
            latitude: form.latitude,
            longitude: form.longitude,
            phone: form.phone,
            email: form.email,
            description: form.description,
          });
        }
        toast.success('Clinic updated');
      } else {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => {
          if (v !== '' && v !== null && v !== undefined && k !== 'certificate' && k !== 'logo') fd.append(k, v);
        });
        if (form.certificate) fd.append('certificate', form.certificate);
        if (form.logo) fd.append('logo', form.logo);
        await clinicAPI.create(fd);
        toast.success('Clinic submitted for verification');
      }
      setForm({ name: '', registration_number: '', address: '', city: '', state: '', country: '', countryCode: '', stateCode: '', pincode: '', latitude: '', longitude: '', phone: '', email: '', description: '', certificate: null, logo: null });
      setEditingId(null);
      load();
    } catch {
      toast.error(editingId ? 'Failed to update clinic' : 'Failed to create clinic');
    }
  };

  const startEdit = (clinic) => {
    setEditingId(clinic.id);
    setForm({
      name: clinic.name || '',
      registration_number: clinic.registration_number || '',
      address: clinic.address || '',
      city: clinic.city || '',
      state: clinic.state || '',
      country: clinic.country || '',
      countryCode: '',
      stateCode: '',
      pincode: clinic.pincode || '',
      latitude: clinic.latitude || '',
      longitude: clinic.longitude || '',
      phone: clinic.phone || '',
      email: clinic.email || '',
      description: clinic.description || '',
      certificate: null,
      logo: null,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      toast.error('GPS not supported on this device');
      return;
    }
    setGeo({ status: 'loading', error: '' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setGeo({ status: 'ready', error: '' });
        toast.success('Location captured');
      },
      (err) => {
        setGeo({ status: 'error', error: err.message || 'Location access denied' });
        toast.error('Location access denied');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const addReceptionist = async () => {
    if (!receptionist.name || !receptionist.phone || !receptionist.clinic_id) {
      return toast.error('Name, phone, and clinic are required');
    }
    try {
      await clinicAPI.addReceptionist(receptionist);
      toast.success('Clinic staff added');
      setReceptionist({ name: '', phone: '', email: '', clinic_id: '', org_role_id: '' });
      await load();
    } catch {
      toast.error('Failed to add clinic staff');
    }
  };

  const selectedClinicRoles = receptionist.clinic_id ? (clinicRoles[receptionist.clinic_id] || []) : [];
  const rolePlaceholder = !receptionist.clinic_id
    ? 'Select Clinic First'
    : rolesLoading
      ? 'Loading Roles...'
      : selectedClinicRoles.length
        ? 'Select Role (Optional)'
        : 'No Staff Roles Found';

  const requestClinicVerification = async (clinicId) => {
    try {
      await clinicAPI.requestVerification(clinicId);
      toast.success('Verification request sent to admin');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to request verification');
    }
  };

  const uploadPhotos = async () => {
    if (!photoModal?.id) return;
    if (!photoFiles.length) return toast.error('Select photos to upload');
    const fd = new FormData();
    photoFiles.forEach((file) => fd.append('photos', file));
    try {
      await clinicAPI.uploadPhotos(photoModal.id, fd);
      toast.success('Clinic photos uploaded');
      setPhotoFiles([]);
      setPhotoModal(null);
      load();
    } catch {
      toast.error('Failed to upload photos');
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Register Clinic</div>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Clinic Name<span className="required">*</span></label>
              <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Registration Number<span className="required">*</span></label>
              <input className="form-input" value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Address<span className="required">*</span></label>
            <input className="form-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <LocationSelect
            required
            value={{
              country: form.country,
              countryCode: form.countryCode,
              state: form.state,
              stateCode: form.stateCode,
              city: form.city,
            }}
            onChange={(loc) =>
              setForm((prev) => ({
                ...prev,
                country: loc.country,
                countryCode: loc.countryCode,
                state: loc.state,
                stateCode: loc.stateCode,
                city: loc.city,
              }))
            }
          />
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Pincode<span className="required">*</span></label>
              <input className="form-input" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
            </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <PhoneInput value={form.phone} onChange={(val) => setForm({ ...form, phone: val })} />
              </div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Latitude</label>
              <input className="form-input" type="number" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="e.g. 12.971599" />
            </div>
            <div className="form-group">
              <label className="form-label">Longitude</label>
              <input className="form-input" type="number" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="e.g. 77.594566" />
            </div>
          </div>
          <div className="form-grid" style={{ alignItems: 'end' }}>
            <div className="form-group">
              <label className="form-label">Use My Location</label>
              <button className="btn btn-outline" onClick={handleUseLocation} disabled={geo.status === 'loading'}>
                {geo.status === 'loading' ? 'Detecting...' : 'Use GPS'}
              </button>
              {geo.status === 'error' && (
                <div className="form-hint" style={{ color: '#B91C1C' }}>{geo.error}</div>
              )}
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Logo (optional)</label>
              <input className="form-input" type="file" onChange={(e) => setForm({ ...form, logo: e.target.files?.[0] || null })} />
              {editingClinic?.logo && <FilePreview path={editingClinic.logo} label="Clinic Logo" imageHeight={80} />}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Certificate (PDF/Image)<span className="required">*</span></label>
            <input className="form-input" type="file" onChange={(e) => setForm({ ...form, certificate: e.target.files?.[0] || null })} />
            <div className="form-hint">{editingId ? 'Upload again to replace certificate.' : 'Required for verification.'}</div>
            {editingClinic?.certificate_path && <FilePreview path={editingClinic.certificate_path} label="Clinic Certificate" />}
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={submitClinic}>
              {editingId ? 'Update Clinic' : 'Submit Clinic'}
            </button>
            {editingId && (
              <button className="btn btn-ghost" onClick={() => { setEditingId(null); setForm({ name: '', registration_number: '', address: '', city: '', state: '', pincode: '', latitude: '', longitude: '', phone: '', email: '', description: '', certificate: null, logo: null }); }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Clinic Staff</div>
        </div>
        <div className="card-body">
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>
            Add the actual staff member for a clinic and map them to a clinic-specific role if needed.
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Name<span className="required">*</span></label>
              <input className="form-input" value={receptionist.name} onChange={(e) => setReceptionist({ ...receptionist, name: e.target.value })} />
            </div>
              <div className="form-group">
                <label className="form-label">Phone<span className="required">*</span></label>
                <PhoneInput value={receptionist.phone} onChange={(val) => setReceptionist({ ...receptionist, phone: val })} required />
              </div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" value={receptionist.email} onChange={(e) => setReceptionist({ ...receptionist, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Clinic<span className="required">*</span></label>
              <select className="form-select" value={receptionist.clinic_id} onChange={(e) => setReceptionist({ ...receptionist, clinic_id: e.target.value, org_role_id: '' })}>
                <option value="">Select Clinic</option>
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              </div>
            </div>
          <div className="form-group">
            <label className="form-label">Staff Role</label>
            <select
              className="form-select"
              value={receptionist.org_role_id}
              onChange={(e) => setReceptionist({ ...receptionist, org_role_id: e.target.value })}
              disabled={!receptionist.clinic_id || rolesLoading || !selectedClinicRoles.length}
            >
              <option value="">{rolePlaceholder}</option>
              {selectedClinicRoles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
            <div className="form-hint">
              {receptionist.clinic_id && !rolesLoading && !selectedClinicRoles.length
                ? 'Create clinic roles first in `Staff Roles`, then they will appear here.'
                : 'Use roles from `Staff Roles` like Receptionist, Billing, Front Desk, or Assistant.'}
            </div>
          </div>
          <button className="btn btn-primary" onClick={addReceptionist}>Add Staff Member</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">My Clinics</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : clinics.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No clinics registered yet.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Registration #</th>
                    <th>Logo</th>
                    <th>Photos</th>
                    <th>City</th>
                    <th>Phone</th>
                    <th>Clinic Staff</th>
                    <th>Status</th>
                    <th>Documents</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {clinics.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{c.registration_number || '-'}</td>
                      <td>
                        {c.logo ? (
                          <img src={c.logo} alt="Clinic Logo" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No logo</span>
                        )}
                      </td>
                      <td>
                        {c.photos && c.photos.length ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            {c.photos.slice(0, 3).map((p, idx) => (
                              <img key={`${c.id}-ph-${idx}`} src={p} alt="Clinic" style={{ width: 36, height: 28, borderRadius: 8, objectFit: 'cover' }} />
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No photos</span>
                        )}
                      </td>
                      <td>{c.city}</td>
                      <td>{c.phone || '-'}</td>
                      <td>
                        {clinicStaff[c.id]?.length ? (
                          <div style={{ display: 'grid', gap: 6 }}>
                            {clinicStaff[c.id].slice(0, 2).map((staff) => (
                              <div key={`${c.id}-staff-${staff.user_id}`} style={{ fontSize: 12 }}>
                                <div style={{ fontWeight: 700 }}>{staff.name}</div>
                                <div style={{ color: 'var(--text-muted)' }}>
                                  {staff.assigned_roles || 'Clinic Staff'}
                                </div>
                              </div>
                            ))}
                            {clinicStaff[c.id].length > 2 && (
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                +{clinicStaff[c.id].length - 2} more
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No staff</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${c.is_verified ? 'badge-success' : 'badge-warning'}`}>
                          {c.is_verified ? 'Verified' : 'Pending'}
                        </span>
                      </td>
                      <td>
                        {c.certificate_path ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <a className="btn btn-outline btn-sm" href={c.certificate_path} target="_blank" rel="noreferrer">Certificate</a>
                            {c.logo && <a className="btn btn-ghost btn-sm" href={c.logo} target="_blank" rel="noreferrer">Logo</a>}
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No docs</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => startEdit(c)}>Edit</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setPhotoModal({ id: c.id, name: c.name }); setPhotoFiles([]); }}>
                            Add Photos
                          </button>
                          {!c.is_verified && (
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => requestClinicVerification(c.id)}
                              disabled={!c.registration_number || !c.certificate_path}
                            >
                              Request Verification
                            </button>
                          )}
                        </div>
                        {!c.is_verified && (!c.registration_number || !c.certificate_path) && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                            Add registration number and certificate to request verification.
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {photoModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Upload Clinic Photos</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setPhotoModal(null)}>X</button>
            </div>
            <div className="modal-body">
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{photoModal.name}</div>
              <input className="form-input" type="file" multiple accept="image/*" onChange={(e) => setPhotoFiles(Array.from(e.target.files || []))} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setPhotoModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={uploadPhotos}>Upload</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
