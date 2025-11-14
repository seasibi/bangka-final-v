import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
};

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true
});

// Add request interceptor to add token
api.interceptors.request.use(
  (config) => {
    let token = localStorage.getItem('access_token');
    
    if (!token) {
      const cookies = document.cookie.split(';');
      const tokenCookie = cookies.find(cookie => cookie.trim().startsWith('access_token='));
      if (tokenCookie) {
        token = tokenCookie.split('=')[1].trim();
      }
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.method !== 'get') {
      const csrfToken = getCookie('csrftoken');
      if (csrfToken) {
        config.headers['X-CSRFToken'] = csrfToken;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Get all fisherfolk for report
export const getFisherfolkReport = async () => {
  try {
    const response = await api.get("/fisherfolk/");
    return response.data;
  } catch (error) {
    console.error("Error fetching fisherfolk report:", error);
    throw error;
  }
};

// Get all boats for report
export const getBoatReport = async () => {
  try {
    const response = await api.get("/boats/");
    return response.data;
  } catch (error) {
    console.error("Error fetching boat report:", error);
    throw error;
  }
};

// Get boundary violations for report
export const getBoundaryViolationReport = async () => {
  try {
    const response = await api.get("/boundary-notifications/");
    return response.data;
  } catch (error) {
    console.error("Error fetching boundary violation report:", error);
    throw error;
  }
};

export default api;
