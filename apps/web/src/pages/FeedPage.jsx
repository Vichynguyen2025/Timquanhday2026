import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { FiHeart, FiMessageCircle, FiShare2, FiMapPin } from 'react-icons/fi';

const RADII = [100, 200, 500, 1000, 5000];

export default function FeedPage() {
  const [posts, setPosts] = useState([]);
  const [radius, setRadius] = useState(500);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    API.get(`/posts?radius=${radius}`).then(({ data }) => setPosts(data.posts || [])).catch(() => {}).finally(() => setLoading(false));
  }, [radius]);

  const toggleLike = async (postId) => {
    try { await API.post(`/posts/${postId}/like`); setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_liked: !p.is_liked, like_count: p.is_liked ? p.like_count - 1 : p.like_count + 1 } : p)); } catch {}
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 bg-white/80 backdrop-blur border-b border-gray-100 z-10">
        <div className="p-4">
          <h1 className="text-xl font-bold text-gray-800 mb-3">Khám phá</h1>
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
      <div className="p-4 space-y-4">
        {loading ? Array(3).fill(0).map((_, i) => (
          <div key={i} className="card p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-3/4 mb-3" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div>
        )) : posts.length === 0 ? (
          <div className="text-center py-20 text-gray-400"><FiMapPin size={48} className="mx-auto mb-4 opacity-40" /><p className="font-medium">Chưa có bài viết</p><p className="text-sm">Chưa có bài viết nào trong khu vực {radius >= 1000 ? `${radius / 1000}km` : `${radius}m`}</p></div>
        ) : posts.map(p => (
          <div key={p.id} className="card p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center"><span className="text-primary-600 font-bold">{(p.user_name || '?')[0]}</span></div>
              <div><p className="font-semibold text-gray-800 text-sm">{p.user_name}</p><p className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString('vi-VN')}</p></div>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed mb-3">{p.content}</p>
            <div className="flex items-center gap-6 pt-3 border-t border-gray-100">
              <button onClick={() => toggleLike(p.id)} className={`flex items-center gap-1.5 text-sm ${p.is_liked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'} transition-colors`}>
                <FiHeart size={18} fill={p.is_liked ? 'currentColor' : 'none'} /> {p.like_count || 0}
              </button>
              <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-500 transition-colors"><FiMessageCircle size={18} /> 0</button>
              <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-500 transition-colors"><FiShare2 size={18} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
