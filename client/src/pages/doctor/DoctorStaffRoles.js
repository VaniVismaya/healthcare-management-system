import React, { useEffect, useState } from 'react';
import OrgRoleManager from '../shared/OrgRoleManager';
import { clinicAPI } from '../../utils/api';

export default function DoctorStaffRoles() {
  const [clinics, setClinics] = useState([]);

  useEffect(() => {
    clinicAPI.getMyClinics()
      .then(({ data }) => setClinics(data.clinics || []))
      .catch(() => setClinics([]));
  }, []);

  const options = clinics.map((c) => ({ id: c.id, name: c.name }));

  return (
    <OrgRoleManager orgType="clinic" orgOptions={options} />
  );
}
