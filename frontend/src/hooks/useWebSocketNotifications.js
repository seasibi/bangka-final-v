import { useEffect, useRef } from 'react';
import { useNotifications } from '../contexts/NotificationContext';

const useWebSocketNotifications = (user) => {
  const { showToastNotification, fetchNotifications, fetchUnreadCount } = useNotifications();
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);

  const connectWebSocket = () => {
    // Determine WebSocket URL based on current location
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.VITE_WS_HOST || window.location.hostname;
    const wsPort = import.meta.env.VITE_WS_PORT || '8000';
    const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}/ws/gps/`;

    console.log('Connecting to WebSocket:', wsUrl);

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
      reconnectAttempts.current = 0;
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle boundary notification
        if (data.type === 'boundary_notification') {
          console.log('Received boundary notification:', data.data);
          showToastNotification(data.data);
          fetchNotifications(); // Refresh notification list
          fetchUnreadCount(); // Update unread count
        }
        
        // Handle notification update
        if (data.type === 'notification_update') {
          console.log('Notification status updated:', data.data);
          fetchNotifications(); // Refresh to show updated state (read_at)
          fetchUnreadCount();
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      
      // Attempt to reconnect with exponential backoff
      const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
      reconnectAttempts.current += 1;
      
      console.log(`Reconnecting in ${timeout}ms (attempt ${reconnectAttempts.current})`);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, timeout);
    };
  };

  useEffect(() => {
    // Only connect WebSocket if user is logged in
    if (!user) {
      // If user logs out, disconnect WebSocket
      if (wsRef.current) {
        console.log('User logged out, disconnecting WebSocket');
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      return;
    }

    // User is logged in, connect WebSocket
    connectWebSocket();

    // Cleanup on unmount or when user changes
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user]); // Reconnect when user changes (login/logout)

  return { websocket: wsRef.current };
};

export default useWebSocketNotifications;