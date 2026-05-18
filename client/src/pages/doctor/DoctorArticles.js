import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { blogAPI } from '../../utils/api';

const statusBadge = (status) => {
  if (status === 'approved') return 'badge-success';
  if (status === 'rejected') return 'badge-danger';
  if (status === 'pending') return 'badge-warning';
  return 'badge-gray';
};

export default function DoctorArticles() {
  const [form, setForm] = useState({ title: '', category: '', summary: '', content: '', cover_image: '' });
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    blogAPI.listMine()
      .then(({ data }) => setPosts(data.posts || []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.title || !form.content) return toast.error('Title and content are required');
    try {
      await blogAPI.create(form);
      toast.success('Article submitted for review');
      setForm({ title: '', category: '', summary: '', content: '', cover_image: '' });
      load();
    } catch {
      toast.error('Failed to submit article');
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Create Article</div>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label className="form-label">Title<span className="required">*</span></label>
            <input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Category</label>
              <input className="form-input" placeholder="Cardiology, Pediatrics..." value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Cover Image URL</label>
              <input className="form-input" placeholder="https://..." value={form.cover_image} onChange={(e) => setForm({ ...form, cover_image: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Summary</label>
            <textarea className="form-textarea" rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Content<span className="required">*</span></label>
            <textarea className="form-textarea" rows={8} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </div>
          <button className="btn btn-primary" onClick={submit}>Submit for Review</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">My Articles</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : posts.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No articles yet.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((p) => (
                    <tr key={p.id}>
                      <td>{p.title}</td>
                      <td>{p.category || '-'}</td>
                      <td><span className={`badge ${statusBadge(p.status)}`}>{p.status}</span></td>
                      <td>{String(p.created_at).slice(0, 10)}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.admin_remarks || '-'}</td>
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
