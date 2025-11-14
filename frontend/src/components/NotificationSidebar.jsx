import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, BellIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import { useNotifications } from '../contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';

const NotificationSidebar = () => {
  const { 
    notifications, 
    sidebarOpen, 
    setSidebarOpen, 
    loading,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    downloadReport
  } = useNotifications();

  // Unread = pending and not yet read_at; Read = anything with read_at or non-pending
  const pendingNotifications = notifications.filter(n => n.status === 'pending' && !n.read_at);
  const readNotifications = notifications.filter(n => (n.status === 'pending' && n.read_at) || n.status === 'read' || n.status === 'dismissed');

  const NotificationItem = ({ notification }) => {
    const isRead = Boolean(notification.read_at);
    
    return (
      <div 
        className={`p-4 border-b hover:bg-gray-50 cursor-pointer transition-colors ${
          isRead ? 'bg-white' : 'bg-yellow-50'
        }`}
        onClick={() => !isRead && markAsRead(notification.id)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-semibold text-gray-900">
                {notification.boat_name}
              </h4>
              {notification.mfbr_number && (
                <span className="text-xs text-gray-500">
                  ({notification.mfbr_number})
                </span>
              )}
              {!isRead && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                  New
                </span>
              )}
            </div>
            
            <p className="mt-1 text-sm text-gray-600">
              Moved from <span className="font-medium">{notification.from_municipality}</span> to{' '}
              <span className="font-medium">{notification.to_municipality}</span>
            </p>
            
            <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
              <span>
                Duration: {notification.dwell_duration_minutes} minutes
              </span>
              <span>
                {formatDistanceToNow(new Date(notification.violation_timestamp), { addSuffix: true })}
              </span>
            </div>
            
            {notification.fisherfolk_name && (
              <p className="mt-1 text-xs text-gray-500">
                Owner: {notification.fisherfolk_name}
              </p>
            )}
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              dismissNotification(notification.id);
            }}
            className="ml-4 text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <Transition.Root show={sidebarOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={setSidebarOpen}>
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-500"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-500"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-500 sm:duration-700"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-500 sm:duration-700"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto relative w-screen max-w-md">
                  <Transition.Child
                    as={Fragment}
                    enter="ease-in-out duration-500"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in-out duration-500"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                  >
                    <div className="absolute left-0 top-0 -ml-8 flex pr-2 pt-4 sm:-ml-10 sm:pr-4">
                      <button
                        type="button"
                        className="relative rounded-md text-gray-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
                        onClick={() => setSidebarOpen(false)}
                      >
                        <span className="absolute -inset-2.5" />
                        <span className="sr-only">Close panel</span>
                        <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                      </button>
                    </div>
                  </Transition.Child>
                  
                  <div className="flex h-full flex-col overflow-y-scroll bg-white py-6 shadow-xl">
                    {/* Header */}
                    <div className="px-4 sm:px-6">
                      <Dialog.Title className="text-base font-semibold leading-6 text-gray-900">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <BellIcon className="h-6 w-6 text-gray-500" />
                            <span>Boundary Violations</span>
                          </div>
                          <button
                            onClick={() => downloadReport()}
                            className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            <DocumentArrowDownIcon className="h-4 w-4 mr-1" />
                            Download Report
                          </button>
                        </div>
                      </Dialog.Title>
                      
                      {pendingNotifications.length > 0 && (
                        <div className="mt-4">
                          <button
                            onClick={markAllAsRead}
                            className="text-sm text-indigo-600 hover:text-indigo-500"
                          >
                            Mark all as read
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="relative mt-6 flex-1 px-0">
                      {loading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                      ) : (
                        <>
                          {/* Pending Notifications */}
                          {pendingNotifications.length > 0 && (
                            <div className="mb-6">
                              <h3 className="px-4 sm:px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                New Violations ({pendingNotifications.length})
                              </h3>
                              <div className="mt-2">
                                {pendingNotifications.map((notification) => (
                                  <NotificationItem 
                                    key={notification.id} 
                                    notification={notification} 
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Read Notifications */}
                          {readNotifications.length > 0 && (
                            <div>
                              <h3 className="px-4 sm:px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Previous Violations ({readNotifications.length})
                              </h3>
                              <div className="mt-2">
                                {readNotifications.map((notification) => (
                                  <NotificationItem 
                                    key={notification.id} 
                                    notification={notification} 
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Empty State */}
                          {notifications.length === 0 && (
                            <div className="text-center py-12">
                              <BellIcon className="mx-auto h-12 w-12 text-gray-400" />
                              <h3 className="mt-2 text-sm font-medium text-gray-900">
                                No notifications
                              </h3>
                              <p className="mt-1 text-sm text-gray-500">
                                You'll be notified when boats violate boundary rules.
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

export default NotificationSidebar;