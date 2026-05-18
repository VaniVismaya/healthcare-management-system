import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { clinicAPI, doctorAPI } from '../../utils/api';
import PhoneInput from '../../components/common/PhoneInput';
import { doctorSpecializations } from '../../utils/specializations';

export default function GuestDoctors() {
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guests, setGuests] = useState([]);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    specialization: '',
    qualification: '',
    clinic_id: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [clinicsRes, guestsRes] = await Promise.all([
        clinicAPI.getMyClinics(),
        doctorAPI.getGuestDoctors(),
      ]);
      setClinics(clinicsRes.data.clinics || []);
      setGuests(guestsRes.data.guests || []);
    } catch {
      setClinics([]);
      setGuests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const addGuestDoctor = async () => {
    if (!form.name || !form.phone || !form.specialization || !form.qualification || !form.clinic_id) {
      return toast.error('Please fill required fields');
    }
    try {
      await doctorAPI.addGuestDoctor(form);
      toast.success('Guest doctor added');
      setForm({ name: '', phone: '', email: '', specialization: '', qualification: '', clinic_id: '' });
      load();
    } catch {
      toast.error('Failed to add guest doctor');
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Add Guest Doctor</div>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Name<span className="required">*</span></label>
              <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone<span className="required">*</span></label>
              <PhoneInput value={form.phone} onChange={(val) => setForm({ ...form, phone: val })} required />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Clinic<span className="required">*</span></label>
              <select className="form-select" value={form.clinic_id} onChange={(e) => setForm({ ...form, clinic_id: e.target.value })}>
                <option value="">Select Clinic</option>
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Specialization<span className="required">*</span></label>
              <select className="form-select" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })}>
                <option value="">Select Specialization</option>
                {doctorSpecializations.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Qualification<span className="required">*</span></label>
              <input className="form-input" value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={addGuestDoctor}>Add Guest Doctor</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Guest Doctors</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : guests.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No guest doctors yet.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Clinic</th>
                    <th>Specialization</th>
                  </tr>
                </thead>
                <tbody>
                  {guests.map((g) => (
                    <tr key={g.id}>
                      <td>{g.name}</td>
                      <td>{g.phone || '-'}</td>
                      <td>{g.clinic_name || '-'}</td>
                      <td>{g.specialization || '-'}</td>
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
