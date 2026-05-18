import React from 'react';
import { useAuth } from '../../context/AuthContext';
import OrgRoleManager from '../shared/OrgRoleManager';

export default function LabStaffRoles() {
  const { user } = useAuth();
  const orgOptions = user ? [{ id: user.id, name: user.name || 'Laboratory' }] : [];
  return <OrgRoleManager orgType="laboratory" orgOptions={orgOptions} />;
}
