import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { clinicAPI } from '../../utils/api';

const reverseGeocodeCity = async (lat, lng) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
    if (!res.ok) return '';
    const data = await res.json();
    const addr = data?.address || {};
    return addr.city || addr.town || addr.village || addr.state_district || addr.county || addr.state || '';
  } catch {
    return '';
  }
};

export default function PatientClinics() {
  const [search, setSearch] = useState({ name: '', city: '' });
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nearMe, setNearMe] = useState(false);
  const [radiusKm, setRadiusKm] = useState(10);
  const [geo, setGeo] = useState({ status: 'idle', lat: null, lng: null, error: '' });

  const handleEnableNearMe = () => {
    if (!navigator.geolocation) {
      toast.error('GPS not supported on this device');
      return;
    }
    setGeo({ status: 'loading', lat: null, lng: null, error: '' });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGeo({ status: 'ready', lat, lng, error: '' });
        const city = await reverseGeocodeCity(lat, lng);
        if (city) {
          setSearch((prev) => ({ ...prev, city: prev.city || city }));
        }
        handleSearch({ latitude: lat, longitude: lng, radius_km: radiusKm });
        toast.success('Location detected');
      },
      (err) => {
        setGeo({ status: 'error', lat: null, lng: null, error: err.message || 'Location access denied' });
        setNearMe(false);
        toast.error('Location access denied');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleToggleNearMe = () => {
    const next = !nearMe;
    setNearMe(next);
    if (next) {
      handleEnableNearMe();
    } else {
      setGeo({ status: 'idle', lat: null, lng: null, error: '' });
    }
  };

  const handleSearch = async (override = null) => {
    setLoading(true);
    try {
      const params = { name: search.name, city: search.city };
      if (override?.latitude && override?.longitude) {
        params.latitude = override.latitude;
        params.longitude = override.longitude;
        params.radius_km = override.radius_km || radiusKm;
      } else if (nearMe && geo.status === 'ready' && geo.lat && geo.lng) {
        params.latitude = geo.lat;
        params.longitude = geo.lng;
        params.radius_km = radiusKm;
      }
      const { data } = await clinicAPI.search(params);
      setClinics(data.clinics || []);
    } catch {
      toast.error('Failed to search clinics');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Find Clinics</div>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Clinic Name</label>
              <input className="form-input" value={search.name} onChange={(e) => setSearch({ ...search, name: e.target.value })} placeholder="e.g. MediCare Clinic" />
            </div>
            <div className="form-group">
              <label className="form-label">City</label>
              <input className="form-input" value={search.city} onChange={(e) => setSearch({ ...search, city: e.target.value })} placeholder="Auto-filled if GPS is on" />
            </div>
          </div>
          <div className="form-grid" style={{ alignItems: 'end', marginTop: 6 }}>
            <div className="form-group">
              <label className="form-label">Near Me (GPS)</label>
              <button className={`btn ${nearMe ? 'btn-primary' : 'btn-outline'}`} onClick={handleToggleNearMe} disabled={geo.status === 'loading'}>
                {geo.status === 'loading' ? 'Detecting...' : nearMe ? 'Near Me Enabled' : 'Use My Location'}
              </button>
              {geo.status === 'ready' && (
                <div className="form-hint">Using GPS location for nearby clinics.</div>
              )}
              {geo.status === 'error' && (
                <div className="form-hint" style={{ color: '#B91C1C' }}>{geo.error || 'Location error'}</div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Radius (km)</label>
              <select className="form-select" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} disabled={!nearMe || geo.status !== 'ready'}>
                {[5, 10, 15, 25, 50].map((r) => (
                  <option key={r} value={r}>{r} km</option>
                ))}
              </select>
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Clinics</div>
        </div>
        <div className="card-body">
          {clinics.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>Search to see clinics.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Clinic</th>
                    <th>Photo</th>
                    <th>Doctor</th>
                    <th>City</th>
                    {nearMe && <th>Distance</th>}
                    <th>Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {clinics.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>
                        {c.photos && c.photos.length ? (
                          <img src={c.photos[0]} alt="Clinic" style={{ width: 42, height: 32, borderRadius: 8, objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>â€”</span>
                        )}
                      </td>
                      <td>{c.doctor_name || '-'}</td>
                      <td>{c.city}</td>
                      {nearMe && (
                        <td>{c.distance_km ? `${Number(c.distance_km).toFixed(1)} km` : '-'}</td>
                      )}
                      <td>{c.phone || '-'}</td>
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
