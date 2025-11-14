import axios from "axios";

// Use environment variable for API URL, fallback to localhost
const API_URLS = import.meta.env.VITE_API_URL || "http://localhost:8000/api/";

const apiClient = axios.create({
    baseURL: API_URLS,
    withCredentials: true,
});

// Log the API URL being used (for debugging)
console.log('API URL:', API_URLS);

export { API_URLS, apiClient };
