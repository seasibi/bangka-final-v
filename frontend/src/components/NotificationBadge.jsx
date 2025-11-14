import React from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { useNotifications } from '../contexts/NotificationContext';

const NotificationBadge = () => {
  const { unreadCount, setSidebarOpen } = useNotifications();

  return (
    <button
      onClick={() => setSidebarOpen(true)}
      className="relative p-2 text-white hover:text-gray-100 hover:bg-white/20 rounded-full transition-colors"
      title={`${unreadCount} unread notifications`}
    >
      <BellIcon className="h-6 w-6" />
      {unreadCount > 0 && (
        <span className="absolute top-0 right-0 inline-flex items-center justify-center h-5 w-5 text-xs font-bold text-white bg-red-500 rounded-full">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};

export default NotificationBadge;