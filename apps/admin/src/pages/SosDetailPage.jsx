import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { FiArrowLeft, FiMapPin, FiClock, FiCamera } from 'react-icons/fi';

const STATUS_OPTIONS = ['OPEN', 'MATCHING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const STATUS_COLORS = {
  OPEN: 'badge-warning', MATCHING: 'badge-info', ACCEPTED: 'badge-success',
  IN_PROGRESS: '#8b5cf6', COMPLETED: '', CANCELLED: 'badge-danger',
};

export default function SosDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sos, setSos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/admin/sos/${id}`).then(r => setSos(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (status) => {
    setSaving(true);
    try { await api.patch(`/admin/sos/${id}`, { status }); setSos(p => ({ ...p, status })); }
    catch { alert('Lỗi cập nhật'); }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center pt-32"><div className="w-7 h-7 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} /></div>;
  if (!sos) return <div className="text-center pt-32 text-sm" style={{ color: 'var(--text-quaternary)' }}>Không tìm thấy SOS</div>;

  return (
    <div>
      <button onClick={() => navigate('/sos')} className="btn-ghost text-xs gap-1.5 mb-5 flex items-center" style={{ color: 'var(--text-tertiary)' }}>
        <FiArrowLeft size={14} /> Quay lại danh sách
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Info card */}
        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <div className="avatar-circle w-10 h-10 text-base">{(sos.user_name || '?')[0]}</div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{sos.user_name}</h2>
              <p className="text-xs" style={{ color: 'var(--text-quaternary)' }}>{sos.user_phone || '—'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            <FiMapPin size={13} /> {sos.location_name || `${sos.lat}, ${sos.lng}`}
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            <FiClock size={13} /> {sos.created_at?.slice(0, 16)}
          </div>

          <div className="flex gap-1 flex-wrap">
            <span className={`badge ${STATUS_COLORS[sos.status] || ''}`}>{sos.status}</span>
            <span className="badge">{sos.urgency}</span>
            <span className="badge badge-info">{sos.category_name}</span>
          </div>

          <p className="text-xs px-3 py-2.5 rounded-md leading-relaxed" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)' }}>
            {sos.description}
          </p>

          {/* Status update */}
          <div className="border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>Cập nhật trạng thái</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map(s => (
                <button key={s} disabled={saving || s === sos.status} onClick={() => updateStatus(s)}
                  className={`chip ${s === sos.status ? 'active' : ''}`}>{s}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Detail columns */}
        <div className="lg:col-span-2 space-y-4">
          {/* Media */}
          {sos.media?.length > 0 && (
            <div className="card">
              <p className="card-header flex items-center gap-1.5"><FiCamera size={13} />Ảnh ({sos.media.length})</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {sos.media.map(m => (
                  <img key={m.id} src={m.url} className="w-28 h-28 object-cover rounded-lg shrink-0" style={{ border: 'var(--border-primary)' }} alt="" />
                ))}
              </div>
            </div>
          )}

          {/* Responses */}
          <div className="card">
            <p className="card-header">Người hỗ trợ ({sos.responses?.length || 0})</p>
            {sos.responses?.length > 0 ? (
              <div className="space-y-1.5">
                {sos.responses.map(r => (
                  <div key={r.id} className="flex items-center justify-between px-3 py-2.5 rounded-md text-sm" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="flex items-center gap-2.5">
                      <div className="avatar-circle w-7 h-7 text-xs" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                        {(r.provider_name || '?')[0]}
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-primary)' }}>{r.provider_name}</span>
                        {r.message && <p className="text-xs mt-0.5" style={{ color: 'var(--text-quaternary)' }}>{r.message}</p>}
                      </div>
                    </div>
                    <span className={`badge ${r.status === 'ACCEPTED' ? 'badge-success' : r.status === 'DECLINED' ? 'badge-danger' : ''}`}>{r.status}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs" style={{ color: 'var(--text-quaternary)' }}>Chưa có phản hồi</p>}
          </div>

          {/* History */}
          {sos.history?.length > 0 && (
            <div className="card">
              <p className="card-header">Lịch sử</p>
              <div className="space-y-0.5">
                {sos.history.map(h => (
                  <div key={h.id} className="flex items-center justify-between px-3 py-2 rounded-md text-xs" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{h.status}</span>
                    <span style={{ color: 'var(--text-quaternary)' }}>{h.created_at?.slice(0, 16)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}