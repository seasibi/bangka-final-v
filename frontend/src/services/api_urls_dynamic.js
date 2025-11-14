import axios from "axios";

// Dynamic API URL configuration
// This will use the current window location to determine the API URL
const getApiUrl = () => {
    // If we're in development mode and accessing via IP
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        // Use the same hostname but with backend port
        return `http://${window.location.hostname}:8000/api/`;
    }
    // Default to localhost for local development
    return 'http://localhost:8000/api/';
};

const API_URLS = getApiUrl();

const apiClient = axios.create({
    baseURL: API_URLS,
    withCredentials: true,
});

// Log the API URL being used (for debugging)
console.log('Dynamic API URL:', API_URLS);

export { API_URLS, apiClient };
