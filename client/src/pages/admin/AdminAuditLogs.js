import React, { useEffect, useMemo, useState } from 'react';
import { adminAPI } from '../../utils/api';

const formatDate = (date) => {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const parseJsonLike = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export default function AdminAuditLogs() {
  const today = formatDate(new Date());
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({
    action: '',
    resource_type: '',
    user_id: '',
    date_from: '',
    date_to: today,
  });
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

  const load = () => {
    setLoading(true);
    adminAPI.getAuditLogs(filters)
      .then(({ data }) => setLogs(data.logs || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.action, filters.resource_type, filters.user_id, filters.date_from, filters.date_to]);

  const selectedDetails = useMemo(() => {
    if (!selectedLog) return { oldValues: null, newValues: null };
    return {
      oldValues: parseJsonLike(selectedLog.old_values),
      newValues: parseJsonLike(selectedLog.new_values),
    };
  }, [selectedLog]);

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="card-title">Audit Trail</div>
          <div className="form-hint" style={{ marginTop: 4 }}>
            Review admin-side system actions with timestamps, actor details, and before/after values.
          </div>
        </div>
        <button className="btn btn-outline" onClick={load} disabled={loading}>Refresh</button>
      </div>
      <div className="card-body">
        <div className="form-grid" style={{ marginBottom: 14 }}>
          <div className="form-group">
            <label className="form-label">Action</label>
            <input className="form-input" placeholder="create_plan, verify_user..." value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Resource Type</label>
            <input className="form-input" placeholder="user, clinic, blog_post..." value={filters.resource_type} onChange={(e) => setFilters({ ...filters, resource_type: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">User ID</label>
            <input className="form-input" placeholder="Filter by actor id" value={filters.user_id} onChange={(e) => setFilters({ ...filters, user_id: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">From</label>
            <input className="form-input" type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">To</label>
            <input className="form-input" type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} />
          </div>
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
        ) : logs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>No logs found.</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>IP</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString()}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{log.user_name || 'System'}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{log.user_role || 'system'}</div>
                    </td>
                    <td>{log.action}</td>
                    <td>{log.resource_type || '-'} #{log.resource_id || '-'}</td>
                    <td>{log.ip_address || '-'}</td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => setSelectedLog(log)}>
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

      {selectedLog && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2>Audit Details</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelectedLog(null)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-grid" style={{ marginBottom: 16 }}>
                <div><strong>Action:</strong> {selectedLog.action}</div>
                <div><strong>Resource:</strong> {selectedLog.resource_type || '-'} #{selectedLog.resource_id || '-'}</div>
                <div><strong>User:</strong> {selectedLog.user_name || 'System'}</div>
                <div><strong>Time:</strong> {new Date(selectedLog.created_at).toLocaleString()}</div>
                <div><strong>IP:</strong> {selectedLog.ip_address || '-'}</div>
                <div><strong>Role:</strong> {selectedLog.user_role || 'system'}</div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Before</label>
                  <pre className="form-textarea" style={{ minHeight: 220, whiteSpace: 'pre-wrap', overflow: 'auto' }}>
                    {selectedDetails.oldValues ? JSON.stringify(selectedDetails.oldValues, null, 2) : 'No previous values captured.'}
                  </pre>
                </div>
                <div className="form-group">
                  <label className="form-label">After</label>
                  <pre className="form-textarea" style={{ minHeight: 220, whiteSpace: 'pre-wrap', overflow: 'auto' }}>
                    {selectedDetails.newValues ? JSON.stringify(selectedDetails.newValues, null, 2) : 'No new values captured.'}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
