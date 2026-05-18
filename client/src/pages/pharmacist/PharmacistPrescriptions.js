import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { prescriptionAPI } from '../../utils/api';

export default function PharmacistPrescriptions() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    prescriptionAPI.getAll()
      .then(({ data }) => setPrescriptions(data.prescriptions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const markDispensed = async (id) => {
    try {
      await prescriptionAPI.markDispensed(id);
      toast.success('Marked as dispensed');
      load();
    } catch {
      toast.error('Failed to update');
    }
  };

  return (
    <div className="card">
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
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {prescriptions.map((p) => (
                  <tr key={p.id}>
                    <td>{String(p.created_at).slice(0, 10)}</td>
                    <td>{p.patient_name}</td>
                    <td>{p.doctor_name}</td>
                    <td><span className={`badge ${p.is_dispensed ? 'badge-success' : 'badge-warning'}`}>{p.is_dispensed ? 'Dispensed' : 'Pending'}</span></td>
                    <td>
                      {!p.is_dispensed && (
                        <button className="btn btn-outline btn-sm" onClick={() => markDispensed(p.id)}>Mark Dispensed</button>
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
  );
}
