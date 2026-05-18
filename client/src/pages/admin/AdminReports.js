import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { adminAPI } from '../../utils/api';

const formatDate = (date) => {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getRangeByPreset = (preset) => {
  const today = new Date();
  const start = new Date(today);
  const end = new Date(today);

  if (preset === 'today') {
    return { from: formatDate(start), to: formatDate(end) };
  }

  if (preset === 'week') {
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    return { from: formatDate(start), to: formatDate(end) };
  }

  if (preset === 'month') {
    start.setDate(1);
    return { from: formatDate(start), to: formatDate(end) };
  }

  if (preset === 'year') {
    start.setMonth(0, 1);
    return { from: formatDate(start), to: formatDate(end) };
  }

  return { from: formatDate(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)), to: formatDate(today) };
};

const presetOptions = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

const metricCards = [
  { key: 'registrations_count', label: 'Registrations', color: '#0A7EA4' },
  { key: 'appointments_count', label: 'Appointments', color: '#0F9D58' },
  { key: 'lab_orders_count', label: 'Lab Orders', color: '#7C3AED' },
  { key: 'prescriptions_count', label: 'Prescriptions', color: '#F59E0B' },
  { key: 'active_announcements', label: 'Active Announcements', color: '#EF4444' },
  { key: 'pending_plan_requests', label: 'Pending Plan Requests', color: '#2563EB' },
];

const toCsvValue = (value) => {
  const safe = value === null || value === undefined ? '' : String(value);
  return `"${safe.replace(/"/g, '""')}"`;
};

const exportReportCsv = (data) => {
  const sections = [
    {
      title: 'Summary',
      rows: metricCards.map((card) => ({ Metric: card.label, Value: data.summary?.[card.key] ?? 0 })),
    },
    {
      title: 'Registrations Daily',
      rows: data.registrations_daily || [],
    },
    {
      title: 'Registrations By Role',
      rows: data.registrations_by_role || [],
    },
    {
      title: 'Appointments Daily',
      rows: data.appointments_daily || [],
    },
    {
      title: 'Appointments By Status',
      rows: data.appointments_by_status || [],
    },
    {
      title: 'Lab Orders Daily',
      rows: data.lab_orders_daily || [],
    },
    {
      title: 'Prescriptions Daily',
      rows: data.prescriptions_daily || [],
    },
    {
      title: 'Verification By Role',
      rows: data.verification_by_role || [],
    },
    {
      title: 'Top Clinics',
      rows: data.top_clinics || [],
    },
    {
      title: 'Top Doctors',
      rows: data.top_doctors || [],
    },
    {
      title: 'Plans By Role',
      rows: data.plans_by_role || [],
    },
    {
      title: 'Plan Requests By Status',
      rows: data.plan_requests_by_status || [],
    },
  ];

  const parts = [];
  sections.forEach((section) => {
    parts.push(section.title);
    if (!section.rows.length) {
      parts.push('No data available');
      parts.push('');
      return;
    }
    const headers = Object.keys(section.rows[0]);
    parts.push(headers.join(','));
    section.rows.forEach((row) => {
      parts.push(headers.map((header) => toCsvValue(row[header])).join(','));
    });
    parts.push('');
  });

  const blob = new Blob([`\uFEFF${parts.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `admin-reports-${data.date_from}-to-${data.date_to}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

function SummaryCard({ label, value, color }) {
  return (
    <div className="card" style={{ minWidth: 0 }}>
      <div className="card-body" style={{ padding: 18 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color }}>{value ?? 0}</div>
      </div>
    </div>
  );
}

function SimpleTable({ title, rows, columns, emptyLabel = 'No data found.' }) {
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="card-header">
        <div className="card-title">{title}</div>
      </div>
      <div className="card-body">
        {!rows.length ? (
          <div style={{ color: 'var(--text-muted)' }}>{emptyLabel}</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  {columns.map((column) => <th key={column.key}>{column.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${title}-${index}`}>
                    {columns.map((column) => (
                      <td key={column.key}>{column.render ? column.render(row[column.key], row) : (row[column.key] ?? '-')}</td>
                    ))}
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

function ActivityChart({ title, data, color }) {
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="card-header">
        <div className="card-title">{title}</div>
      </div>
      <div className="card-body">
        {!data.length ? (
          <div style={{ color: 'var(--text-muted)' }}>No data found for this range.</div>
        ) : (
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5eef4" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill={color} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminReports() {
  const [data, setData] = useState(null);
  const [preset, setPreset] = useState('month');
  const [range, setRange] = useState(getRangeByPreset('month'));
  const [loading, setLoading] = useState(true);

  const load = async (currentRange = range) => {
    setLoading(true);
    try {
      const response = await adminAPI.getReports({ date_from: currentRange.from, date_to: currentRange.to });
      setData(response.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  const rangeLabel = useMemo(() => {
    if (!data) return '';
    return `${data.date_from} to ${data.date_to}`;
  }, [data]);

  const applyPreset = (nextPreset) => {
    setPreset(nextPreset);
    if (nextPreset !== 'custom') {
      setRange(getRangeByPreset(nextPreset));
    }
  };

  const handleCustomDateChange = (field, value) => {
    setPreset('custom');
    setRange((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Insights & Reports</div>
            <div className="form-hint" style={{ marginTop: 4 }}>
              Switch between quick date presets or use a custom range, then export the current view in an Excel-friendly file.
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="tabs" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
            {presetOptions.map((option) => (
              <button
                key={option.value}
                className={`tab ${preset === option.value ? 'active' : ''}`}
                onClick={() => applyPreset(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {preset === 'custom' && (
              <>
                <input
                  className="form-input"
                  type="date"
                  value={range.from}
                  onChange={(e) => handleCustomDateChange('from', e.target.value)}
                  style={{ maxWidth: 180 }}
                />
                <input
                  className="form-input"
                  type="date"
                  value={range.to}
                  onChange={(e) => handleCustomDateChange('to', e.target.value)}
                  style={{ maxWidth: 180 }}
                />
              </>
            )}
            <div className="badge badge-primary">Range: {range.from} to {range.to}</div>
            <button className="btn btn-outline" onClick={() => load(range)} disabled={loading}>Refresh</button>
            <button className="btn btn-secondary" onClick={() => data && exportReportCsv(data)} disabled={!data || loading}>
              Export to Excel
            </button>
          </div>
        </div>
      </div>

      {loading || !data ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading reports...</div>
      ) : (
        <>
          <div className="form-grid" style={{ marginBottom: 18 }}>
            {metricCards.map((card) => (
              <SummaryCard key={card.key} label={card.label} value={data.summary?.[card.key] ?? 0} color={card.color} />
            ))}
          </div>

          <div className="card" style={{ marginBottom: 18 }}>
            <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Current Report Window</div>
                <div className="form-hint">{rangeLabel}</div>
              </div>
              <div className="badge badge-success">Updated with daily, status, verification, plans, and top-performer reports</div>
            </div>
          </div>

          <div className="form-grid" style={{ marginBottom: 18 }}>
            <ActivityChart title="Registrations Per Day" data={data.registrations_daily || []} color="#0A7EA4" />
            <ActivityChart title="Appointments Per Day" data={data.appointments_daily || []} color="#0F9D58" />
          </div>

          <div className="form-grid" style={{ marginBottom: 18 }}>
            <ActivityChart title="Lab Orders Per Day" data={data.lab_orders_daily || []} color="#7C3AED" />
            <ActivityChart title="Prescriptions Per Day" data={data.prescriptions_daily || []} color="#F59E0B" />
          </div>

          <div className="form-grid" style={{ marginBottom: 18 }}>
            <SimpleTable
              title="Registrations By Role"
              rows={data.registrations_by_role || []}
              columns={[
                { key: 'role', label: 'Role' },
                { key: 'count', label: 'Count' },
              ]}
            />
            <SimpleTable
              title="Appointments By Status"
              rows={data.appointments_by_status || []}
              columns={[
                { key: 'status', label: 'Status' },
                { key: 'count', label: 'Count' },
              ]}
            />
          </div>

          <div className="form-grid" style={{ marginBottom: 18 }}>
            <SimpleTable
              title="Verification Overview"
              rows={data.verification_by_role || []}
              columns={[
                { key: 'role', label: 'Role' },
                { key: 'verified_count', label: 'Verified' },
                { key: 'pending_count', label: 'Pending' },
              ]}
            />
            <SimpleTable
              title="Plan Requests By Status"
              rows={data.plan_requests_by_status || []}
              columns={[
                { key: 'status', label: 'Status' },
                { key: 'count', label: 'Count' },
              ]}
            />
          </div>

          <div className="form-grid" style={{ marginBottom: 18 }}>
            <SimpleTable
              title="Top Clinics"
              rows={data.top_clinics || []}
              columns={[
                { key: 'name', label: 'Clinic' },
                { key: 'appointments', label: 'Appointments' },
              ]}
            />
            <SimpleTable
              title="Top Doctors"
              rows={data.top_doctors || []}
              columns={[
                { key: 'name', label: 'Doctor' },
                { key: 'appointments', label: 'Appointments' },
              ]}
            />
          </div>

          <SimpleTable
            title="Plan Usage By Role"
            rows={data.plans_by_role || []}
            columns={[
              { key: 'role', label: 'Role' },
              { key: 'plan_name', label: 'Plan' },
              { key: 'count', label: 'Users' },
            ]}
          />
        </>
      )}
    </div>
  );
}
