import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../services/api_urls';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const NotificationContext = createContext({});

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const audioRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const audioCtxRef = useRef(null);
  const audioUnlockedRef = useRef(false);
  
  const playBeep = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const audioContext = audioCtxRef.current;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.setValueAtTime(930, audioContext.currentTime);
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.7, audioContext.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.15);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.12);
    } catch {
      console.warn('Beep fallback failed');
    }
  };

  // Create audio element for notification sound and unlock on first interaction
  // Only when user is logged in
  useEffect(() => {
    if (!user) {
      // Clean up audio when user logs out
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      audioRef.current = null;
      audioUnlockedRef.current = false;
      return;
    }

    // User is logged in, initialize audio
    try {
      audioRef.current = new Audio('/notification-sound.mp3');
      audioRef.current.volume = 1.0;
    } catch { /* ignore */ }

    const unlock = async () => {
      try {
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          await audioCtxRef.current.resume();
        } else if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Silently unlock audio without playing sound
        // Create a silent audio buffer to unlock the context
        if (audioCtxRef.current && audioCtxRef.current.state !== 'running') {
          const silentBuffer = audioCtxRef.current.createBuffer(1, 1, 22050);
          const source = audioCtxRef.current.createBufferSource();
          source.buffer = silentBuffer;
          source.connect(audioCtxRef.current.destination);
          source.start();
        }
        
        audioUnlockedRef.current = true;
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      } catch (e) {
        console.warn('Audio unlock failed:', e);
      }
    };

    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    // Prevent audio unlock on visibility change (alt-tab)
    const handleVisibilityChange = async () => {
      if (!document.hidden && audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        try {
          await audioCtxRef.current.resume();
        } catch (e) {
          console.warn('Failed to resume audio context:', e);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Fallback if mp3 fails to load: keep playBeep available
    if (audioRef.current) {
      audioRef.current.onerror = () => {
        console.warn('Notification sound file not found. Will use fallback beep.');
      };
    }

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  // WebSocket handling is centralized in hooks/useWebSocketNotifications.js.
  // This context intentionally does NOT open its own WebSocket to avoid duplicate
  // connections and duplicate toasts. It only exposes helpers used by the hook
  // and by components.  
  // Fetch notifications on mount, only when user is logged in
  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [user]);

  const fetchNotifications = async (filters = {}) => {
    try {
      setLoading(true);
      const params = new URLSearchParams(filters);
      const response = await apiClient.get(`boundary-notifications/?${params}`);
      setNotifications(response.data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await apiClient.get('boundary-notifications/unread_count/');
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const res = await apiClient.post(`boundary-notifications/${notificationId}/mark_read/`);
      const updated = res?.data;
      
      // Update local state: keep status as-is (pending if still active); set read_at
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read_at: updated?.read_at || new Date().toISOString() } : n)
      );
      
      // Update unread count
      fetchUnreadCount();
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark notification as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiClient.post('boundary-notifications/mark_all_read/');
      
      // Update local state: set read_at on all, keep status
      const nowIso = new Date().toISOString();
      setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || nowIso })));
      
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  const dismissNotification = async (notificationId) => {
    try {
      await apiClient.post(`boundary-notifications/${notificationId}/dismiss/`);
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, status: 'dismissed' } : n)
      );
      
      toast.success('Notification dismissed');
    } catch (error) {
      console.error('Error dismissing notification:', error);
      toast.error('Failed to dismiss notification');
    }
  };

  const downloadReport = async (filters = {}) => {
    try {
      const params = new URLSearchParams(filters);
      const response = await apiClient.get(`boundary-notifications/download_report/?${params}`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'boundary_violations_report.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Report downloaded successfully');
    } catch (error) {
      console.error('Error downloading report:', error);
      toast.error('Failed to download report');
    }
  };

  // Deduplicate rapid duplicate toasts for the same route (30s window)
  const recentToastKeysRef = useRef(new Map());

  const showToastNotification = (notification) => {
    // Skip if same boat and route was shown very recently
    try {
      const keyParts = [
        notification?.mfbr_number || notification?.boat_name || 'boat',
        notification?.from_municipality || '',
        notification?.to_municipality || ''
      ];
      const key = keyParts.join('|');
      const now = Date.now();
      const last = recentToastKeysRef.current.get(key) || 0;
      if (now - last < 30000) {
        return; // suppress duplicate within 30s
      }
      recentToastKeysRef.current.set(key, now);
      // prune old
      for (const [k, t] of recentToastKeysRef.current.entries()) {
        if (now - t > 120000) recentToastKeysRef.current.delete(k);
      }
    } catch {}

    // Play sound (with robust unlocking + fallback beep)
    const tryPlay = async () => {
      try {
        if (audioRef.current?.play) {
          await audioRef.current.play();
        } else {
          throw new Error('No audio element available');
        }
      } catch {
        // Autoplay blocked or mp3 missing -> use beep
        playBeep();
      }
    };
    tryPlay();

    const goToNotificationPage = () => {
      const role = user?.user_role || 'admin';
      const base = `/${role}/notifications`;
      // Optionally mark as read, then navigate
      if (notification?.id) markAsRead(notification.id);
      // Close sidebar-style overlay if any
      setSidebarOpen(false);
      navigate(base);
    };

    // Show toast (styled like your mockup)
    toast.custom((t) => (
      <div
        className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white border-2 border-red-600 rounded-md shadow pointer-events-auto`} 
        role="button" tabIndex={0}
        onClick={goToNotificationPage}
        onKeyDown={(e) => { if (e.key === 'Enter') goToNotificationPage(); }}
        aria-label="Open notification details"
      >
        <div className="flex p-3">
          <div className="mr-3 flex items-start">
            <svg className="h-6 w-6 text-red-600 mt-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-red-700 font-bold leading-snug">
              ⚠️ Boundary Violation Detected
            </p>
            <p className="text-red-600 text-sm font-medium">
              {notification?.boat_name || notification?.mfbr_number || 'Boat'} crossed into {notification?.to_municipality || 'restricted area'}
            </p>
            {notification?.from_municipality && (
              <p className="text-red-500 text-xs mt-1">
                From: {notification.from_municipality}
              </p>
            )}
            {notification?.dwell_duration_minutes && (
              <p className="text-gray-600 text-xs mt-1">
                Dwell time: {notification.dwell_duration_minutes} min
              </p>
            )}
          </div>
        </div>
      </div>
), { duration: 8000, position: 'bottom-right' });
  };

  const value = {
    notifications,
    unreadCount,
    loading,
    sidebarOpen,
    setSidebarOpen,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    downloadReport,
    showToastNotification
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};