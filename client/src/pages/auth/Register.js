import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { authAPI, departmentAPI, specializationAPI, educationAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { sendFirebaseOtp, confirmFirebaseOtp, isFirebaseConfigured } from '../../utils/firebase';
import toast from 'react-hot-toast';
import { Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import PhoneInput from '../../components/common/PhoneInput';
import LocationSelect from '../../components/common/LocationSelect';
import MultiSelectDropdown from '../../components/common/MultiSelectDropdown';
import { doctorSpecializations, doctorEducations } from '../../utils/specializations';

const roleConfig = {
  patient: {
    label: 'Patient',
    steps: ['Phone Verification', 'Basic Info', 'Health Profile'],
    fields: {
      basic: ['name', 'email', 'password'],
      profile: ['date_of_birth', 'gender', 'blood_group', 'allergies'],
    },
  },
  doctor: {
    label: 'Doctor',
    steps: ['Phone Verification', 'Basic Info', 'Professional Details'],
    note: 'Your account will be reviewed by admin before activation',
  },
  laboratory: {
    label: 'Laboratory',
    steps: ['Phone Verification', 'Basic Info', 'Lab Details'],
    note: 'Please have your registration certificate ready for upload',
  },
  pharmacist: {
    label: 'Pharmacist',
    steps: ['Phone Verification', 'Basic Info', 'Pharmacy Details'],
    note: 'Your pharmacy license will be verified by admin',
  },
};

const buildFallbackOptions = (items) => items.map((name, index) => ({ id: `fallback-${index}-${name}`, name, fallback: true }));

export default function Register() {
  const [params] = useSearchParams();
  const role = params.get('role') || 'patient';
  const config = roleConfig[role] || roleConfig.patient;
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [signupMethod, setSignupMethod] = useState('phone');

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [firebaseToken, setFirebaseToken] = useState(null);
  const firebaseEnabled = isFirebaseConfigured();
  const [departments, setDepartments] = useState([]);
  const [specializations, setSpecializations] = useState([]);
  const [educations, setEducations] = useState([]);
  const [form, setForm] = useState({
    phone: '', otp: '', name: '', email: '', password: '', confirmPassword: '',
    primary_specialization_id: '', additional_specialization_ids: [], education_ids: [], specialization: '', qualification: '', medical_license_number: '', experience_years: '',
    lab_name: '', registration_number: '', address: '', city: '', state: '', country: '', countryCode: '', stateCode: '', pincode: '', lab_phone: '',
    pharmacy_name: '', license_number: '', gstin: '', pharmacy_phone: '',
    date_of_birth: '', gender: '', blood_group: '', allergies: '',
    department_ids: [],
  });

  const specializationOptions = useMemo(
    () => (specializations.length ? specializations : buildFallbackOptions(doctorSpecializations)),
    [specializations]
  );
  const educationOptions = useMemo(
    () => (educations.length ? educations : buildFallbackOptions(doctorEducations)),
    [educations]
  );
  const selectedEducationLabels = useMemo(() => {
    if (form.education_ids.length) {
      return educationOptions
        .filter((item) => form.education_ids.some((id) => String(id) === String(item.id)))
        .map((item) => item.name);
    }
    return form.qualification
      ? form.qualification.split(',').map((item) => item.trim()).filter(Boolean)
      : [];
  }, [educationOptions, form.education_ids, form.qualification]);
  const qualificationSummary = selectedEducationLabels.length ? selectedEducationLabels.join(', ') : form.qualification;

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  useEffect(() => {
    const prefillPhone = params.get('phone');
    if (prefillPhone && !form.phone) {
      setForm((prev) => ({ ...prev, phone: prefillPhone }));
    }
  }, [params, form.phone]);

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

  const handleSendOtp = async () => {
    if (!form.phone) return toast.error('Enter phone number');
    setLoading(true);
    try {
      if (firebaseEnabled) {
        const confirmation = await sendFirebaseOtp(form.phone, 'recaptcha-container');
        setConfirmationResult(confirmation);
      } else {
        await authAPI.sendOtp(form.phone, 'registration');
      }
      toast.success('OTP sent!');
      setStep(2);
    } catch (err) {
      toast.error(err?.message || err?.code || 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    if (!form.otp) return toast.error('Enter OTP');
    setLoading(true);
    try {
      if (firebaseEnabled && confirmationResult) {
        const { token } = await confirmFirebaseOtp(confirmationResult, form.otp);
        setFirebaseToken(token);
      } else {
        await authAPI.verifyOtp(form.phone, form.otp);
      }
      toast.success('Phone verified!');
      setStep(3);
    } catch (err) {
      toast.error(err?.message || err?.code || 'OTP verification failed');
    } finally { setLoading(false); }
  };

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

  const handleRegister = async () => {
    if (!form.phone) return toast.error('Phone number required');
    if (signupMethod === 'email' && !form.email) return toast.error('Email required');
    if (form.password !== form.confirmPassword) return toast.error('Passwords do not match');
    if (role === 'doctor' && ((!form.primary_specialization_id && !form.specialization) || (!form.education_ids.length && !form.qualification) || !form.medical_license_number)) {
      return toast.error('Please complete doctor specialization, education, and license details');
    }
    if (role === 'laboratory' && (!form.lab_name || !form.registration_number || !form.address || !form.country || !form.city || !form.state || !form.pincode)) {
      return toast.error('Please fill all required laboratory details');
    }
    if (role === 'pharmacist' && (!form.pharmacy_name || !form.license_number)) {
      return toast.error('Please fill all required pharmacy details');
    }
    setLoading(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        role,
      };
      if (form.department_ids.length) payload.department_ids = form.department_ids;
      if (signupMethod === 'phone' && firebaseToken) payload.firebase_id_token = firebaseToken;

      if (role === 'doctor') {
        const selectedPrimary = specializationOptions.find((item) => String(item.id) === String(form.primary_specialization_id));
        const selectedEducationNames = educationOptions
          .filter((item) => form.education_ids.some((id) => String(id) === String(item.id)))
          .map((item) => item.name);
        Object.assign(payload, {
          primary_specialization_id: form.primary_specialization_id || undefined,
          additional_specialization_ids: form.additional_specialization_ids.filter((item) => typeof item === 'number'),
          education_ids: form.education_ids.filter((item) => typeof item === 'number'),
          specialization: selectedPrimary?.name || form.specialization,
          qualification: selectedEducationNames.length ? selectedEducationNames.join(', ') : form.qualification,
          medical_license_number: form.medical_license_number,
          experience_years: form.experience_years,
        });
      }

      if (role === 'laboratory') {
        Object.assign(payload, {
          lab_name: form.lab_name,
          registration_number: form.registration_number,
          address: form.address,
          country: form.country,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          lab_phone: form.lab_phone || form.phone,
        });
      }

      if (role === 'pharmacist') {
        Object.assign(payload, {
          pharmacy_name: form.pharmacy_name,
          license_number: form.license_number,
          gstin: form.gstin,
          pharmacy_phone: form.pharmacy_phone || form.phone,
        });
      }

      if (role === 'patient') {
        Object.assign(payload, {
          date_of_birth: form.date_of_birth,
          gender: form.gender,
          blood_group: form.blood_group,
          allergies: form.allergies,
        });
      }

      const { data } = await authAPI.register(payload);
      login(data.user, data.tokens);
      toast.success('Registration successful!');
      const routes = { doctor: '/doctor', patient: '/patient', laboratory: '/lab', pharmacist: '/pharmacist' };
      navigate(routes[role] || '/dashboard');
    } catch {
    } finally { setLoading(false); }
  };

  const inp = (label, key, type = 'text', required = false, placeholder = '') => (
    <div className="form-group">
      <label className="form-label">{label}{required && <span className="required">*</span>}</label>
      <input className="form-input" type={type} placeholder={placeholder || label} value={form[key]} onChange={(e) => set(key, e.target.value)} required={required} />
    </div>
  );

  const sel = (label, key, options, required = false) => (
    <div className="form-group">
      <label className="form-label">{label}{required && <span className="required">*</span>}</label>
      <select className="form-select" value={form[key]} onChange={(e) => set(key, e.target.value)} required={required}>
        <option value="">Select {label}</option>
        {options.map((o) => <option key={o.v || o} value={o.v || o}>{o.l || o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-left-content">
          <div className="auth-logo">Medi<span>Care</span> Pro</div>
          <p className="auth-tagline">Join thousands of healthcare professionals</p>
          {config.note && (
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, marginTop: 24, fontSize: 13, lineHeight: 1.6, opacity: 0.85 }}>
              Note: {config.note}
            </div>
          )}
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-form-container">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <select className="form-select" style={{ maxWidth: 110 }} value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="en">EN</option>
              <option value="hi">HI</option>
            </select>
          </div>
          <h2>{t('common.registerAs')} {config.label}</h2>
          <p style={{ marginBottom: 0 }}>Create your MediCare Pro account</p>

          {(() => {
            const steps = signupMethod === 'email'
              ? ['Email', 'Basic Info', config.steps[2] || 'Details']
              : config.steps;
            return (
              <div className="steps" style={{ margin: '24px 0' }}>
                {steps.map((s, i) => (
                  <React.Fragment key={i}>
                    <div className={`step ${step > i + 1 ? 'done' : ''} ${step === i + 1 ? 'active' : ''}`}>
                      <div className="step-circle">{step > i + 1 ? 'OK' : i + 1}</div>
                    </div>
                    {i < steps.length - 1 && <div className={`step-line ${step > i + 1 ? 'done' : ''}`} />}
                  </React.Fragment>
                ))}
              </div>
            );
          })()}
          <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 24 }}>
            {(signupMethod === 'email' ? ['Email', 'Basic Info', config.steps[2] || 'Details'] : config.steps)[step - 1]}
          </div>

          {step === 1 && (
            <div>
              <div className="form-group">
                <label className="form-label">Register With</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className={`btn ${signupMethod === 'phone' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setSignupMethod('phone')}>
                    Phone
                  </button>
                  <button type="button" className={`btn ${signupMethod === 'email' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setSignupMethod('email')}>
                    Email
                  </button>
                </div>
              </div>
              {signupMethod === 'phone' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">{t('common.phone')} <span className="required">*</span></label>
                    <PhoneInput value={form.phone} onChange={(val) => set('phone', val)} required />
                    <p className="form-hint">We'll send an OTP to verify your number</p>
                  </div>
                  <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSendOtp} disabled={loading}>
                    {loading ? 'Sending...' : t('common.sendOtp')} <ArrowRight size={15} />
                  </button>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Email Address <span className="required">*</span></label>
                    <div className="input-group">
                      <Mail size={16} className="input-group-icon" />
                      <input className="form-input" type="email" placeholder="name@example.com" value={form.email} onChange={(e) => set('email', e.target.value)} />
                    </div>
                  </div>
                  <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => form.email ? setStep(3) : toast.error('Email required')}>
                    Continue <ArrowRight size={15} />
                  </button>
                </>
              )}
            </div>
          )}

          {step === 2 && signupMethod === 'phone' && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 20, padding: 16, background: 'var(--primary-light)', borderRadius: 'var(--radius-md)' }}>
                <p style={{ fontSize: 13 }}>OTP sent to <strong>{form.phone}</strong></p>
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.otp')} <span className="required">*</span></label>
                <input className="form-input" type="text" placeholder="6-digit OTP" value={form.otp} onChange={(e) => set('otp', e.target.value)} maxLength={6} style={{ textAlign: 'center', fontSize: 22, letterSpacing: 8, fontWeight: 700 }} />
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleVerifyOtp} disabled={loading}>
                {loading ? 'Verifying...' : t('common.verifyOtp')} <ArrowRight size={15} />
              </button>
              <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => setStep(1)}>
                <ArrowLeft size={14} /> {t('common.changeNumber')}
              </button>
            </div>
          )}

          {step === 3 && (
            <div>
              {inp('Full Name', 'name', 'text', true)}
              {inp('Email Address', 'email', 'email', signupMethod === 'email')}
              {signupMethod === 'email' && (
                <div className="form-group">
                  <label className="form-label">Phone Number <span className="required">*</span></label>
                  <PhoneInput value={form.phone} onChange={(val) => set('phone', val)} required />
                </div>
              )}
              <div className="form-grid">
                {inp('Password', 'password', 'password', true)}
                {inp('Confirm Password', 'confirmPassword', 'password', true)}
              </div>

              {role === 'doctor' && (
                <>
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
                    />
                  </div>

                  <div className="form-group">
                    <MultiSelectDropdown
                      label="Education"
                      required
                      options={educationOptions}
                      value={form.education_ids}
                      onChange={(next) => setMultiValue('education_ids', next)}
                      placeholder="Select education"
                    />
                  </div>

                  {inp('Medical License Number', 'medical_license_number', 'text', true)}
                  {inp('Experience (Years)', 'experience_years', 'number', false)}
                  <div className="form-group">
                    <MultiSelectDropdown
                      label="Departments"
                      options={departments}
                      value={form.department_ids}
                      onChange={(next) => setMultiValue('department_ids', next)}
                      placeholder="Select departments"
                    />
                  </div>
                  <div className="form-hint" style={{ marginTop: -4, marginBottom: 8 }}>
                    After registration, upload your license, specialization, and education certificates from the doctor profile page before requesting verification. Consultation fees are set later clinic-wise from the Consultation Fees page.
                  </div>
                </>
              )}

              {role === 'laboratory' && (
                <>
                  {inp('Laboratory Name', 'lab_name', 'text', true)}
                  {inp('Registration Number', 'registration_number', 'text', true)}
                  {inp('Address', 'address', 'text', true)}
                  <LocationSelect
                    required
                    value={{
                      country: form.country,
                      countryCode: form.countryCode,
                      state: form.state,
                      stateCode: form.stateCode,
                      city: form.city,
                    }}
                    onChange={(loc) => setForm((prev) => ({
                      ...prev,
                      country: loc.country,
                      countryCode: loc.countryCode,
                      state: loc.state,
                      stateCode: loc.stateCode,
                      city: loc.city,
                    }))}
                  />
                  <div className="form-grid">
                    {inp('Pincode', 'pincode', 'text', true)}
                    <div>
                      <label className="form-label">Lab Phone <span className="required">*</span></label>
                      <PhoneInput value={form.lab_phone} onChange={(val) => set('lab_phone', val)} required />
                    </div>
                  </div>
                </>
              )}

              {role === 'pharmacist' && (
                <>
                  {inp('Pharmacy Name', 'pharmacy_name', 'text', true)}
                  {inp('Drug License Number', 'license_number', 'text', true)}
                  <div className="form-grid">
                    {inp('GSTIN (Optional)', 'gstin', 'text', false)}
                    <div>
                      <label className="form-label">Pharmacy Phone <span className="required">*</span></label>
                      <PhoneInput value={form.pharmacy_phone} onChange={(val) => set('pharmacy_phone', val)} required />
                    </div>
                  </div>
                </>
              )}

              {role === 'patient' && (
                <>
                  <div className="form-grid">
                    {inp('Date of Birth', 'date_of_birth', 'date', false)}
                    {sel('Gender', 'gender', ['male', 'female', 'other'])}
                  </div>
                  {sel('Blood Group', 'blood_group', ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])}
                </>
              )}

              <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={handleRegister} disabled={loading}>
                {loading ? 'Creating Account...' : t('common.createAccount')} <ArrowRight size={15} />
              </button>
              <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => setStep(signupMethod === 'phone' ? 2 : 1)}>
                <ArrowLeft size={14} /> Back
              </button>
            </div>
          )}

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
            Already registered? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Login here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
