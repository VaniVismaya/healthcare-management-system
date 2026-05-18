import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

const roleDetails = {
  doctor: { label: 'Doctor', profilePath: '/doctor/profile' },
  laboratory: { label: 'Laboratory', profilePath: '/lab/profile' },
  pharmacist: { label: 'Pharmacist', profilePath: '/pharmacist/profile' },
};

export default function PendingVerification({ role }) {
  const navigate = useNavigate();
  const details = roleDetails[role] || { label: 'Account', profilePath: '/' };

  return (
    <div className="card" style={{ maxWidth: 720, margin: '40px auto' }}>
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={18} color="#92400E" />
          </div>
          <div>
            <div className="card-title">Verification Pending</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{details.label} access will be enabled after admin approval.</div>
          </div>
        </div>
      </div>
      <div className="card-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <ShieldCheck size={16} color="var(--primary)" />
          <div style={{ fontWeight: 600 }}>Next steps</div>
        </div>
        <ul style={{ paddingLeft: 18, marginBottom: 16, color: 'var(--text-secondary)', fontSize: 13 }}>
          <li>Complete your profile and upload the required certificate.</li>
          <li>Wait for admin verification (you will receive a notification).</li>
          <li>Once verified, your dashboard and features will be unlocked.</li>
        </ul>
        <button className="btn btn-primary" onClick={() => navigate(details.profilePath)}>
          Go to Profile Setup
        </button>
      </div>
    </div>
  );
}
