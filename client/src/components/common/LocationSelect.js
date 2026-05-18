import React, { useMemo } from 'react';
import { Country, State, City } from 'country-state-city';

const countries = Country.getAllCountries();

export default function LocationSelect({ value, onChange, required = false }) {
  const countryCode = useMemo(() => {
    if (value?.countryCode) return value.countryCode;
    if (value?.country) {
      const match = countries.find((c) => c.name === value.country);
      return match?.isoCode || '';
    }
    return '';
  }, [value?.country, value?.countryCode]);

  const states = useMemo(() => {
    if (!countryCode) return [];
    return State.getStatesOfCountry(countryCode) || [];
  }, [countryCode]);

  const stateCode = useMemo(() => {
    if (value?.stateCode) return value.stateCode;
    if (value?.state) {
      const match = states.find((s) => s.name === value.state);
      return match?.isoCode || '';
    }
    return '';
  }, [value?.state, value?.stateCode, states]);

  const cities = useMemo(() => {
    if (!countryCode || !stateCode) return [];
    return City.getCitiesOfState(countryCode, stateCode) || [];
  }, [countryCode, stateCode]);

  const handleCountry = (e) => {
    const code = e.target.value;
    const country = countries.find((c) => c.isoCode === code);
    onChange({
      country: country?.name || '',
      countryCode: code || '',
      state: '',
      stateCode: '',
      city: '',
    });
  };

  const handleState = (e) => {
    const code = e.target.value;
    const state = states.find((s) => s.isoCode === code);
    onChange({
      country: value?.country || '',
      countryCode: countryCode || '',
      state: state?.name || '',
      stateCode: code || '',
      city: '',
    });
  };

  const handleCity = (e) => {
    onChange({
      country: value?.country || '',
      countryCode: countryCode || '',
      state: value?.state || '',
      stateCode: stateCode || '',
      city: e.target.value || '',
    });
  };

  return (
    <div className="form-grid">
      <div className="form-group">
        <label className="form-label">
          Country{required && <span className="required">*</span>}
        </label>
        <select className="form-select" value={countryCode} onChange={handleCountry} required={required}>
          <option value="">Select Country</option>
          {countries.map((c) => (
            <option key={c.isoCode} value={c.isoCode}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">
          State{required && <span className="required">*</span>}
        </label>
        <select
          className="form-select"
          value={stateCode}
          onChange={handleState}
          disabled={!countryCode}
          required={required}
        >
          <option value="">{countryCode ? 'Select State' : 'Select Country First'}</option>
          {states.map((s) => (
            <option key={s.isoCode} value={s.isoCode}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">
          City{required && <span className="required">*</span>}
        </label>
        <select
          className="form-select"
          value={value?.city || ''}
          onChange={handleCity}
          disabled={!countryCode || !stateCode}
          required={required}
        >
          <option value="">{stateCode ? 'Select City' : 'Select State First'}</option>
          {cities.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
