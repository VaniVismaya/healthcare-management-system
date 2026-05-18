import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../utils/api';
import { useI18n } from '../../context/I18nContext';
import { sendFirebaseOtp, confirmFirebaseOtp, isFirebaseConfigured } from '../../utils/firebase';
import toast from 'react-hot-toast';
import { Lock, ArrowRight, Stethoscope, FlaskConical, Pill, User, Shield } from 'lucide-react';
import PhoneInput from '../../components/common/PhoneInput';

export default function Login() {
  const { t, lang, setLang } = useI18n();
  const [params] = useSearchParams();
  const role = params.get('role') || '';
  const roleInfo = {
    patient: { label: t('roleSelect.patient'), icon: User, color: '#0A7EA4' },
    doctor: { label: t('roleSelect.doctor'), icon: Stethoscope, color: '#00B894' },
    laboratory: { label: t('roleSelect.laboratory'), icon: FlaskConical, color: '#7C3AED' },
    pharmacist: { label: t('roleSelect.pharmacist'), icon: Pill, color: '#F59E0B' },
    admin: { label: 'Admin', icon: Shield, color: '#EF4444' },
    receptionist: { label: 'Receptionist', icon: Shield, color: '#2563EB' },
  };
  const info = roleInfo[role] || { label: 'Any Role', icon: Shield, color: '#0A7EA4' };

  const [mode, setMode] = useState('password');
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const firebaseEnabled = isFirebaseConfigured();

  const { login } = useAuth();
  const navigate = useNavigate();
  const getErrorMsg = (err, fallback) => err?.response?.data?.error || err?.message || fallback;

  const routes = {
    admin: '/admin',
    doctor: '/doctor',
    patient: '/patient',
    laboratory: '/lab',
    pharmacist: '/pharmacist',
    receptionist: '/receptionist',
  };

  const registerOptions = [
    { to: '/register?role=patient', label: 'Register as Patient', sublabel: 'Book appointments and manage care', icon: User, tint: '#E8F4F8', color: '#0A7EA4' },
    { to: '/register?role=doctor', label: 'Register as Doctor', sublabel: 'Consult, prescribe, and manage clinics', icon: Stethoscope, tint: '#E8F8F4', color: '#00B894' },
    { to: '/register?role=laboratory', label: 'Register as Laboratory', sublabel: 'Receive lab orders and upload reports', icon: FlaskConical, tint: '#F3EDFE', color: '#7C3AED' },
    { to: '/register?role=pharmacist', label: 'Register as Pharmacist', sublabel: 'Manage stock and fulfill prescriptions', icon: Pill, tint: '#FEF7E8', color: '#F59E0B' },
  ];

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authAPI.login(phone, password, role || undefined);
      login(data.user, data.tokens);
      toast.success('Welcome back!');
      navigate(routes[data.user.role] || '/dashboard');
    } catch (err) {
      toast.error(getErrorMsg(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (firebaseEnabled) {
        const confirmation = await sendFirebaseOtp(phone, 'recaptcha-container');
        setConfirmationResult(confirmation);
      } else {
        await authAPI.sendOtp(phone, 'login');
      }
      setStep(2);
      toast.success('OTP sent to your phone');
    } catch (err) {
      toast.error(getErrorMsg(err, 'Failed to send OTP'));
    } finally {
      setLoading(false);
    }
  };

  const handleOtpLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (firebaseEnabled && confirmationResult) {
        const { token, phone: firebasePhone } = await confirmFirebaseOtp(confirmationResult, otp);
        const { data } = await authAPI.loginOtp(firebasePhone || phone, null, role || undefined, token);
        login(data.user, data.tokens);
        toast.success('Welcome back!');
        navigate(routes[data.user.role] || '/dashboard');
        return;
      }
      const { data } = await authAPI.loginOtp(phone, otp, role || undefined);
      login(data.user, data.tokens);
      toast.success('Welcome back!');
      navigate(routes[data.user.role] || '/dashboard');
    } catch (err) {
      toast.error(getErrorMsg(err, 'OTP verification failed'));
    } finally {
      setLoading(false);
    }
  };

  const Icon = info.icon;

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-left-content">
          <div className="auth-logo">Medi<span>Care</span> Pro</div>
          <p className="auth-tagline">Complete Healthcare Management</p>
          <div className="auth-features">
            {[
              'Book appointments instantly',
              'Access health records anytime',
              'Connect with top specialists',
              'Secure login for every role and staff account',
            ].map((f, i) => (
              <div key={i} className="auth-feature">
                <div className="auth-feature-icon">
                  <ArrowRight size={16} color="#fff" />
                </div>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-form-container">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={22} color={info.color} />
            </div>
            <div>
              <h2 style={{ marginBottom: 0 }}>{t('common.welcomeBack')}</h2>
              <p style={{ marginBottom: 0 }}>{role ? `${t('common.loginAs')} ${info.label}` : 'Login here'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <select className="form-select" style={{ maxWidth: 110 }} value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="en">EN</option>
              <option value="hi">HI</option>
            </select>
          </div>

          <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: 4, marginBottom: 16 }}>
            {['password', 'otp'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setStep(1);
                }}
                style={{
                  flex: 1,
                  padding: '8px',
                  border: 'none',
                  borderRadius: 6,
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: mode === m ? 'var(--surface)' : 'transparent',
                  color: mode === m ? 'var(--primary)' : 'var(--text-muted)',
                  boxShadow: mode === m ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {m === 'password' ? 'Password' : 'OTP'}
              </button>
            ))}
          </div>

          {!role && (
            <div style={{ marginBottom: 20, padding: 12, borderRadius: 12, background: 'var(--primary-light)', color: 'var(--text-secondary)', fontSize: 13 }}>
              Enter your registered phone number. 
            </div>
          )}

          {mode === 'password' ? (
            <form onSubmit={handlePasswordLogin}>
              <div className="form-group">
                <label className="form-label">{t('common.phone')}<span className="required">*</span></label>
                <PhoneInput value={phone} onChange={setPhone} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.password')}<span className="required">*</span></label>
                <div className="input-group">
                  <Lock size={16} className="input-group-icon" />
                  <input className="form-input" type="password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
                {loading ? 'Logging in...' : t('common.login')} {!loading && <ArrowRight size={15} />}
              </button>
            </form>
          ) : step === 1 ? (
            <form onSubmit={handleSendOtp}>
              <div className="form-group">
                <label className="form-label">{t('common.phone')}<span className="required">*</span></label>
                <PhoneInput value={phone} onChange={setPhone} required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Sending OTP...' : t('common.sendOtp')} {!loading && <ArrowRight size={15} />}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtpLogin}>
              <div style={{ textAlign: 'center', marginBottom: 20, padding: 16, background: 'var(--primary-light)', borderRadius: 'var(--radius-md)' }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>OTP sent to <strong>{phone}</strong></p>
                <button type="button" onClick={() => setStep(1)} style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}>{t('common.changeNumber')}</button>
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.otp')}<span className="required">*</span></label>
                <input className="form-input" type="text" placeholder="Enter 6-digit OTP" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} required style={{ textAlign: 'center', fontSize: 22, letterSpacing: 8, fontWeight: 700 }} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Verifying...' : `${t('common.verifyOtp')} & ${t('common.login')}`} {!loading && <ArrowRight size={15} />}
              </button>
            </form>
          )}

          <div style={{ marginTop: 22, padding: 18, borderRadius: 18, border: '1px solid var(--border-light)', background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FCFF 100%)' }}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Register here</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Choose the account you want to create. Login stays common for everyone.
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {registerOptions.map((option) => {
                const OptionIcon = option.icon;
                return (
                  <Link
                    key={option.to}
                    to={option.to}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                      padding: 12,
                      borderRadius: 14,
                      textDecoration: 'none',
                      background: option.tint,
                      border: '1px solid rgba(10, 126, 164, 0.08)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <OptionIcon size={17} color={option.color} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700 }}>{option.label}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.45 }}>{option.sublabel}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <Link to="/roles" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 12.5, textDecoration: 'none' }}>
                See all registration options
              </Link>
            </div>
          </div>

          <p style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            <Link to="/" style={{ color: 'var(--text-muted)' }}>&larr; Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
