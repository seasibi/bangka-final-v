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
  withCredentials: true
});

// Add interceptor for Authorization
api.interceptors.request.use(
  (config) => {
    const token = getCookie('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Signatories CRUD operations
export const getSignatories = async (params = {}) => {
  try {
    const response = await api.get('/signatories/', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching signatories:', error);
    throw error;
  }
};

export const getSignatory = async (id) => {
  try {
    const response = await api.get(`/signatories/${id}/`);
    return response.data;
  } catch (error) {
    console.error('Error fetching signatory:', error);
    throw error;
  }
};

export const createSignatory = async (data) => {
  try {
    const response = await api.post('/signatories/', data);
    return response.data;
  } catch (error) {
    console.error('Error creating signatory:', error);
    throw error;
  }
};

export const updateSignatory = async (id, data) => {
  try {
    const response = await api.patch(`/signatories/${id}/`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating signatory:', error);
    throw error;
  }
};

export const deleteSignatory = async (id) => {
  try {
    const response = await api.delete(`/signatories/${id}/`);
    return response.data;
  } catch (error) {
    console.error('Error deleting signatory:', error);
    throw error;
  }
};

// Get assigned positions for a specific municipality/barangay
export const getAssignedSignatoryPositions = async (municipalityId, barangayId) => {
  try {
    const response = await api.get(`/signatories/assigned-positions/`, {
      params: { municipality_id: municipalityId, barangay_id: barangayId }
    });
    return response.data.assigned_positions || [];
  } catch (error) {
    console.error('Error fetching assigned signatory positions:', error);
    return [];
  }
};
