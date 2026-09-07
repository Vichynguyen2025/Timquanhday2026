import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { FiArrowLeft, FiMapPin, FiClock } from 'react-icons/fi';

const STATUS_OPTIONS = ['OPEN', 'MATCHING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

export default function SosDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sos, setSos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/admin/sos/${id}`).then((r) => setSos(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (status) => {
    setSaving(true);
    try {
      await api.patch(`/admin/sos/${id}`, { status });
      setSos((prev) => ({ ...prev, status }));
    } catch (e) { alert('Lỗi cập nhật'); }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center pt-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;
  if (!sos) return <div className="text-center pt-20 text-gray-500">Không tìm thấy SOS</div>;

  return (
    <div>
      <button onClick={() => navigate('/sos')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <FiArrowLeft /> Quay lại danh sách
      </button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-lg font-bold text-primary-600">
              {(sos.user_name || '?')[0].toUpperCase()}
            </div>
            <div>
              <h2 className="font-semibold">{sos.user_name}</h2>
              <p className="text-xs text-gray-500">{sos.user_phone || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600"><FiMapPin /> {sos.location_name || `${sos.lat}, ${sos.lng}`}</div>
          <div className="flex items-center gap-2 text-sm text-gray-600"><FiClock /> {sos.created_at?.slice(0, 16)}</div>
          <div className="flex items-center gap-2">
            <span className={`badge text-xs px-3 py-1 ${sos.status === 'COMPLETED' || sos.status === 'CANCELLED' ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'}`}>{sos.status}</span>
            <span className="badge text-xs">{sos.urgency}</span>
            <span className="badge text-xs">{sos.category_name}</span>
          </div>
          <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{sos.description}</p>
          <div>
            <p className="text-xs text-gray-500 mb-2">Cập nhật trạng thái:</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button key={s} disabled={saving || s === sos.status} onClick={() => updateStatus(s)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${s === sos.status ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="lg:col-span-2 space-y-4">
          {/* Media */}
          {sos.media?.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-700 mb-2">Ảnh ({sos.media.length})</h3>
              <div className="flex gap-2 overflow-x-auto">
                {sos.media.map((m) => (
                  <img key={m.id} src={m.url} className="w-32 h-32 object-cover rounded-lg" alt="" />
                ))}
              </div>
            </div>
          )}
          {/* Responses */}
          <div className="card">
            <h3 className="font-semibold text-gray-700 mb-2">Người hỗ trợ ({sos.responses?.length || 0})</h3>
            {sos.responses?.length > 0 ? (
              <div className="space-y-2">
                {sos.responses.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-xs font-bold text-red-600">
                        {(r.provider_name || '?')[0].toUpperCase()}
                      </div>
                      <div><span className="font-medium">{r.provider_name}</span><p className="text-xs text-gray-400">{r.message}</p></div>
                    </div>
                    <span className={`badge text-xs ${r.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' : r.status === 'DECLINED' ? 'bg-red-100 text-red-500' : 'bg-yellow-100 text-yellow-700'}`}>{r.status}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400">Chưa có phản hồi</p>}
          </div>
          {/* History */}
          {sos.history?.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-700 mb-2">Lịch sử</h3>
              <div className="space-y-1">
                {sos.history.map((h) => (
                  <div key={h.id} className="text-xs text-gray-500 flex justify-between"><span>{h.status}</span><span>{h.created_at?.slice(0, 16)}</span></div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}