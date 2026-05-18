import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { departmentAPI, specializationAPI, educationAPI } from '../../utils/api';

const defaultForm = { name: '', description: '', is_active: true };

function MasterSection({ title, description, items, form, setForm, onSave, onEdit, loading, saving, emptyLabel }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">{title}</div>
          <div className="form-hint" style={{ marginTop: 4 }}>{description}</div>
        </div>
      </div>
      <div className="card-body">
        <div className="form-grid" style={{ marginBottom: 14 }}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder={`Add ${title}`} />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Optional description" />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))} />
            Active
          </label>
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : form.id ? `Update ${title}` : `Add ${title}`}
          </button>
          {form.id && (
            <button className="btn btn-outline" onClick={() => setForm(defaultForm)}>
              Cancel Edit
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>{emptyLabel}</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.name}</td>
                    <td>{item.description || '-'}</td>
                    <td>
                      <span className={`badge ${item.is_active ? 'badge-success' : 'badge-warning'}`}>
                        {item.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => onEdit(item)}>
                        Edit
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
  );
}

export default function AdminMasters() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [activeTab, setActiveTab] = useState('departments');
  const [departments, setDepartments] = useState([]);
  const [specializations, setSpecializations] = useState([]);
  const [educations, setEducations] = useState([]);
  const [departmentForm, setDepartmentForm] = useState(defaultForm);
  const [specializationForm, setSpecializationForm] = useState(defaultForm);
  const [educationForm, setEducationForm] = useState(defaultForm);

  const tabs = [
    {
      key: 'departments',
      title: 'Departments',
      description: 'Organizational clinic and hospital departments like Cardiology, Dermatology, Pediatrics, and ENT.',
      items: departments,
      form: departmentForm,
      setForm: setDepartmentForm,
      emptyLabel: 'No departments found.',
      api: { create: departmentAPI.create, update: departmentAPI.update },
    },
    {
      key: 'specializations',
      title: 'Specializations',
      description: 'Professional doctor specialties like Cardiologist, Dermatologist, Neurologist, and General Physician.',
      items: specializations,
      form: specializationForm,
      setForm: setSpecializationForm,
      emptyLabel: 'No specializations found.',
      api: { create: specializationAPI.create, update: specializationAPI.update },
    },
    {
      key: 'educations',
      title: 'Education',
      description: 'Qualification options like MBBS, MD, MS, DM, DNB, and other verified education entries.',
      items: educations,
      form: educationForm,
      setForm: setEducationForm,
      emptyLabel: 'No education entries found.',
      api: { create: educationAPI.create, update: educationAPI.update },
    },
  ];

  const currentTab = tabs.find((tab) => tab.key === activeTab) || tabs[0];

  const load = async () => {
    setLoading(true);
    try {
      const [deptRes, specRes, eduRes] = await Promise.all([
        departmentAPI.listAdmin(),
        specializationAPI.listAdmin(),
        educationAPI.listAdmin(),
      ]);
      setDepartments(deptRes.data.departments || []);
      setSpecializations(specRes.data.specializations || []);
      setEducations(eduRes.data.educations || []);
    } catch {
      toast.error('Failed to load medical masters');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveCurrentTab = async () => {
    const { form, setForm, api, title } = currentTab;
    if (!form.name.trim()) {
      toast.error(`${title} name is required`);
      return;
    }

    setSaving(currentTab.key);
    try {
      if (form.id) {
        await api.update(form.id, form);
        toast.success(`${title} updated`);
      } else {
        await api.create(form);
        toast.success(`${title} added`);
      }
      setForm(defaultForm);
      load();
    } catch {
      toast.error(`Failed to save ${title.toLowerCase()}`);
    } finally {
      setSaving('');
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-header">
          <div className="card-title">Medical Masters</div>
        </div>
        <div className="card-body">
          <div className="form-hint" style={{ marginBottom: 14 }}>
            Manage the shared dropdown values used across registration, doctor profile, search filters, clinics, and verification.
          </div>
          <div className="tabs" style={{ flexWrap: 'wrap' }}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.title} ({tab.items.length})
              </button>
            ))}
          </div>
        </div>
      </div>

      <MasterSection
        title={currentTab.title}
        description={currentTab.description}
        items={currentTab.items}
        form={currentTab.form}
        setForm={currentTab.setForm}
        onSave={saveCurrentTab}
        onEdit={(item) => currentTab.setForm({ id: item.id, name: item.name, description: item.description || '', is_active: !!item.is_active })}
        loading={loading}
        saving={saving === currentTab.key}
        emptyLabel={currentTab.emptyLabel}
      />
    </div>
  );
}
