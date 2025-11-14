import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
};

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Add request interceptor for authentication
api.interceptors.request.use(
  (config) => {
    const token = getCookie('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Barangay Verifier CRUD operations
export const getBarangayVerifiers = async (params = {}) => {
  try {
    const response = await api.get('/barangay-verifiers/', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching barangay verifiers:', error);
    throw error;
  }
};

export const getBarangayVerifier = async (id) => {
  try {
    const response = await api.get(`/barangay-verifiers/${id}/`);
    return response.data;
  } catch (error) {
    console.error('Error fetching barangay verifier:', error);
    throw error;
  }
};

export const createBarangayVerifier = async (data) => {
  try {
    const response = await api.post('/barangay-verifiers/', data);
    return response.data;
  } catch (error) {
    console.error('Error creating barangay verifier:', error);
    throw error;
  }
};

export const updateBarangayVerifier = async (id, data) => {
  try {
    const response = await api.put(`/barangay-verifiers/${id}/`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating barangay verifier:', error);
    throw error;
  }
};

export const deleteBarangayVerifier = async (id) => {
  try {
    await api.delete(`/barangay-verifiers/${id}/`);
  } catch (error) {
    console.error('Error deleting barangay verifier:', error);
    throw error;
  }
};

// Get assigned positions for a specific barangay
export const getAssignedPositions = async (municipalityId, barangayId) => {
  try {
    const response = await api.get('/barangay-verifiers/assigned-positions/', {
      params: { municipality_id: municipalityId, barangay_id: barangayId }
    });
    return response.data.assigned_positions || [];
  } catch (error) {
    console.error('Error fetching assigned positions:', error);
    return [];
  }
};
