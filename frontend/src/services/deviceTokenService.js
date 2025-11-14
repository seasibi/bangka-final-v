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

api.interceptors.request.use(
  (config) => {
    const token = getCookie('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

export const createDeviceToken = async ({ name, boat_id = null }) => {
  const response = await api.post('/device-tokens/', { name, boat_id });
  return response.data; // contains { id, name, masked_token, token, boat_id, ... }
};

export const getDeviceTokenByName = async (name) => {
  const response = await api.get('/device-tokens/', { params: { name } });
  const list = Array.isArray(response.data) ? response.data : response.data?.results || [];
  return list[0] || null;
};

export const rotateDeviceToken = async (id) => {
  const response = await api.post(`/device-tokens/${id}/rotate/`);
  return response.data; // { id, token }
};

export const revokeDeviceToken = async (id) => {
  const response = await api.post(`/device-tokens/${id}/revoke/`);
  return response.data; // { id, is_active }
};