import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Add Authorization header interceptor if needed
api.interceptors.request.use(
  (config) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; access_token=`);
    if (parts.length === 2) {
      const token = parts.pop().split(';').shift();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const municipalAgriService = {
  getAll: () => api.get('/municipal-agriculturists/'),
  get: (id) => api.get(`/municipal-agriculturists/${id}/`),
  create: (data) => api.post('/municipal-agriculturists/', data),
  update: (id, data) => api.put(`/municipal-agriculturists/${id}/`, data),
  delete: (id) => api.delete(`/municipal-agriculturists/${id}/`),
};

export default municipalAgriService;