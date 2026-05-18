import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doctorAPI } from '../../utils/api';

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = ((hour + 11) % 12) + 1;
  return `${displayHour}:${m} ${suffix}`;
};

export default function PatientDetails() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    setLoading(true);
    doctorAPI.getPatientDetails(id)
      .then(({ data }) => setData(data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="card"><div className="card-body" style={{ color: 'var(--text-muted)' }}>Loading...</div></div>;
  }

  if (!data?.patient) {
    return <div className="card"><div className="card-body" style={{ color: 'var(--text-muted)' }}>Patient not found.</div></div>;
  }

  const { patient, appointments = [], prescriptions = [], labOrders = [], vitals = [] } = data;

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Patient Details</div>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div className="avatar" style={{ width: 56, height: 56, fontSize: 18 }}>
              {patient.profile_image ? <img src={patient.profile_image} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} /> : (patient.name || 'P').slice(0, 1)}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{patient.name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{patient.phone || 'No phone'} {patient.email ? `- ${patient.email}` : ''}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                {patient.gender || 'Unknown'} {patient.blood_group ? `- ${patient.blood_group}` : ''}
              </div>
            </div>
          </div>
          {(patient.allergies || patient.chronic_conditions) && (
            <div style={{ marginTop: 12, fontSize: 13 }}>
              {patient.allergies && <div><strong>Allergies:</strong> {patient.allergies}</div>}
              {patient.chronic_conditions && <div><strong>Chronic:</strong> {patient.chronic_conditions}</div>}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Vitals</div>
        </div>
        <div className="card-body">
          {vitals.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No vitals recorded.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Clinic</th>
                    <th>BP</th>
                    <th>Pulse</th>
                    <th>Temp</th>
                    <th>Weight</th>
                    <th>SpO2</th>
                  </tr>
                </thead>
                <tbody>
                  {vitals.map((v) => (
                    <tr key={v.id}>
                      <td>{v.appointment_date || '-'}</td>
                      <td>{formatTime(v.appointment_time)}</td>
                      <td>{v.clinic_name || '-'}</td>
                      <td>{v.blood_pressure || '-'}</td>
                      <td>{v.pulse_rate || '-'}</td>
                      <td>{v.temperature || '-'}</td>
                      <td>{v.weight || '-'}</td>
                      <td>{v.oxygen_saturation || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Recent Appointments</div>
        </div>
        <div className="card-body">
          {appointments.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No appointments found.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Clinic</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((a) => (
                    <tr key={a.id}>
                      <td>{a.appointment_date}</td>
                      <td>{formatTime(a.appointment_time)}</td>
                      <td>{a.clinic_name}</td>
                      <td><span className="badge badge-primary">{a.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Prescriptions</div>
        </div>
        <div className="card-body">
          {prescriptions.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No prescriptions found.</div>
          ) : (
            prescriptions.map((p) => (
              <div key={p.id} style={{ border: '1px solid var(--border-light)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                <div style={{ fontWeight: 700 }}>{p.diagnosis || 'Prescription'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{String(p.created_at).slice(0, 10)}</div>
                {p.medicines && (
                  <div style={{ marginTop: 8, fontSize: 13 }}>
                    <strong>Medicines:</strong> {p.medicines}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Lab Orders</div>
        </div>
        <div className="card-body">
          {labOrders.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No lab orders found.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {labOrders.map((o) => (
                    <tr key={o.id}>
                      <td><span className="badge badge-primary">{o.status}</span></td>
                      <td>{o.total_amount ? `INR ${o.total_amount}` : '-'}</td>
                      <td>{String(o.created_at).slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
