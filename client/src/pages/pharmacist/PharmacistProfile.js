import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { pharmacistAPI } from '../../utils/api';
import LocationSelect from '../../components/common/LocationSelect';
import FilePreview from '../../components/common/FilePreview';
import { clearDraft, loadDraft, saveDraft } from '../../utils/draftStorage';

const PHARMACY_PROFILE_DRAFT_KEY = 'pharmacy_profile_draft';

const reverseGeocodeCityState = async (lat, lng) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
    if (!res.ok) return { city: '', state: '', country: '' };
    const data = await res.json();
    const addr = data?.address || {};
    return {
      city: addr.city || addr.town || addr.village || addr.state_district || addr.county || '',
      state: addr.state || '',
      country: addr.country || '',
    };
  } catch {
    return { city: '', state: '', country: '' };
  }
};

export default function PharmacistProfile() {
  const [form, setForm] = useState({
    pharmacy_name: '',
    license_number: '',
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
    gstin: '',
  });
  const [verified, setVerified] = useState(false);
  const [certificate, setCertificate] = useState(null);
  const [hasCertificate, setHasCertificate] = useState(false);
  const [certificatePath, setCertificatePath] = useState('');
  const [photos, setPhotos] = useState([]);
  const [photoFiles, setPhotoFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [geo, setGeo] = useState({ status: 'idle', error: '' });

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const canRequestVerification = !verified
    && form.pharmacy_name
    && form.license_number
    && (hasCertificate || certificate);

  const loadProfile = () => {
    setLoading(true);
    pharmacistAPI.getProfile()
      .then(({ data }) => {
        const p = data?.pharmacist || {};
        const nextForm = {
          pharmacy_name: p.pharmacy_name || '',
          license_number: p.license_number || '',
          address: p.address || '',
          city: p.city || '',
          state: p.state || '',
          country: p.country || '',
          countryCode: '',
          stateCode: '',
          pincode: p.pincode || '',
          latitude: p.latitude || '',
          longitude: p.longitude || '',
          phone: p.phone || '',
          gstin: p.gstin || '',
        };
        const draft = loadDraft(PHARMACY_PROFILE_DRAFT_KEY);
        setForm(draft ? { ...nextForm, ...draft } : nextForm);
        setVerified(!!p.is_verified);
        setHasCertificate(!!p.license_certificate_path);
        setCertificatePath(p.license_certificate_path || '');
        setPhotos(p.photos || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadProfile(); }, []);
  useEffect(() => {
    if (loading) return;
    saveDraft(PHARMACY_PROFILE_DRAFT_KEY, form);
  }, [form, loading]);

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      toast.error('GPS not supported on this device');
      return;
    }
    setGeo({ status: 'loading', error: '' });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        const geo = await reverseGeocodeCityState(pos.coords.latitude, pos.coords.longitude);
        if (geo.city || geo.state || geo.country) {
          setForm((prev) => ({
            ...prev,
            city: prev.city || geo.city,
            state: prev.state || geo.state,
            country: prev.country || geo.country,
          }));
        }
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

  const handleSave = async () => {
    if (!form.license_number) return toast.error('License number is required');
    if (!hasCertificate && !certificate) return toast.error('License certificate is required');
    const fd = new FormData();
    const { phone, ...payload } = form;
    Object.entries(payload).forEach(([k, v]) => fd.append(k, v));
    if (certificate) fd.append('license_certificate', certificate);
    try {
      await pharmacistAPI.setupProfile(fd);
      if (certificate) setHasCertificate(true);
      clearDraft(PHARMACY_PROFILE_DRAFT_KEY);
      toast.success('Pharmacy profile updated');
      loadProfile();
    } catch {
      toast.error('Failed to update profile');
    }
  };

  const handleRequestVerification = async () => {
    try {
      await pharmacistAPI.requestVerification();
      toast.success('Verification request sent to admin');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to request verification');
    }
  };

  const uploadPhotos = async () => {
    if (!photoFiles.length) return toast.error('Select photos to upload');
    const fd = new FormData();
    photoFiles.forEach((file) => fd.append('photos', file));
    try {
      await pharmacistAPI.uploadPhotos(fd);
      toast.success('Pharmacy photos uploaded');
      setPhotoFiles([]);
      loadProfile();
    } catch {
      toast.error('Failed to upload photos');
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Pharmacy Profile</div>
        <span className={`badge ${verified ? 'badge-success' : 'badge-warning'}`}>
          {verified ? 'Verified' : 'Pending Verification'}
        </span>
      </div>
      <div className="card-body">
        {loading ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
        ) : (
          <>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Pharmacy Name<span className="required">*</span></label>
                <input className="form-input" value={form.pharmacy_name} onChange={(e) => set('pharmacy_name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">License Number<span className="required">*</span></label>
                <input className="form-input" value={form.license_number} onChange={(e) => set('license_number', e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Address</label>
              <input className="form-input" value={form.address} onChange={(e) => set('address', e.target.value)} />
            </div>

            <LocationSelect
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
                <label className="form-label">Pincode</label>
                <input className="form-input" value={form.pincode} onChange={(e) => set('pincode', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone (Read-only)</label>
                <input className="form-input" value={form.phone} disabled />
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Latitude</label>
                <input className="form-input" type="number" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} placeholder="e.g. 12.971599" />
              </div>
              <div className="form-group">
                <label className="form-label">Longitude</label>
                <input className="form-input" type="number" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} placeholder="e.g. 77.594566" />
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
                {geo.status === 'ready' && (
                  <div className="form-hint">GPS coordinates captured.</div>
                )}
              </div>
            </div>
            <div className="form-hint" style={{ marginTop: -8 }}>
              Phone is linked to your account and can&apos;t be edited here.
            </div>
            <div className="form-hint" style={{ marginTop: 6, marginBottom: 12 }}>
              Pharmacy profile text changes are saved locally on this device while you work offline. Certificate and photo uploads still need internet.
            </div>

            <div className="form-group">
              <label className="form-label">GSTIN</label>
              <input className="form-input" value={form.gstin} onChange={(e) => set('gstin', e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">License Certificate (PDF/Image)<span className="required">*</span></label>
              <input className="form-input" type="file" onChange={(e) => setCertificate(e.target.files?.[0] || null)} />
              <div className="form-hint">
                {hasCertificate ? 'Certificate already uploaded. Upload again to replace.' : 'Upload your pharmacy license for verification.'}
              </div>
              {certificatePath && <FilePreview path={certificatePath} label="License Certificate" />}
            </div>

            <div className="form-group">
              <label className="form-label">Pharmacy Photos (Multiple)</label>
              {photos.length > 0 ? (
                <div className="media-grid" style={{ marginBottom: 10 }}>
                  {photos.map((p, idx) => (
                    <img key={`${p}-${idx}`} src={p} alt="Pharmacy" className="media-thumb" />
                  ))}
                </div>
              ) : (
                <div className="form-hint">No pharmacy photos uploaded yet.</div>
              )}
              <input className="form-input" type="file" multiple accept="image/*" onChange={(e) => setPhotoFiles(Array.from(e.target.files || []))} />
              <div style={{ marginTop: 8 }}>
                <button className="btn btn-outline" onClick={uploadPhotos}>Upload Photos</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleSave}>Save Profile</button>
              {!verified && (
                <button className="btn btn-outline" onClick={handleRequestVerification} disabled={!canRequestVerification}>
                  Request Verification
                </button>
              )}
            </div>
            {!verified && !canRequestVerification && (
              <div className="form-hint" style={{ marginTop: 6 }}>
                Complete pharmacy name, license number, and certificate to request verification.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
