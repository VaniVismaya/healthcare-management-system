import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { receptionistAPI } from '../../utils/api';

export default function ReceptionistHandover() {
  const [notes, setNotes] = useState([]);
  const [form, setForm] = useState({ shift_date: '', shift_type: 'morning', notes: '' });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await receptionistAPI.getHandover();
      setNotes(data.notes || []);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.notes) return toast.error('Enter notes');
    try {
      await receptionistAPI.createHandover(form);
      toast.success('Handover saved');
      setForm({ shift_date: '', shift_type: 'morning', notes: '' });
      load();
    } catch {
      toast.error('Failed to save');
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Shift Handover Notes</div>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Shift Date</label>
              <input className="form-input" type="date" value={form.shift_date} onChange={(e) => setForm({ ...form, shift_date: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Shift Type</label>
              <select className="form-select" value={form.shift_type} onChange={(e) => setForm({ ...form, shift_type: e.target.value })}>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
                <option value="night">Night</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button className="btn btn-primary" onClick={save}>Save Note</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Recent Notes</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : notes.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No notes yet.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Shift</th>
                    <th>Notes</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {notes.map((n) => (
                    <tr key={n.id}>
                      <td>{n.shift_date}</td>
                      <td>{n.shift_type}</td>
                      <td>{n.notes}</td>
                      <td>{n.created_by_name || '-'}</td>
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
