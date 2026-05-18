import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { doctorAPI, uploadAPI, departmentAPI, specializationAPI, educationAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import FilePreview from '../../components/common/FilePreview';
import MultiSelectDropdown from '../../components/common/MultiSelectDropdown';
import { clearDraft, loadDraft, saveDraft } from '../../utils/draftStorage';
import { doctorSpecializations, doctorEducations } from '../../utils/specializations';

const DOCTOR_PROFILE_DRAFT_KEY = 'doctor_profile_draft';
const emptyForm = {
  primary_specialization_id: '',
  additional_specialization_ids: [],
  education_ids: [],
  specialization: '',
  qualification: '',
  medical_license_number: '',
  experience_years: '',
  bio: '',
  languages: '',
  department_ids: [],
};

const parseNumberList = (value) => {
  if (Array.isArray(value)) return value.map((item) => Number(item)).filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => Number(item.trim()))
    .filter(Boolean);
};

const buildFallbackOptions = (items) => items.map((name, index) => ({ id: `fallback-${index}-${name}`, name, fallback: true }));

export default function DoctorProfile() {
  const { updateUser } = useAuth();
  const [account, setAccount] = useState({ name: '', phone: '', email: '' });
  const [form, setForm] = useState(emptyForm);
  const [departments, setDepartments] = useState([]);
  const [specializations, setSpecializations] = useState([]);
  const [educations, setEducations] = useState([]);
  const [verified, setVerified] = useState(false);
  const [certificate, setCertificate] = useState(null);
  const [hasCertificate, setHasCertificate] = useState(false);
  const [certificatePath, setCertificatePath] = useState('');
  const [specializationCertificates, setSpecializationCertificates] = useState([]);
  const [educationCertificates, setEducationCertificates] = useState([]);
  const [specializationFiles, setSpecializationFiles] = useState({});
  const [educationFiles, setEducationFiles] = useState({});
  const [profileImage, setProfileImage] = useState('');
  const [profileFile, setProfileFile] = useState(null);
  const [loading, setLoading] = useState(true);

  const specializationOptions = useMemo(
    () => (specializations.length ? specializations : buildFallbackOptions(doctorSpecializations)),
    [specializations]
  );
  const educationOptions = useMemo(
    () => (educations.length ? educations : buildFallbackOptions(doctorEducations)),
    [educations]
  );

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const selectedEducationLabels = useMemo(() => {
    if (form.education_ids.length) {
      return educationOptions
        .filter((item) => form.education_ids.includes(item.id))
        .map((item) => item.name);
    }
    return form.qualification
      ? form.qualification.split(',').map((item) => item.trim()).filter(Boolean)
      : [];
  }, [educationOptions, form.education_ids, form.qualification]);

  const specializationCertificateIds = useMemo(
    () => new Set((specializationCertificates || []).map((item) => Number(item.specialization_id))),
    [specializationCertificates]
  );
  const educationCertificateIds = useMemo(
    () => new Set((educationCertificates || []).map((item) => Number(item.education_id))),
    [educationCertificates]
  );
  const allSelectedSpecializationIds = useMemo(
    () => [...new Set([form.primary_specialization_id, ...form.additional_specialization_ids].map(Number).filter(Boolean))],
    [form.primary_specialization_id, form.additional_specialization_ids]
  );
  const missingSelectedSpecializationCerts = allSelectedSpecializationIds.filter((id) => !specializationCertificateIds.has(id) && !specializationFiles[id]);
  const missingSelectedEducationCerts = form.education_ids.map(Number).filter(Boolean).filter((id) => !educationCertificateIds.has(id) && !educationFiles[id]);

  const qualificationSummary = selectedEducationLabels.length ? selectedEducationLabels.join(', ') : form.qualification;
  const canRequestVerification = !verified
    && (form.primary_specialization_id || form.specialization)
    && (form.education_ids.length > 0 || form.qualification)
    && form.medical_license_number
    && (hasCertificate || certificate)
    && missingSelectedSpecializationCerts.length === 0
    && missingSelectedEducationCerts.length === 0
    && (profileImage || profileFile);

  const loadProfile = () => {
    setLoading(true);
    doctorAPI.getProfile()
      .then(({ data }) => {
        const doc = data?.doctor || {};
        const profileDraft = loadDraft(DOCTOR_PROFILE_DRAFT_KEY);
        const nextForm = {
          primary_specialization_id: doc.primary_specialization_id ? Number(doc.primary_specialization_id) : '',
          additional_specialization_ids: parseNumberList(doc.additional_specialization_ids),
          education_ids: parseNumberList(doc.education_ids),
          specialization: doc.primary_specialization || doc.specialization || '',
          qualification: doc.qualification || '',
          medical_license_number: doc.medical_license_number || '',
          experience_years: doc.experience_years || '',
          bio: doc.bio || '',
          languages: doc.languages || '',
          department_ids: parseNumberList(doc.department_ids),
        };
        setAccount({
          name: doc.name || '',
          phone: doc.phone || '',
          email: doc.email || '',
        });
        setForm(profileDraft?.form ? {
          ...nextForm,
          ...profileDraft.form,
          additional_specialization_ids: Array.isArray(profileDraft.form.additional_specialization_ids)
            ? profileDraft.form.additional_specialization_ids
            : nextForm.additional_specialization_ids,
          education_ids: Array.isArray(profileDraft.form.education_ids)
            ? profileDraft.form.education_ids
            : nextForm.education_ids,
          department_ids: Array.isArray(profileDraft.form.department_ids)
            ? profileDraft.form.department_ids
            : nextForm.department_ids,
        } : nextForm);
        setVerified(!!doc.is_verified);
        setHasCertificate(!!doc.license_certificate_path);
        setCertificatePath(doc.license_certificate_path || '');
        setSpecializationCertificates(doc.specialization_certificates || []);
        setEducationCertificates(doc.education_certificates || []);
        setSpecializationFiles({});
        setEducationFiles({});
        setProfileImage(doc.profile_image || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadProfile(); }, []);

  useEffect(() => {
    departmentAPI.list()
      .then(({ data }) => setDepartments(data.departments || []))
      .catch(() => {});
    specializationAPI.list()
      .then(({ data }) => setSpecializations(data.specializations || []))
      .catch(() => {});
    educationAPI.list()
      .then(({ data }) => setEducations(data.educations || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (loading) return;
    saveDraft(DOCTOR_PROFILE_DRAFT_KEY, { form });
  }, [form, loading]);

  const handlePrimarySpecialization = (value) => {
    const selected = specializationOptions.find((item) => String(item.id) === String(value));
    setForm((prev) => ({
      ...prev,
      primary_specialization_id: selected?.fallback ? '' : (selected?.id || ''),
      specialization: selected?.name || '',
      additional_specialization_ids: prev.additional_specialization_ids.filter((item) => String(item) !== String(selected?.id)),
    }));
  };

  const setMultiValue = (key, next) => {
    setForm((prev) => ({ ...prev, [key]: next }));
  };

  const handleSave = async (options = {}) => {
    const { silent } = options;
    if ((!form.primary_specialization_id && !form.specialization) || (!form.education_ids.length && !form.qualification) || !form.medical_license_number) {
      if (!silent) toast.error('Primary specialization, education, and license number are required');
      return false;
    }
    if (!profileImage && !profileFile) {
      if (!silent) toast.error('Profile photo is required');
      return false;
    }
    if (!hasCertificate && !certificate) {
      if (!silent) toast.error('License certificate is required');
      return false;
    }
    if (profileFile) {
      const imgForm = new FormData();
      imgForm.append('image', profileFile);
      try {
        const { data } = await uploadAPI.profileImage(imgForm);
        setProfileImage(data.path);
        updateUser({ profile_image: data.path });
      } catch {
        if (!silent) toast.error('Failed to upload profile photo');
        return false;
      }
    }

    const selectedPrimary = specializationOptions.find((item) => String(item.id) === String(form.primary_specialization_id));
    const selectedAdditionalNames = specializationOptions
      .filter((item) => form.additional_specialization_ids.some((id) => String(id) === String(item.id)))
      .map((item) => item.name);
    const selectedEducationNames = educationOptions
      .filter((item) => form.education_ids.some((id) => String(id) === String(item.id)))
      .map((item) => item.name);

    const fd = new FormData();
    fd.append('primary_specialization_id', form.primary_specialization_id || '');
    fd.append('additional_specialization_ids', form.additional_specialization_ids.filter((item) => typeof item === 'number').join(','));
    fd.append('education_ids', form.education_ids.filter((item) => typeof item === 'number').join(','));
    fd.append('specialization', selectedPrimary?.name || form.specialization || selectedAdditionalNames[0] || '');
    fd.append('qualification', selectedEducationNames.length ? selectedEducationNames.join(', ') : form.qualification || '');
    fd.append('medical_license_number', form.medical_license_number);
    fd.append('experience_years', form.experience_years);
    fd.append('bio', form.bio);
    fd.append('languages', form.languages);
    fd.append('department_ids', form.department_ids.join(','));
    if (certificate) fd.append('license_certificate', certificate);
    Object.entries(specializationFiles).forEach(([id, file]) => {
      if (file) fd.append(`specialization_certificate_${id}`, file);
    });
    Object.entries(educationFiles).forEach(([id, file]) => {
      if (file) fd.append(`education_certificate_${id}`, file);
    });

    try {
      await doctorAPI.setupProfile(fd);
      if (certificate) setHasCertificate(true);
      clearDraft(DOCTOR_PROFILE_DRAFT_KEY);
      if (!silent) toast.success('Profile updated');
      loadProfile();
      return true;
    } catch {
      if (!silent) toast.error('Failed to update profile');
      return false;
    }
  };

  const handleRequestVerification = async () => {
    if (!hasCertificate || profileFile) {
      const saved = await handleSave({ silent: true });
      if (!saved) return;
    }
    try {
      await doctorAPI.requestVerification();
      toast.success('Verification request sent to admin');
      loadProfile();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to request verification');
    }
  };

  const setSpecializationFile = (id, file) => {
    setSpecializationFiles((prev) => ({ ...prev, [id]: file || null }));
  };

  const setEducationFile = (id, file) => {
    setEducationFiles((prev) => ({ ...prev, [id]: file || null }));
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Doctor Profile</div>
        <span className={`badge ${verified ? 'badge-success' : 'badge-warning'}`}>
          {verified ? 'Verified' : 'Pending Verification'}
        </span>
      </div>
      <div className="card-body">
        {loading ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
        ) : (
          <>
            <div className="form-grid" style={{ marginBottom: 10 }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" value={account.name} disabled />
              </div>
              <div className="form-group">
                <label className="form-label">Phone (Read-only)</label>
                <input className="form-input" value={account.phone} disabled />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email (Read-only)</label>
              <input className="form-input" type="email" value={account.email} disabled />
            </div>
            <div className="form-hint" style={{ marginTop: -8, marginBottom: 14 }}>
              Phone and email are linked to your account and can't be edited here.
            </div>
            <div className="form-hint" style={{ marginTop: -8, marginBottom: 14 }}>
              Profile text changes are saved locally on this device while you work offline. Photo and certificate uploads still need internet.
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Primary Specialization<span className="required">*</span></label>
                <select className="form-select" value={form.primary_specialization_id || ''} onChange={(e) => handlePrimarySpecialization(e.target.value)}>
                  <option value="">Select Primary Specialization</option>
                  {specializationOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Qualification Summary<span className="required">*</span></label>
                <input
                  className="form-input"
                  value={qualificationSummary}
                  onChange={(e) => set('qualification', e.target.value)}
                  placeholder={educations.length ? 'Selected education will appear here' : 'e.g. MBBS, MD'}
                  readOnly={educations.length > 0}
                />
              </div>
            </div>

            <div className="form-group">
              <MultiSelectDropdown
                label="Additional Specializations"
                options={specializationOptions.filter((item) => String(item.id) !== String(form.primary_specialization_id))}
                value={form.additional_specialization_ids}
                onChange={(next) => setMultiValue('additional_specialization_ids', next)}
                placeholder="Select additional specializations"
                helper="Choose other specialties you actively practice in addition to your primary one."
              />
            </div>

            {allSelectedSpecializationIds.length > 0 && (
              <div className="form-group">
                <label className="form-label">Specialization Certificates<span className="required">*</span></label>
                <div style={{ display: 'grid', gap: 14 }}>
                  {specializationOptions
                    .filter((item) => allSelectedSpecializationIds.includes(Number(item.id)))
                    .map((item) => {
                      const existing = specializationCertificates.find((doc) => Number(doc.specialization_id) === Number(item.id));
                      return (
                        <div key={`spec_cert_${item.id}`} style={{ border: '1px solid var(--border-light)', borderRadius: 12, padding: 12 }}>
                          <div style={{ fontWeight: 600, marginBottom: 8 }}>
                            {item.name}{Number(item.id) === Number(form.primary_specialization_id) ? ' (Primary)' : ''}
                          </div>
                          <input
                            className="form-input"
                            type="file"
                            onChange={(e) => setSpecializationFile(item.id, e.target.files?.[0] || null)}
                          />
                          <div className="form-hint" style={{ marginTop: 6 }}>
                            {existing ? 'Certificate already uploaded. Upload again to replace it.' : 'Upload proof for this specialization.'}
                          </div>
                          {existing?.certificate_path && <FilePreview path={existing.certificate_path} label={`${item.name} Certificate`} />}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            <div className="form-group">
              <MultiSelectDropdown
                label="Education"
                required
                options={educationOptions}
                value={form.education_ids}
                onChange={(next) => setMultiValue('education_ids', next)}
                placeholder="Select education"
                helper={!educations.length ? 'Admin-managed education options will appear here once master data is loaded.' : ''}
              />
            </div>

            {form.education_ids.length > 0 && (
              <div className="form-group">
                <label className="form-label">Education Certificates<span className="required">*</span></label>
                <div style={{ display: 'grid', gap: 14 }}>
                  {educationOptions
                    .filter((item) => form.education_ids.map(Number).includes(Number(item.id)))
                    .map((item) => {
                      const existing = educationCertificates.find((doc) => Number(doc.education_id) === Number(item.id));
                      return (
                        <div key={`edu_cert_${item.id}`} style={{ border: '1px solid var(--border-light)', borderRadius: 12, padding: 12 }}>
                          <div style={{ fontWeight: 600, marginBottom: 8 }}>{item.name}</div>
                          <input
                            className="form-input"
                            type="file"
                            onChange={(e) => setEducationFile(item.id, e.target.files?.[0] || null)}
                          />
                          <div className="form-hint" style={{ marginTop: 6 }}>
                            {existing ? 'Certificate already uploaded. Upload again to replace it.' : 'Upload proof for this education entry.'}
                          </div>
                          {existing?.certificate_path && <FilePreview path={existing.certificate_path} label={`${item.name} Certificate`} />}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            <div className="form-group">
              <MultiSelectDropdown
                label="Departments"
                options={departments}
                value={form.department_ids}
                onChange={(next) => setMultiValue('department_ids', next)}
                placeholder="Select departments"
              />
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Medical License Number<span className="required">*</span></label>
                <input className="form-input" value={form.medical_license_number} onChange={(e) => set('medical_license_number', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Experience (Years)</label>
                <input className="form-input" type="number" value={form.experience_years} onChange={(e) => set('experience_years', e.target.value)} />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Languages</label>
                <input className="form-input" placeholder="English, Hindi" value={form.languages} onChange={(e) => set('languages', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Consultation Fees</label>
                <div className="form-hint" style={{ paddingTop: 12 }}>
                  Consultation charges are managed clinic-wise now. Use the <strong>Consultation Fees</strong> page to set different fees for each clinic and department.
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Bio</label>
              <textarea className="form-textarea" value={form.bio} onChange={(e) => set('bio', e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Profile Photo<span className="required">*</span></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--surface-2)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {profileImage ? (
                    <img src={profileImage} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    (account.name || 'D').slice(0, 1)
                  )}
                </div>
                <input className="form-input" type="file" accept="image/*" onChange={(e) => setProfileFile(e.target.files?.[0] || null)} />
              </div>
              <div className="form-hint">Upload a clear photo for patient-facing profiles.</div>
              {profileImage && <FilePreview path={profileImage} label="Profile Photo" imageHeight={80} />}
            </div>

            <div className="form-group">
              <label className="form-label">License Certificate (PDF/Image)<span className="required">*</span></label>
              <input className="form-input" type="file" onChange={(e) => setCertificate(e.target.files?.[0] || null)} />
              <div className="form-hint">
                {hasCertificate ? 'Certificate already uploaded. Upload again to replace.' : 'Upload your license certificate for verification.'}
              </div>
              {certificatePath && <FilePreview path={certificatePath} label="License Certificate" />}
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
                Complete primary specialization, education, license number, profile photo, and certificate to request verification.
              </div>
            )}
            {!verified && (missingSelectedSpecializationCerts.length > 0 || missingSelectedEducationCerts.length > 0) && (
              <div className="form-hint" style={{ marginTop: 6 }}>
                Upload certificates for all selected specializations and education entries before sending verification.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
