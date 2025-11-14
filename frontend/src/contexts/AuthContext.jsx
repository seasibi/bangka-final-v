import { useState, createContext, useContext, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { API_URLS, apiClient } from "../services/api_urls";
import { jwtDecode } from "jwt-decode";
import Modal from "../components/Modal";

const AuthContext = createContext();


// Detect if a given request URL is already pointing to the refresh endpoint so we can avoid retrying it
const isRefreshEndpoint = (url) => url && url.toString().includes("/refresh/");

export default function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const tokenRef = useRef(null);
    const userRef = useRef(null);
    const [refreshTimer, setRefreshTimer] = useState(null);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [sessionExpiredOpen, setSessionExpiredOpen] = useState(false);
    
    // Keep userRef in sync with user state
    useEffect(() => {
        userRef.current = user;
    }, [user]);

    // Helper to schedule refresh about 1 min before expiry
    const scheduleRefresh = (token) => {
        if (!token) return;
        try {
            const decoded = jwtDecode(token);
            if (!decoded?.exp) return;
            const expiry = decoded.exp * 1000; // exp is in seconds
            const now = Date.now();
            const timeout = expiry - now - 60 * 1000; // 1 minute before
            if (timeout <= 0) return;
            if (refreshTimer) clearTimeout(refreshTimer);
            const timerId = setTimeout(() => {
                refreshAccessToken();
            }, timeout);
            setRefreshTimer(timerId);
        } catch (e) {
            console.error("Failed to decode token", e);
        }
    };

    const refreshAccessToken = async () => {
        // Don't try to refresh if we're already logging out or no user is logged in
        if (isLoggingOut || !user) return null;
        
        try {
            const res = await axios.post(`${API_URLS}refresh/`, {}, { withCredentials: true });
            const { access } = res.data;
            if (access) {
                // Django backend sets the cookie, we just need to store the token reference
                tokenRef.current = access;
                scheduleRefresh(access);
                return access;
            }
        } catch (err) {
            // Only log error if user is actually logged in
            if (user) {
                console.error("Token refresh failed", err);
            }
            // Only logout if refresh truly failed (not just network issues)
            // and not during initial load and user exists
            if ((err.response?.status === 401 || err.response?.status === 403) && !loading && user) {
                // Show session-expired modal instead of immediate redirect
                setSessionExpiredOpen(true);
            }
            return null;
        }
    };

    // Set up axios interceptors only once
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        const requestInterceptor = axios.interceptors.request.use(
            (config) => {
                // For cookie-based auth, ensure credentials are included
                config.withCredentials = true;
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Also attach to apiClient
        const apiRequestInterceptor = apiClient.interceptors.request.use(
            (config) => {
                // For cookie-based auth, ensure credentials are included
                config.withCredentials = true;
                return config;
            },
            (error) => Promise.reject(error)
        );

        const responseInterceptor = axios.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config || {};

                // If the failed request is itself the refresh call, do not attempt another refresh
                if (isRefreshEndpoint(originalRequest.url)) {
                    return Promise.reject(error);
                }
                
                // Don't attempt refresh for login endpoint or if no user is logged in
                const isLoginEndpoint = originalRequest.url && originalRequest.url.includes('/login/');
                const isProtectedEndpoint = originalRequest.url && originalRequest.url.includes('/protected/');
                
                if (error.response?.status === 401 && !originalRequest._retry && userRef.current && !isLoginEndpoint) {
                    // Skip refresh for initial protected endpoint check
                    if (isProtectedEndpoint && !userRef.current) {
                        return Promise.reject(error);
                    }
                    
                    originalRequest._retry = true;
                    const newToken = await refreshAccessToken();
                    if (newToken) {
                        // Don't set Authorization header - cookies are handled automatically
                        // Just retry the request with the new cookie that was set by refreshAccessToken
                        return axios(originalRequest);
                    }
                }
                return Promise.reject(error);
            }
        );

        // attach to apiClient
        const apiResponseInterceptor = apiClient.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config || {};

                if (isRefreshEndpoint(originalRequest.url)) {
                    return Promise.reject(error);
                }
                
                // Don't attempt refresh for login endpoint or if no user is logged in
                const isLoginEndpoint = originalRequest.url && originalRequest.url.includes('/login/');
                const isProtectedEndpoint = originalRequest.url && originalRequest.url.includes('/protected/');
                
                if (error.response?.status === 401 && !originalRequest._retry && userRef.current && !isLoginEndpoint) {
                    // Skip refresh for initial protected endpoint check
                    if (isProtectedEndpoint && !userRef.current) {
                        return Promise.reject(error);
                    }
                    
                    originalRequest._retry = true;
                    const newToken = await refreshAccessToken();
                    if (newToken) {
                        // Don't set Authorization header - cookies are handled automatically
                        // Just retry the request with the new cookie that was set by refreshAccessToken
                        return apiClient(originalRequest);
                    }
                }
                return Promise.reject(error);
            }
        );

        return () => {
            axios.interceptors.request.eject(requestInterceptor);
            axios.interceptors.response.eject(responseInterceptor);
            apiClient.interceptors.request.eject(apiRequestInterceptor);
            apiClient.interceptors.response.eject(apiResponseInterceptor);
        };
    }, []);

    // When component mounts, we can't read HttpOnly cookies
    // So we'll rely on the fetchUser to validate if we're authenticated
    useEffect(() => {
        // We'll get the token from the backend response instead
    }, []);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                // Create a custom axios instance for this initial check to bypass interceptors
                const response = await axios.create().get(`${API_URLS}protected/`, {
                    withCredentials: true
                });
                setUser(response.data.user);
                setLoading(false);
            } catch (err) {
                // Don't log error on initial load if it's just 401
                if (err.response?.status === 401) {
                    // This is expected on initial load if not logged in
                    // Don't try to refresh on initial load - just set user to null
                    setUser(null);
                } else if (err.response?.status !== 401) {
                    // Only log non-401 errors
                    console.error("Error fetching user:", err);
                    setUser(null);
                }
                setLoading(false);
            }
        };
    
        fetchUser();

        // Check token validity every 5 minutes
        const tokenCheckInterval = setInterval(fetchUser, 300000);

        return () => {
            clearInterval(tokenCheckInterval);
        };
    }, []);

    const login = async (credentials) => {
        setLoading(true);
        setError(null);
      
        try {
            // Ensure email is lowercase
            const loginCredentials = {
                ...credentials,
                username: credentials.username.toLowerCase()
            };
            console.log("Sending login request with:", loginCredentials); 
            console.log("API URL:", `${API_URLS}login/`);
            
            // Use a fresh axios instance to bypass interceptors for login
            const loginAxios = axios.create();
            const response = await loginAxios.post(`${API_URLS}login/`, loginCredentials, {
                withCredentials: true,
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            console.log("Login response:", response.data);
      
            const { access, must_change_password, user_role } = response.data;
            
            if (!access) {
                console.error("No access token in response!");
                setError("Login failed - no access token received");
                setLoading(false);
                return null;
            }
      
            // Django backend sets the cookie, we just need to store the token reference
            tokenRef.current = access;
            scheduleRefresh(access);
      
            const userResponse = await axios.get(`${API_URLS}protected/`, {
                headers: {
                    Authorization: `Bearer ${access}`,
                },
            });

            // Set user state immediately
            const userData = userResponse.data.user;
            setUser(userData);
            setLoading(false);

            // Force a small delay to ensure state is updated
            await new Promise(resolve => setTimeout(resolve, 100));

            // Return user data with must_change_password flag
            return {
                ...userData,
                must_change_password,
                user_role
            };
        } catch (error) {
            console.error("Login error:", error.response || error.message);
            setError("Invalid credentials");
            setLoading(false);
            return null;
        }
    };
    
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const logout = useCallback(async () => {
        // Prevent multiple logout calls
        if (isLoggingOut) return;
        setIsLoggingOut(true);
        
        try {
            // Call backend logout endpoint
            await axios.post(`${API_URLS}logout/`, {}, {
                withCredentials: true
            });
        } catch (error) {
            console.error("Logout API call failed:", error);
            // Continue with local logout even if API call fails
        }
        
        // Clear cookies
        document.cookie = "access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie = "refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        
        // Clear refresh timer
        if (refreshTimer) {
            clearTimeout(refreshTimer);
            setRefreshTimer(null);
        }
        
        // Clear user state
        setUser(null);
        setIsLoggingOut(false);
        
        // Use replace to navigate to login page to prevent back button issues
        window.location.replace("/");
    }, [isLoggingOut, refreshTimer]);

    const handleConfirmSessionExpired = async () => {
        setSessionExpiredOpen(false);
        await logout();
    };

    return (
        <AuthContext.Provider value={{ user, error, loading, login, logout, clearError, openSessionExpired: () => setSessionExpiredOpen(true) }}>
            {children}
            <Modal
                isOpen={sessionExpiredOpen}
                onClose={handleConfirmSessionExpired}
                onConfirm={handleConfirmSessionExpired}
                title="Session expired"
                message={"Your session has expired.\n\nYou will be redirected to the Login page."}
                confirmText="OK"
            />
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
