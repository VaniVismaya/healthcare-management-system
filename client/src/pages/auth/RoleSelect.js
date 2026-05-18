import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { Stethoscope, FlaskConical, User, Pill, Shield } from 'lucide-react';

export default function RoleSelect() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { lang, setLang, t } = useI18n();

  const roles = [
    { id: 'patient', icon: User, label: 'Register as Patient', desc: t('roleSelect.patientDesc'), color: '#0A7EA4', bg: '#E8F4F8' },
    { id: 'doctor', icon: Stethoscope, label: 'Register as Doctor', desc: t('roleSelect.doctorDesc'), color: '#00B894', bg: '#E8F8F4' },
    { id: 'laboratory', icon: FlaskConical, label: 'Register as Laboratory', desc: t('roleSelect.labDesc'), color: '#7C3AED', bg: '#F3EDFE' },
    { id: 'pharmacist', icon: Pill, label: 'Register as Pharmacist', desc: t('roleSelect.pharmacistDesc'), color: '#F59E0B', bg: '#FEF7E8' },
  ];

  const routes = { admin: '/admin', doctor: '/doctor', patient: '/patient', laboratory: '/lab', pharmacist: '/pharmacist', receptionist: '/receptionist' };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0D2137 0%, #0A7EA4 60%, #00B894 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 600 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: '#fff', fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: -1 }}>
            Medi<span style={{ color: '#00B894' }}>Care</span> Pro
          </div>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, marginTop: 8 }}>Your Complete Healthcare Platform</p>
        </div>

        {/* Role cards */}
        <div style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', borderRadius: 24, padding: 32, border: '1px solid rgba(255,255,255,0.15)' }}>
          {user && (
            <div style={{ background: 'rgba(255,255,255,0.85)', borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#0D2137', fontWeight: 600 }}>
                You are already signed in. Continue to your dashboard or open a new registration type below.
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => navigate(routes[user.role] || '/dashboard')}>Go to Dashboard</button>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <select className="form-select" style={{ maxWidth: 110, background: 'rgba(255,255,255,0.9)' }} value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="en">EN</option>
              <option value="hi">HI</option>
            </select>
          </div>
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Choose Your Registration Type
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, textAlign: 'center', marginBottom: 28 }}>
            Login is common for everyone. Pick the kind of account you want to create.
          </p>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <Link to="/" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, textDecoration: 'none' }}>
              Back to Home
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {roles.map(role => (
              <div
                key={role.id}
                onClick={() => navigate(`/register?role=${role.id}`)}
                style={{
                  background: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: '20px 16px',
                  cursor: 'pointer', transition: 'all 0.2s ease', textAlign: 'center',
                  border: '2px solid transparent'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
              >
                <div style={{ width: 52, height: 52, borderRadius: 14, background: role.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <role.icon size={24} color={role.color} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0D2137', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{role.label}</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{role.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <button
              onClick={() => navigate('/login')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.75)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              <Shield size={14} /> Universal Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
