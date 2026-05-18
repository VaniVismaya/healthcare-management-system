import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminAPI } from '../../utils/api';

export default function AdminMessages() {
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    adminAPI.getMessages()
      .then(({ data }) => setMessages(data.messages || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const sendReply = async () => {
    if (!selected) return;
    try {
      await adminAPI.replyMessage(selected.id, reply);
      toast.success('Reply sent');
      setReply('');
      setSelected(null);
      load();
    } catch {
      toast.error('Failed to send reply');
    }
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Contact Messages</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : messages.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No messages.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Received</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{m.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.email || m.phone}</div>
                      </td>
                      <td>{m.subject || '-'}</td>
                      <td><span className={`badge ${m.status === 'resolved' ? 'badge-success' : 'badge-warning'}`}>{m.status}</span></td>
                      <td>{String(m.created_at).slice(0, 10)}</td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={() => { setSelected(m); setReply(m.admin_reply || ''); }}>
                          View
                        </button>
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
          <div className="modal">
            <div className="modal-header">
              <h2>Message</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700 }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selected.email || selected.phone}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Subject</div>
                <div style={{ fontSize: 13 }}>{selected.subject || '-'}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Message</div>
                <div style={{ fontSize: 13 }}>{selected.message}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Reply</label>
                <textarea className="form-textarea" value={reply} onChange={(e) => setReply(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setSelected(null)}>Close</button>
              <button className="btn btn-primary" onClick={sendReply}>Send Reply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
