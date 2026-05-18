import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { clinicAPI, departmentAPI, doctorAPI } from '../../utils/api';

const emptyForm = {
  id: '',
  clinic_id: '',
  department_id: '',
  consultation_type: 'in_person',
  priority_level: 'normal',
  new_patient_fee: '',
  follow_up_fee: '',
};

const consultationTypeOptions = [
  { value: 'in_person', label: 'In-person Visit' },
  { value: 'video', label: 'Video Consultation' },
  { value: 'home_visit', label: 'Home Visit' },
];

const priorityOptions = [
  { value: 'normal', label: 'Normal Queue' },
  { value: 'priority', label: 'High Priority / Emergency' },
];

export default function DoctorConsultationFees() {
  const [clinics, setClinics] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [fees, setFees] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedClinic = useMemo(
    () => clinics.find((clinic) => String(clinic.id) === String(form.clinic_id)),
    [clinics, form.clinic_id]
  );

  const selectedDepartmentName = useMemo(
    () => departments.find((item) => String(item.id) === String(form.department_id))?.name || 'Department',
    [departments, form.department_id]
  );

  const load = async () => {
    setLoading(true);
    try {
      const [clinicRes, departmentRes, feeRes] = await Promise.all([
        clinicAPI.getMyClinics(),
        departmentAPI.list(),
        doctorAPI.getConsultationFees(),
      ]);
      const nextClinics = clinicRes.data?.clinics || [];
      const nextDepartments = departmentRes.data?.departments || [];
      setClinics(nextClinics);
      setDepartments(nextDepartments);
      setFees(feeRes.data?.fees || []);
      setForm((prev) => ({
        ...prev,
        clinic_id: prev.clinic_id || nextClinics[0]?.id || '',
      }));
    } catch {
      toast.error('Failed to load consultation fee setup');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm({
      ...emptyForm,
      clinic_id: clinics[0]?.id || '',
    });
  };

  const saveFee = async () => {
    if (!form.clinic_id) {
      return toast.error('Select a clinic first');
    }
    if (form.new_patient_fee === '') {
      return toast.error('Enter a new patient fee');
    }

    setSaving(true);
    try {
      await doctorAPI.saveConsultationFee({
        id: form.id || undefined,
        clinic_id: form.clinic_id,
        department_id: form.department_id || 0,
        consultation_type: form.consultation_type,
        priority_level: form.priority_level,
        new_patient_fee: form.new_patient_fee,
        follow_up_fee: form.follow_up_fee,
      });
      toast.success(form.id ? 'Consultation fee updated' : 'Consultation fee saved');
      resetForm();
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to save consultation fee');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (fee) => {
    setForm({
      id: fee.id,
      clinic_id: fee.clinic_id,
      department_id: fee.department_id > 0 ? fee.department_id : '',
      consultation_type: fee.consultation_type || 'in_person',
      priority_level: fee.priority_level || 'normal',
      new_patient_fee: fee.new_patient_fee ?? '',
      follow_up_fee: fee.follow_up_fee ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeFee = async (id) => {
    try {
      await doctorAPI.deleteConsultationFee(id);
      toast.success('Consultation fee removed');
      if (String(form.id) === String(id)) {
        resetForm();
      }
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to remove consultation fee');
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Consultation Fees</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : clinics.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>
              Add at least one clinic in <strong>My Clinics</strong> before setting consultation fees.
            </div>
          ) : (
            <>
              <div className="form-hint" style={{ marginBottom: 16 }}>
                Manage consultation charges clinic-wise. Add different fees for visit type, priority, and department wherever needed.
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Clinic<span className="required">*</span></label>
                  <select
                    className="form-select"
                    value={form.clinic_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, clinic_id: e.target.value }))}
                  >
                    <option value="">Select Clinic</option>
                    {clinics.map((clinic) => (
                      <option key={clinic.id} value={clinic.id}>
                        {clinic.name}{clinic.city ? ` - ${clinic.city}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select
                    className="form-select"
                    value={form.department_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, department_id: e.target.value }))}
                  >
                    <option value="">All Departments / General Fee</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Consultation Type</label>
                  <select
                    className="form-select"
                    value={form.consultation_type}
                    onChange={(e) => setForm((prev) => ({ ...prev, consultation_type: e.target.value }))}
                  >
                    {consultationTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Priority Level</label>
                  <select
                    className="form-select"
                    value={form.priority_level}
                    onChange={(e) => setForm((prev) => ({ ...prev, priority_level: e.target.value }))}
                  >
                    {priorityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Patient Fee (INR)<span className="required">*</span></label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    value={form.new_patient_fee}
                    onChange={(e) => setForm((prev) => ({ ...prev, new_patient_fee: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Follow-up Fee (INR)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    value={form.follow_up_fee}
                    onChange={(e) => setForm((prev) => ({ ...prev, follow_up_fee: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Preview</label>
                  <div className="form-hint" style={{ paddingTop: 12 }}>
                    {selectedClinic ? (
                      <>
                        {selectedClinic.name}
                        {form.department_id ? ` � ${selectedDepartmentName}` : ' � General'}
                        {' � '}
                        {consultationTypeOptions.find((item) => item.value === form.consultation_type)?.label}
                        {' � '}
                        {priorityOptions.find((item) => item.value === form.priority_level)?.label}
                      </>
                    ) : 'Select clinic and department to review the fee setup.'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={saveFee} disabled={saving}>
                  {saving ? 'Saving...' : form.id ? 'Update Fee' : 'Save Fee'}
                </button>
                {form.id && (
                  <button className="btn btn-ghost" onClick={resetForm}>
                    Cancel Edit
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Saved Fee Rules</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : fees.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>
              No clinic-wise consultation fees saved yet.
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Clinic</th>
                    <th>Department</th>
                    <th>Type</th>
                    <th>Priority</th>
                    <th>New Patient Fee</th>
                    <th>Follow-up Fee</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {fees.map((fee) => (
                    <tr key={fee.id}>
                      <td>{fee.clinic_name}</td>
                      <td>{fee.department_name || 'All Departments'}</td>
                      <td>{consultationTypeOptions.find((item) => item.value === fee.consultation_type)?.label || fee.consultation_type}</td>
                      <td>{priorityOptions.find((item) => item.value === fee.priority_level)?.label || fee.priority_level}</td>
                      <td>INR {Number(fee.new_patient_fee || 0).toFixed(2)}</td>
                      <td>{fee.follow_up_fee !== null && fee.follow_up_fee !== undefined ? `INR ${Number(fee.follow_up_fee).toFixed(2)}` : '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => startEdit(fee)}>
                            Edit
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => removeFee(fee.id)}>
                            Delete
                          </button>
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
    </div>
  );
}
