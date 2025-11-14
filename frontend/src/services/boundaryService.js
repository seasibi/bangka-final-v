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
  withCredentials: true // This is important for handling cookies
});

export default api;
// Add request interceptor to add token
api.interceptors.request.use(
  (config) => {
    // Try to get token from localStorage first
    let token = localStorage.getItem('access_token');
    
    // If not in localStorage, try to get from cookies
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

    // Add CSRF token for non-GET requests
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

// Get all boundaries
export const getBoundaries = async () => {
  try {
    const response = await api.get("/boundaries/");
    console.log("Fetched boundaries:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching boundaries:", error);
    throw error;
  }
};

// Get all land boundaries
export const getLandBoundaries = async () => {
  try {
    const response = await api.get("/land-boundaries/");
    console.log("Fetched land boundaries:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching land boundaries:", error);
    throw error;
  }
};

// Get a single boundary by ID
export const getBoundaryById = async (id) => {
  try {
    const response = await api.get(`/boundaries/${id}/`);
    return response.data;
  } catch (error) {
    console.error("Error fetching boundary:", error);
    throw error;
  }
};

// Create a new boundary (water by default; pass type="land" for land boundaries)
export const createBoundary = async (data, type = "water") => {
  try {
    const endpoint = type === "land" ? "/land-boundaries/" : "/boundaries/";
    const response = await api.post(endpoint, data);
    return response.data;
  } catch (error) {
    console.error("Error creating boundary:", error);
    throw error;
  }
};

// Update an existing boundary
export const updateBoundary = async (id, data, type = "water") => {
  try {
    const endpoint = type === "land" ? `/land-boundaries/${id}/` : `/boundaries/${id}/`;
    const response = await api.put(endpoint, data);
    return response.data;
  } catch (error) {
    console.error("Error updating boundary:", error);
    throw error;
  }
};

// Delete a boundary
export const deleteBoundary = async (id) => {
  try {
    const response = await api.delete(`/boundaries/${id}/`);
    return response.data;
  } catch (error) {
    console.error("Error deleting boundary:", error);
    throw error;
  }
};