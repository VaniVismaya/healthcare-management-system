import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminAPI } from '../../utils/api';

const roleOptions = [
  { value: 'all', label: 'All Users' },
  { value: 'patient', label: 'Patients' },
  { value: 'doctor', label: 'Doctors' },
  { value: 'laboratory', label: 'Laboratories' },
  { value: 'pharmacist', label: 'Pharmacists' },
  { value: 'receptionist', label: 'Receptionists' },
];

const platformOptions = [
  { value: 'all', label: 'Web + Mobile' },
  { value: 'web', label: 'Web Only' },
  { value: 'mobile', label: 'Mobile Only' },
];

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [form, setForm] = useState({ title: '', message: '', target_role: 'all', target_platform: 'all', is_active: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getAnnouncements();
      setAnnouncements(data.announcements || []);
    } catch {
      setAnnouncements([]);
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createAnnouncement = async () => {
    if (!form.title || !form.message) return toast.error('Title and message are required');
    setSaving(true);
    try {
      await adminAPI.createAnnouncement(form);
      toast.success('Announcement created');
      setForm({ title: '', message: '', target_role: 'all', target_platform: 'all', is_active: true });
      load();
    } catch {
      toast.error('Failed to create announcement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Create Announcement</div>
            <div className="form-hint" style={{ marginTop: 4 }}>
              You can now choose whether an announcement should appear on web, mobile, or both.
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Title<span className="required">*</span></label>
              <input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Target Role</label>
              <select className="form-select" value={form.target_role} onChange={(e) => setForm({ ...form, target_role: e.target.value })}>
                {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Target Platform</label>
              <select className="form-select" value={form.target_platform} onChange={(e) => setForm({ ...form, target_platform: e.target.value })}>
                {platformOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Message<span className="required">*</span></label>
            <textarea className="form-textarea" rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            <span style={{ fontSize: 13 }}>Active (send now)</span>
          </div>
          <button className="btn btn-primary" onClick={createAnnouncement} disabled={saving}>
            {saving ? 'Sending...' : 'Send Announcement'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Announcement History</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : announcements.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No announcements yet.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Audience</th>
                    <th>Platform</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {announcements.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{a.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.message}</div>
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>{a.target_role || 'all'}</td>
                      <td>
                        <span className="badge badge-primary">{a.target_platform || 'all'}</span>
                      </td>
                      <td>
                        <span className={`badge ${a.is_active ? 'badge-success' : 'badge-secondary'}`}>
                          {a.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>{String(a.created_at).slice(0, 10)}</td>
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
