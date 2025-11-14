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


const userService = {
  // Check if username is available
  async checkUsernameAvailability(username) {
    try {
      const response = await api.get(`/users/check-username/`, {
        params: { username }
      });
      return response.data.available; // true or false
    } catch (error) {
      console.error('Error checking username availability:', error);
      throw error;
    }
  },

  async checkEmailUnique(email) {
    try {
      const response = await api.get(`/users/check-email/`, {
        params: { email }
      });
      return response.data.available;
    } catch (error) {
      console.error('Error checking email uniqueness:', error);
      return false;
    }
},

  // Other user-related API calls can go here, e.g.:
  // createUser, updateUser, getUser, etc.
};

export default userService;
