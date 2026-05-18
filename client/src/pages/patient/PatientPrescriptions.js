import React, { useEffect, useState } from 'react';
import { prescriptionAPI } from '../../utils/api';

export default function PatientPrescriptions() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    prescriptionAPI.getAll()
      .then(({ data }) => setPrescriptions(data.prescriptions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const view = async (id) => {
    const { data } = await prescriptionAPI.getOne(id);
    setSelected(data.prescription);
    setMedicines(data.medicines || []);
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Prescriptions</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : prescriptions.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No prescriptions found.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Doctor</th>
                    <th>Diagnosis</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {prescriptions.map((p) => (
                    <tr key={p.id}>
                      <td>{String(p.created_at).slice(0, 10)}</td>
                      <td>{p.doctor_name}</td>
                      <td>{p.diagnosis}</td>
                      <td><button className="btn btn-outline btn-sm" onClick={() => view(p.id)}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Prescription Details</div>
          </div>
          <div className="card-body">
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700 }}>{selected.doctor_name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selected.appointment_date}</div>
              <div style={{ fontSize: 13 }}>Diagnosis: {selected.diagnosis}</div>
            </div>
            {medicines.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>No medicines.</div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Medicine</th>
                      <th>Dosage</th>
                      <th>Frequency</th>
                      <th>Days</th>
                      <th>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medicines.map((m) => (
                      <tr key={m.id}>
                        <td>{m.medicine_name}</td>
                        <td>{m.dosage}</td>
                        <td>{m.frequency}</td>
                        <td>{m.duration_days}</td>
                        <td>{m.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
