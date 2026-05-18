import React, { useEffect, useMemo, useState } from 'react';
import countryCodes from '../../data/countryCodes';

const flattenDial = (dial) => String(dial || '').replace(/\s/g, '');

const parsePhone = (value) => {
  const raw = String(value || '').trim();
  if (!raw.startsWith('+')) return { dial: '+91', number: raw.replace(/\D/g, '') };
  const sorted = [...countryCodes].sort((a, b) => flattenDial(b.dial).length - flattenDial(a.dial).length);
  for (const c of sorted) {
    const dial = flattenDial(c.dial);
    if (raw.startsWith(dial)) {
      return { dial, number: raw.slice(dial.length).replace(/\D/g, '') };
    }
  }
  return { dial: '+91', number: raw.replace(/\D/g, '') };
};

export default function PhoneInput({
  value,
  onChange,
  required,
  disabled,
  placeholder = 'Phone number',
}) {
  const initial = useMemo(() => parsePhone(value), []);
  const [dial, setDial] = useState(initial.dial);
  const [number, setNumber] = useState(initial.number);

  useEffect(() => {
    const parsed = parsePhone(value);
    setDial(parsed.dial);
    setNumber(parsed.number);
  }, [value]);

  const emit = (d, n) => {
    if (onChange) onChange(`${d}${n}`);
  };

  const handleDialChange = (e) => {
    const d = e.target.value;
    setDial(d);
    emit(d, number);
  };

  const handleNumberChange = (e) => {
    const n = String(e.target.value || '').replace(/\D/g, '');
    setNumber(n);
    emit(dial, n);
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <select className="form-select" value={dial} onChange={handleDialChange} disabled={disabled} style={{ maxWidth: 140 }}>
        {countryCodes.map((c) => (
          <option key={`${c.code}-${c.dial}`} value={flattenDial(c.dial)}>
            {c.name} ({c.dial})
          </option>
        ))}
      </select>
      <input
        className="form-input"
        type="tel"
        value={number}
        onChange={handleNumberChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
      />
    </div>
  );
}
