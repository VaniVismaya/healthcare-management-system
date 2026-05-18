import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { patientAPI } from '../../utils/api';
import PhoneInput from '../../components/common/PhoneInput';
import LocationSelect from '../../components/common/LocationSelect';
import { clearDraft, loadDraft, saveDraft } from '../../utils/draftStorage';

const PATIENT_PROFILE_DRAFT_KEY = 'patient_profile_draft';
const PATIENT_INSURANCE_DRAFT_KEY = 'patient_insurance_draft';

export default function PatientProfile() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [insuranceForm, setInsuranceForm] = useState({
    provider: '',
    policy_number: '',
    plan_name: '',
    valid_from: '',
    valid_to: ''
  });
  const [insuranceFile, setInsuranceFile] = useState(null);
  const [form, setForm] = useState({
    date_of_birth: '',
    gender: '',
    blood_group: '',
    address: '',
    city: '',
    state: '',
    country: '',
    countryCode: '',
    stateCode: '',
    pincode: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    allergies: '',
    chronic_conditions: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await patientAPI.getProfile();
      const profileDraft = loadDraft(PATIENT_PROFILE_DRAFT_KEY);
      const nextForm = {
        date_of_birth: data.patient?.date_of_birth || '',
        gender: data.patient?.gender || '',
        blood_group: data.patient?.blood_group || '',
        address: data.patient?.address || '',
        city: data.patient?.city || '',
        state: data.patient?.state || '',
        country: data.patient?.country || '',
        countryCode: '',
        stateCode: '',
        pincode: data.patient?.pincode || '',
        emergency_contact_name: data.patient?.emergency_contact_name || '',
        emergency_contact_phone: data.patient?.emergency_contact_phone || '',
        allergies: data.patient?.allergies || '',
        chronic_conditions: data.patient?.chronic_conditions || '',
      };
      setProfile(data.patient);
      setForm(profileDraft?.form ? { ...nextForm, ...profileDraft.form } : nextForm);
      try {
        const insuranceRes = await patientAPI.getInsurance();
        setPolicies(insuranceRes.data?.policies || []);
      } catch {
        setPolicies([]);
      }
    } catch {
      setProfile(null);
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const insuranceDraft = loadDraft(PATIENT_INSURANCE_DRAFT_KEY);
    if (insuranceDraft?.form) {
      setInsuranceForm((prev) => ({ ...prev, ...insuranceDraft.form }));
    }
  }, []);
  useEffect(() => {
    if (loading) return;
    saveDraft(PATIENT_PROFILE_DRAFT_KEY, { form });
  }, [form, loading]);
  useEffect(() => {
    saveDraft(PATIENT_INSURANCE_DRAFT_KEY, { form: insuranceForm });
  }, [insuranceForm]);

  const save = async () => {
    try {
      await patientAPI.updateProfile(form);
      clearDraft(PATIENT_PROFILE_DRAFT_KEY);
      toast.success('Profile updated');
      load();
    } catch {
      toast.error('Failed to update profile');
    }
  };

  const saveInsurance = async () => {
    if (!insuranceForm.provider || !insuranceForm.policy_number) {
      return toast.error('Provider and policy number are required');
    }
    const fd = new FormData();
    fd.append('provider', insuranceForm.provider);
    fd.append('policy_number', insuranceForm.policy_number);
    if (insuranceForm.plan_name) fd.append('plan_name', insuranceForm.plan_name);
    if (insuranceForm.valid_from) fd.append('valid_from', insuranceForm.valid_from);
    if (insuranceForm.valid_to) fd.append('valid_to', insuranceForm.valid_to);
    if (insuranceFile) fd.append('document', insuranceFile);
    try {
      await patientAPI.addInsurance(fd);
      toast.success('Insurance saved');
      clearDraft(PATIENT_INSURANCE_DRAFT_KEY);
      setInsuranceForm({ provider: '', policy_number: '', plan_name: '', valid_from: '', valid_to: '' });
      setInsuranceFile(null);
      load();
    } catch {
      toast.error('Failed to save insurance');
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Patient Profile</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : profile ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              <div><strong>Name:</strong> {profile.name}</div>
              <div><strong>Phone:</strong> {profile.phone || '-'}</div>
              <div><strong>Email:</strong> {profile.email || '-'}</div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>Profile not found.</div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Update Details</div>
        </div>
        <div className="card-body">
          <div className="form-hint" style={{ marginBottom: 12 }}>
            Profile details are saved locally on this device while you work offline. File uploads still need internet.
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input className="form-input" type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select className="form-select" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Blood Group</label>
            <select className="form-select" value={form.blood_group} onChange={(e) => setForm({ ...form, blood_group: e.target.value })}>
              <option value="">Select</option>
              {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((bg) => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <input className="form-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
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
              <input className="form-input" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Emergency Contact Name</label>
              <input className="form-input" value={form.emergency_contact_name} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Emergency Contact Phone</label>
            <PhoneInput value={form.emergency_contact_phone} onChange={(val) => setForm({ ...form, emergency_contact_phone: val })} />
          </div>
          <div className="form-group">
            <label className="form-label">Allergies</label>
            <input className="form-input" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Chronic Conditions</label>
            <input className="form-input" value={form.chronic_conditions} onChange={(e) => setForm({ ...form, chronic_conditions: e.target.value })} />
          </div>
          <button className="btn btn-primary" onClick={save}>Save Profile</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div className="card-title">Insurance & Policy (KYC)</div>
        </div>
        <div className="card-body">
          <div className="form-hint" style={{ marginBottom: 12 }}>
            Insurance form details are saved locally. If you lose internet, you may need to attach the KYC document again after reconnecting.
          </div>
          {policies.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', marginBottom: 12 }}>No insurance policies added yet.</div>
          ) : (
            <div className="table-container" style={{ marginBottom: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Policy #</th>
                    <th>Status</th>
                    <th>Valid</th>
                  </tr>
                </thead>
                <tbody>
                  {policies.map((p) => (
                    <tr key={p.id}>
                      <td>{p.provider}</td>
                      <td>{p.policy_number}</td>
                      <td>{p.status || 'pending'}</td>
                      <td>{p.valid_from || '-'} {p.valid_to ? `- ${p.valid_to}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Provider<span className="required">*</span></label>
              <input className="form-input" value={insuranceForm.provider} onChange={(e) => setInsuranceForm({ ...insuranceForm, provider: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Policy Number<span className="required">*</span></label>
              <input className="form-input" value={insuranceForm.policy_number} onChange={(e) => setInsuranceForm({ ...insuranceForm, policy_number: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Plan Name</label>
            <input className="form-input" value={insuranceForm.plan_name} onChange={(e) => setInsuranceForm({ ...insuranceForm, plan_name: e.target.value })} />
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Valid From</label>
              <input className="form-input" type="date" value={insuranceForm.valid_from} onChange={(e) => setInsuranceForm({ ...insuranceForm, valid_from: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Valid To</label>
              <input className="form-input" type="date" value={insuranceForm.valid_to} onChange={(e) => setInsuranceForm({ ...insuranceForm, valid_to: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">KYC Document</label>
            <input className="form-input" type="file" onChange={(e) => setInsuranceFile(e.target.files?.[0] || null)} />
          </div>
          <button className="btn btn-primary" onClick={saveInsurance}>Save Insurance</button>
        </div>
      </div>
    </div>
  );
}
