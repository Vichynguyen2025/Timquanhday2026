import React, { useState, useEffect, useRef, useCallback } from 'react';
import API from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import { FiHeart, FiMessageCircle, FiShare2, FiBookmark, FiMoreHorizontal, FiPlus, FiCamera } from 'react-icons/fi';

const RADII = [100, 200, 500, 1000, 5000];

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

const STORIES = [
  { id: 'st-1', name: 'Chính', color: '#2563EB' },
  { id: 'st-2', name: 'Anh', color: '#EC4899' },
  { id: 'st-3', name: 'Nam', color: '#F59E0B' },
  { id: 'st-4', name: 'Trang', color: '#10B981' },
  { id: 'st-5', name: 'Đức', color: '#8B5CF6' },
  { id: 'st-6', name: 'Chi', color: '#EF4444' },
  { id: 'st-7', name: 'Minh', color: '#06B6D4' },
  { id: 'st-8', name: 'Huy', color: '#F97316' },
];

export default function FeedPage() {
  const [posts, setPosts] = useState([]);
  const [radius, setRadius] = useState(500);
  const [loading, setLoading] = useState(true);
  const [showRadii, setShowRadii] = useState(false);
  const { socket } = useSocket();
  const postsCacheRef = useRef([]);

  // Fetch posts
  useEffect(() => {
    setLoading(true);
    API.get(`/posts?radius=${radius}`).then(({ data }) => {
      const feedPosts = data.posts || [];
      setPosts(feedPosts);
      postsCacheRef.current = feedPosts;
    }).catch(() => {}).finally(() => setLoading(false));
  }, [radius]);

  // Socket.IO realtime events
  useEffect(() => {
    if (!socket) return;

    const onPostNew = (post) => {
      setPosts(prev => {
        if (prev.find(p => p.id === post.id)) return prev;
        const updated = [post, ...prev];
        postsCacheRef.current = updated;
        return updated;
      });
    };

    const onPostLiked = ({ postId, liked, post }) => {
      if (post) {
        setPosts(prev => {
          const updated = prev.map(p => p.id === postId ? post : p);
          postsCacheRef.current = updated;
          return updated;
        });
      } else {
        setPosts(prev => {
          const updated = prev.map(p => p.id === postId ? { ...p, is_liked: liked, like_count: liked ? (p.like_count || 0) + 1 : Math.max((p.like_count || 0) - 1, 0) } : p);
          postsCacheRef.current = updated;
          return updated;
        });
      }
    };

    const onPostDeleted = ({ postId }) => {
      setPosts(prev => {
        const updated = prev.filter(p => p.id !== postId);
        postsCacheRef.current = updated;
        return updated;
      });
    };

    socket.on('post:new', onPostNew);
    socket.on('post:liked', onPostLiked);
    socket.on('post:deleted', onPostDeleted);
    socket.on('comment:new', onCommentNew);
    socket.on('post:saved', onPostSaved);
    socket.on('post:shared', onPostShared);

    return () => {
      socket.off('post:new', onPostNew);
      socket.off('post:liked', onPostLiked);
      socket.off('post:deleted', onPostDeleted);
      socket.off('comment:new', onCommentNew);
      socket.off('post:saved', onPostSaved);
      socket.off('post:shared', onPostShared);
    };
  }, [socket]);

  const toggleLike = async (postId, isLiked) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_liked: !isLiked, like_count: isLiked ? Math.max((p.like_count || 0) - 1, 0) : (p.like_count || 0) + 1 } : p));
    try {
      await API.post(`/posts/${postId}/like`);
    } catch {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_liked, like_count: isLiked ? (p.like_count || 0) + 1 : Math.max((p.like_count || 0) - 1, 0) } : p));
    }
  };

  const toggleSave = async (postId, isSaved) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_saved: !isSaved, save_count: isSaved ? Math.max((p.save_count || 0) - 1, 0) : (p.save_count || 0) + 1 } : p));
    try {
      await API.post(`/posts/${postId}/save`);
    } catch {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_saved, save_count: isSaved ? (p.save_count || 0) + 1 : Math.max((p.save_count || 0) - 1, 0) } : p));
    }
  };

  const handleShare = async (postId) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, share_count: (p.share_count || 0) + 1 } : p));
    try { await API.post(`/posts/${postId}/share`); } catch {}
  };

  const onCommentNew = ({ post_id, post }) => {
    setPosts(prev => {
      const updated = prev.map(p => p.id === post_id ? { ...p, comment_count: post?.comment_count || (p.comment_count || 0) + 1 } : p);
      postsCacheRef.current = updated;
      return updated;
    });
  };
  const onPostSaved = ({ postId, saved }) => {
    setPosts(prev => {
      const updated = prev.map(p => p.id === postId ? { ...p, is_saved: saved, save_count: saved ? (p.save_count || 0) + 1 : Math.max((p.save_count || 0) - 1, 0) } : p);
      postsCacheRef.current = updated;
      return updated;
    });
  };
  const onPostShared = ({ postId }) => {
    setPosts(prev => {
      const updated = prev.map(p => p.id === postId ? { ...p, share_count: (p.share_count || 0) + 1 } : p);
      postsCacheRef.current = updated;
      return updated;
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white z-10 border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">Khám phá</h1>
          <button onClick={() => setShowRadii(!showRadii)} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          </button>
        </div>
        {showRadii && (
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
            {RADII.map(r => (
              <button key={r} onClick={() => { setRadius(r); setShowRadii(false); }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${radius === r ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {r >= 1000 ? `${r / 1000}km` : `${r}m`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stories Row */}
      <div className="flex gap-4 px-4 py-3 overflow-x-auto border-b border-gray-100">
        <div className="flex flex-col items-center flex-shrink-0">
          <div className="w-16 h-16 rounded-full border-2 border-primary-500 flex items-center justify-center bg-gray-50">
            <FiCamera className="text-primary-500" size={22} />
          </div>
          <span className="text-xs text-gray-500 mt-1">Tin của bạn</span>
        </div>
        {STORIES.map(s => (
          <div key={s.id} className="flex flex-col items-center flex-shrink-0">
            <div className="w-16 h-16 rounded-full border-2 flex items-center justify-center bg-gray-50" style={{ borderColor: s.color }}>
              <span className="text-lg font-bold text-gray-700">{s.name[0]}</span>
            </div>
            <span className="text-xs text-gray-500 mt-1">{s.name}</span>
          </div>
        ))}
      </div>

      {/* Feed */}
      <div className="max-w-xl mx-auto">
        {loading ? (
          <div className="space-y-4 p-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 bg-gray-200 rounded-full" /><div className="h-4 bg-gray-200 rounded w-32" /></div>
                <div className="h-80 bg-gray-100 rounded-lg mb-3" />
                <div className="h-4 bg-gray-200 rounded w-24" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="font-medium text-gray-500">Chưa có bài viết</p>
            <p className="text-sm mt-1">Trong khu vực {radius >= 1000 ? `${radius / 1000}km` : `${radius}m`}</p>
          </div>
        ) : (
          posts.map(p => (
            <div key={p.id} className="border-b border-gray-100">
              {/* Post Header */}
              <div className="flex items-center px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-600 font-bold text-sm">{(p.user_name || '?')[0]}</span>
                </div>
                <span className="ml-3 font-semibold text-sm text-gray-900 flex-1">{p.user_name || 'Người dùng'}</span>
                <button className="p-1"><FiMoreHorizontal size={18} className="text-gray-400" /></button>
              </div>

              {/* Post Image */}
              {p.image_url && (
                <img src={p.image_url} alt="Post" className="w-full max-h-[420px] object-cover" loading="lazy" />
              )}

              {/* Post Content */}
              {p.content && (
                <p className="px-4 py-2 text-sm text-gray-800 leading-relaxed">{p.content}</p>
              )}

              {/* Post Actions */}
              <div className="flex items-center justify-between px-3 py-1">
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleLike(p.id, p.is_liked)} className={`p-2 rounded-lg hover:bg-gray-50 transition ${p.is_liked ? 'text-red-500' : 'text-gray-700'}`}>
                    <FiHeart size={22} fill={p.is_liked ? 'currentColor' : 'none'} />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-gray-50 text-gray-700 transition">
                    <FiMessageCircle size={21} />
                  </button>
                  <button onClick={() => handleShare(p.id)} className="p-2 rounded-lg hover:bg-gray-50 text-gray-700 transition">
                    <FiShare2 size={21} />
                  </button>
                </div>
                <button onClick={() => toggleSave(p.id, p.is_saved)} className="p-2 rounded-lg hover:bg-gray-50 transition">
                  <FiBookmark size={21} fill={p.is_saved ? 'currentColor' : 'none'} className={p.is_saved ? 'text-primary-500' : 'text-gray-700'} />
                </button>
              </div>

              {/* Post Footer */}
              <div className="px-4 pb-3">
                <p className="text-sm font-semibold text-gray-900">{p.like_count || 0} lượt thích</p>
                {p.comment_count > 0 && (
                  <p className="text-sm text-gray-500 mt-0.5">Xem {p.comment_count} bình luận</p>
                )}
                <p className="text-xs text-gray-400 mt-1">{formatTime(p.created_at)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}