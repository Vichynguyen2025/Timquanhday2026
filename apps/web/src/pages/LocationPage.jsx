import React, { useState, useEffect, useCallback } from 'react';
import API from '../services/api';
import { FiMapPin, FiRefreshCw, FiUsers } from 'react-icons/fi';

const RADII = [100, 200, 500, 1000, 5000];

export default function LocationPage() {
  const [location, setLocation] = useState(null);
  const [nearby, setNearby] = useState([]);
  const [radius, setRadius] = useState(500);
  const [loading, setLoading] = useState(true);

  const getLocation = useCallback(async () => {
    setLoading(true);
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
      });
      const { latitude, longitude } = pos.coords;
      setLocation({ lat: latitude, lng: longitude });
      await API.post('/location/update', { lat: latitude, lng: longitude });
    } catch { /* use default location */ }
    setLoading(false);
  }, []);

  useEffect(() => { getLocation(); }, [getLocation]);

  useEffect(() => {
    if (!location) return;
    API.get(`/location/nearby?radius=${radius}`).then(({ data }) => setNearby(data.users || [])).catch(() => {});
  }, [radius, location]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 bg-white/80 backdrop-blur border-b border-gray-100 z-10">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-gray-800">Vị trí</h1>
            <button onClick={getLocation} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><FiRefreshCw size={18} className="text-gray-500" /></button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {RADII.map(r => (
              <button key={r} onClick={() => setRadius(r)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${radius === r ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {r >= 1000 ? `${r / 1000}km` : `${r}m`}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="p-4">
        {loading ? (
          <div className="h-48 bg-gray-100 rounded-2xl animate-pulse flex items-center justify-center"><FiMapPin size={32} className="text-gray-300" /></div>
        ) : (
          <div className="card overflow-hidden mb-4">
            <div className="h-48 bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
              <div className="text-center">
                <FiMapPin size={36} className="text-primary-500 mx-auto mb-2" />
                <p className="text-sm text-primary-700 font-medium">Vị trí hiện tại</p>
                {location && <p className="text-xs text-primary-500 mt-1">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>}
              </div>
            </div>
            <div className="p-3 bg-primary-50 flex items-center justify-center gap-2">
              <FiUsers size={16} className="text-primary-500" />
              <span className="text-sm font-medium text-primary-700">{nearby.length} người gần bạn</span>
            </div>
          </div>
        )}
        <div className="space-y-2">
          {nearby.map(u => (
            <div key={u.id} className="card p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-primary-600 font-bold text-sm">{(u.name || '?')[0]}</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800 text-sm">{u.name}</p>
                <p className="text-xs text-gray-400">{u.distance}m</p>
              </div>
              <div className={`w-2.5 h-2.5 rounded-full ${u.is_online ? 'bg-green-500' : 'bg-gray-300'}`} />
            </div>
          ))}
          {nearby.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-400"><FiMapPin size={36} className="mx-auto mb-3 opacity-40" /><p className="text-sm">Không có ai ở gần trong khu vực này</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
