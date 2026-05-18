export const formatLocalDate = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const todayLocalDate = () => formatLocalDate(new Date());

export const normalizeAppointmentDate = (value) => {
  if (!value) return '';
  if (value instanceof Date) return formatLocalDate(value);

  const raw = String(value).trim();
  if (!raw) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return formatLocalDate(parsed);
  }

  if (raw.includes('T')) {
    return raw.split('T')[0];
  }

  return raw.slice(0, 10);
};

export const appointmentSortKey = (appt = {}) =>
  `${normalizeAppointmentDate(appt.appointment_date)} ${String(appt.session_start_time || appt.appointment_time || '')}`;
