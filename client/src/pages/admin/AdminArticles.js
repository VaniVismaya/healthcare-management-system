import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { blogAPI } from '../../utils/api';

const emptyForm = {
  title: '',
  summary: '',
  content: '',
  category: '',
  cover_image: '',
  status: 'approved',
  admin_remarks: '',
};

const statusOptions = ['pending', 'approved', 'rejected', 'draft'];

export default function AdminArticles() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (tab !== 'all') params.status = tab;
      if (search.trim()) params.search = search.trim();
      const { data } = await blogAPI.listAdmin(params);
      setPosts(data.posts || []);
    } catch {
      setPosts([]);
      toast.error('Failed to load articles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tab]);

  const pendingCount = useMemo(() => posts.filter((post) => post.status === 'pending').length, [posts]);

  const openReview = (post) => {
    setSelected(post);
    setRemarks(post.admin_remarks || '');
  };

  const closeReview = () => {
    setSelected(null);
    setRemarks('');
  };

  const updateStatus = async (status) => {
    if (!selected) return;
    try {
      await blogAPI.updateStatus(selected.id, { status, admin_remarks: remarks });
      toast.success(`Article ${status}`);
      closeReview();
      load();
    } catch {
      toast.error('Failed to update article status');
    }
  };

  const editPost = (post) => {
    setForm({
      id: post.id,
      title: post.title || '',
      summary: post.summary || '',
      content: post.content || '',
      category: post.category || '',
      cover_image: post.cover_image || '',
      status: post.status || 'approved',
      admin_remarks: post.admin_remarks || '',
    });
    setTab('create');
  };

  const resetForm = () => setForm(emptyForm);

  const savePost = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required');
      return;
    }
    setSaving(true);
    try {
      if (form.id) {
        await blogAPI.updateAdmin(form.id, form);
        toast.success('Article updated');
      } else {
        await blogAPI.createAdmin(form);
        toast.success('Article created');
      }
      resetForm();
      setTab('all');
      load();
    } catch {
      toast.error('Failed to save article');
    } finally {
      setSaving(false);
    }
  };

  const deletePost = async (post) => {
    if (!window.confirm(`Delete article "${post.title}"?`)) return;
    try {
      await blogAPI.deleteAdmin(post.id);
      toast.success('Article deleted');
      if (form.id === post.id) resetForm();
      load();
    } catch {
      toast.error('Failed to delete article');
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Article Management</div>
            <div className="form-hint" style={{ marginTop: 4 }}>
              Doctors still submit blogs for verification. Admin can now review, publish, create, edit, and delete articles here.
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="tabs" style={{ marginBottom: 14 }}>
            <button className={`tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
              Pending Review
            </button>
            <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
              All Articles
            </button>
            <button className={`tab ${tab === 'create' ? 'active' : ''}`} onClick={() => setTab('create')}>
              {form.id ? 'Edit Article' : 'Create New Article'}
            </button>
          </div>

          {tab !== 'create' && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
              <input
                className="form-input"
                style={{ maxWidth: 320 }}
                placeholder="Search title/category/author"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button className="btn btn-outline" onClick={load}>Search</button>
              <div className="badge badge-warning">Pending: {pendingCount}</div>
            </div>
          )}

          {tab === 'create' ? (
            <div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Title<span className="required">*</span></label>
                  <input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input className="form-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Cover Image URL</label>
                  <input className="form-input" value={form.cover_image} onChange={(e) => setForm({ ...form, cover_image: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Summary</label>
                <textarea className="form-textarea" rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Content<span className="required">*</span></label>
                <textarea className="form-textarea" rows={10} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Admin Remarks</label>
                <textarea className="form-textarea" rows={2} value={form.admin_remarks} onChange={(e) => setForm({ ...form, admin_remarks: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={savePost} disabled={saving}>{saving ? 'Saving...' : (form.id ? 'Update Article' : 'Publish Article')}</button>
                {form.id && <button className="btn btn-outline" onClick={resetForm}>Create Another</button>}
              </div>
            </div>
          ) : loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading articles...</div>
          ) : posts.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No articles found for this view.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Author</th>
                    <th>Status</th>
                    <th>Category</th>
                    <th>Published</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr key={post.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{post.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{post.summary || 'No summary'}</div>
                      </td>
                      <td>{post.author_name}</td>
                      <td><span className={`badge ${post.status === 'approved' ? 'badge-success' : post.status === 'pending' ? 'badge-warning' : 'badge-secondary'}`}>{post.status}</span></td>
                      <td>{post.category || '-'}</td>
                      <td>{post.published_at ? String(post.published_at).slice(0, 10) : '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openReview(post)}>View</button>
                          <button className="btn btn-outline btn-sm" onClick={() => editPost(post)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => deletePost(post)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2>Article Details</h2>
              <button className="btn btn-ghost btn-icon" onClick={closeReview}>X</button>
            </div>
            <div className="modal-body">
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{selected.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                {selected.author_name} - {selected.specialization || 'Contributor'}
              </div>
              {selected.summary && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>Summary</div>
                  <div style={{ fontSize: 13 }}>{selected.summary}</div>
                </div>
              )}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Content</div>
                <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{selected.content}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Admin Remarks</label>
                <textarea className="form-textarea" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => editPost(selected)}>Edit</button>
              <button className="btn btn-ghost" onClick={closeReview}>Close</button>
              <button className="btn btn-danger" onClick={() => updateStatus('rejected')}>Reject</button>
              <button className="btn btn-secondary" onClick={() => updateStatus('approved')}>Approve</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
