import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';

const TokenContext = createContext();

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds

export function TokenProvider({ children }) {
  // Safely get auth context (avoid crash if context isn't available yet)
  const auth = (typeof useAuth === 'function') ? useAuth() : null;
  const user = auth?.user || null;
  const openSessionExpired = auth?.openSessionExpired || (() => {});
  const [lastActivity, setLastActivity] = useState(Date.now());
  const timersRef = useRef({});

  const resetInactivityTimer = useCallback(() => {
    setLastActivity(Date.now());
  }, []);

  useEffect(() => {
    // Always clear timers first
    Object.values(timersRef.current).forEach((id) => clearTimeout(id));

    // Do not run inactivity timers when no authenticated user (e.g., on Login page)
    if (!user) {
      return () => {};
    }

    const logoutTimer = setTimeout(() => {
      openSessionExpired();
    }, INACTIVITY_TIMEOUT);

    timersRef.current.logout = logoutTimer;

    return () => {
      clearTimeout(logoutTimer);
    };
  }, [lastActivity, user, openSessionExpired]);

  // Listen for user events to reset timer
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'mousemove', 'click', 'scroll', 'touchstart'];
    const activityHandler = () => resetInactivityTimer();

    // Only listen for activity when user is authenticated
    if (user) {
      events.forEach((event) => window.addEventListener(event, activityHandler));
    }
    return () => {
      events.forEach((event) => window.removeEventListener(event, activityHandler));
    };
  }, [resetInactivityTimer, user]);

  return (
    <TokenContext.Provider value={{ resetInactivityTimer }}>
      {children}
    </TokenContext.Provider>
  );
}

export const useToken = () => useContext(TokenContext); 