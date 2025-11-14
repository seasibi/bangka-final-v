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

// Municipality CRUD operations
export const getMunicipalities = async (params = {}) => {
  try {
    const response = await api.get('/municipalities/', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching municipalities:', error);
    throw error;
  }
};

export const getMunicipality = async (id) => {
  try {
    const response = await api.get(`/municipalities/${id}/`);
    return response.data;
  } catch (error) {
    console.error('Error fetching municipality:', error);
    throw error;
  }
};

export const createMunicipality = async (data) => {
  try {
    const response = await api.post('/municipalities/', data);
    return response.data;
  } catch (error) {
    console.error('Error creating municipality:', error);
    throw error;
  }
};

export const updateMunicipality = async (id, data) => {
  try {
    const response = await api.patch(`/municipalities/${id}/`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating municipality:', error);
    throw error;
  }
};

export const deleteMunicipality = async (id) => {
  try {
    const response = await api.delete(`/municipalities/${id}/`);
    return response.data;
  } catch (error) {
    console.error('Error deleting municipality:', error);
    throw error;
  }
};

// Barangay operations
export const getBarangays = async (params = {}) => {
  try {
    const response = await api.get('/barangays/', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching barangays:', error);
    throw error;
  }
};

export const createBarangay = async (data) => {
  try {
    const response = await api.post('/barangays/', data);
    return response.data;
  } catch (error) {
    console.error('Error creating barangay:', error);
    throw error;
  }
};

export const updateBarangay = async (id, data) => {
  try {
    const response = await api.patch(`/barangays/${id}/`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating barangay:', error);
    throw error;
  }
};

export const deleteBarangay = async (id) => {
  try {
    const response = await api.delete(`/barangays/${id}/`);
    return response.data;
  } catch (error) {
    console.error('Error deleting barangay:', error);
    throw error;
  }
};

// Bulk barangay operations on municipality
export const addBarangaysToMunicipality = async (municipalityId, barangays) => {
  try {
    const response = await api.post(`/municipalities/${municipalityId}/add_barangays/`, {
      barangays
    });
    return response.data;
  } catch (error) {
    console.error('Error adding barangays to municipality:', error);
    throw error;
  }
};

export const updateBarangaysInMunicipality = async (municipalityId, barangays) => {
  try {
    const response = await api.patch(`/municipalities/${municipalityId}/update_barangays/`, {
      barangays
    });
    return response.data;
  } catch (error) {
    console.error('Error updating barangays in municipality:', error);
    throw error;
  }
};

export const deleteBarangaysFromMunicipality = async (municipalityId, barangayIds) => {
  try {
    const response = await api.delete(`/municipalities/${municipalityId}/delete_barangays/`, {
      data: { barangay_ids: barangayIds }
    });
    return response.data;
  } catch (error) {
    console.error('Error deleting barangays from municipality:', error);
    throw error;
  }
};
