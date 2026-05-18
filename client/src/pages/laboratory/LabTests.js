import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { labAPI } from '../../utils/api';

export default function LabTests() {
  const [tests, setTests] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deptName, setDeptName] = useState('');
  const [form, setForm] = useState({
    test_name: '',
    test_code: '',
    category: '',
    lab_department_id: '',
    description: '',
    price: '',
    discounted_price: '',
    discount_percentage: '',
    preparation_instructions: '',
    turnaround_hours: '',
  });

  const load = () => {
    setLoading(true);
    Promise.all([labAPI.getTests(), labAPI.getDepartments()])
      .then(([testsRes, deptRes]) => {
        setTests(testsRes.data?.tests || []);
        setDepartments(deptRes.data?.departments || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const addDepartment = async () => {
    if (!deptName.trim()) return toast.error('Department name is required');
    try {
      await labAPI.createDepartment({ name: deptName.trim() });
      setDeptName('');
      load();
    } catch {
      toast.error('Failed to add department');
    }
  };

  const addTest = async () => {
    if (!form.test_name || !form.price) return toast.error('Test name and price are required');
    try {
      await labAPI.addTest({
        ...form,
        price: Number(form.price),
        discounted_price: form.discounted_price ? Number(form.discounted_price) : null,
        discount_percentage: form.discount_percentage ? Number(form.discount_percentage) : 0,
        turnaround_hours: form.turnaround_hours ? Number(form.turnaround_hours) : 24,
      });
      toast.success('Test added');
      setForm({
        test_name: '',
        test_code: '',
        category: '',
        lab_department_id: '',
        description: '',
        price: '',
        discounted_price: '',
        discount_percentage: '',
        preparation_instructions: '',
        turnaround_hours: '',
      });
      load();
    } catch {
      toast.error('Failed to add test');
    }
  };

  const updateTest = async (t) => {
    try {
      await labAPI.updateTest(t.id, {
        test_name: t.test_name,
        price: Number(t.price),
        discounted_price: t.discounted_price ? Number(t.discounted_price) : null,
        discount_percentage: t.discount_percentage ? Number(t.discount_percentage) : 0,
        is_active: t.is_active ? 1 : 0,
        lab_department_id: t.lab_department_id || null,
      });
      toast.success('Test updated');
      load();
    } catch {
      toast.error('Failed to update test');
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Lab Departments</div>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Department Name</label>
              <input className="form-input" value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="e.g., Hematology" />
            </div>
            <div className="form-group" style={{ alignSelf: 'end' }}>
              <button className="btn btn-outline" onClick={addDepartment}>Add Department</button>
            </div>
          </div>
          {departments.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {departments.map((d) => (
                <span key={d.id} className="badge badge-gray">{d.name}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Add New Test</div>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Test Name<span className="required">*</span></label>
              <input className="form-input" value={form.test_name} onChange={(e) => setForm({ ...form, test_name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Test Code</label>
              <input className="form-input" value={form.test_code} onChange={(e) => setForm({ ...form, test_code: e.target.value })} />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Category</label>
              <input className="form-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Turnaround Hours</label>
              <input className="form-input" type="number" value={form.turnaround_hours} onChange={(e) => setForm({ ...form, turnaround_hours: e.target.value })} />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Department</label>
              <select
                className="form-select"
                value={form.lab_department_id}
                onChange={(e) => setForm({ ...form, lab_department_id: e.target.value })}
              >
                <option value="">Select Department (optional)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Price<span className="required">*</span></label>
              <input className="form-input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Discounted Price</label>
              <input className="form-input" type="number" value={form.discounted_price} onChange={(e) => setForm({ ...form, discounted_price: e.target.value })} />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Discount %</label>
              <input className="form-input" type="number" value={form.discount_percentage} onChange={(e) => setForm({ ...form, discount_percentage: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Preparation Instructions</label>
              <input className="form-input" value={form.preparation_instructions} onChange={(e) => setForm({ ...form, preparation_instructions: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <button className="btn btn-primary" onClick={addTest}>Add Test</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">My Tests</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : tests.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No tests added yet.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Test</th>
                    <th>Department</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Discounted</th>
                    <th>Active</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map((t, idx) => (
                    <tr key={t.id}>
                      <td>{t.test_name}</td>
                      <td>
                        <select
                          className="form-select"
                          value={t.lab_department_id || ''}
                          onChange={(e) => {
                            const next = [...tests];
                            next[idx] = { ...t, lab_department_id: e.target.value || null };
                            setTests(next);
                          }}
                        >
                          <option value="">-</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>{t.category || '-'}</td>
                      <td>
                        <input className="form-input" style={{ maxWidth: 90 }} type="number" value={t.price} onChange={(e) => {
                          const next = [...tests]; next[idx] = { ...t, price: e.target.value }; setTests(next);
                        }} />
                      </td>
                      <td>
                        <input className="form-input" style={{ maxWidth: 90 }} type="number" value={t.discounted_price || ''} onChange={(e) => {
                          const next = [...tests]; next[idx] = { ...t, discounted_price: e.target.value }; setTests(next);
                        }} />
                      </td>
                      <td>
                        <input type="checkbox" checked={!!t.is_active} onChange={(e) => {
                          const next = [...tests]; next[idx] = { ...t, is_active: e.target.checked ? 1 : 0 }; setTests(next);
                        }} />
                      </td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={() => updateTest(t)}>Save</button>
                      </td>
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
