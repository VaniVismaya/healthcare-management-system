import React from 'react';
import { useAuth } from '../../context/AuthContext';
import OrgRoleManager from '../shared/OrgRoleManager';

export default function PharmacyStaffRoles() {
  const { user } = useAuth();
  const orgOptions = user ? [{ id: user.id, name: user.name || 'Pharmacy' }] : [];
  return <OrgRoleManager orgType="pharmacy" orgOptions={orgOptions} />;
}
