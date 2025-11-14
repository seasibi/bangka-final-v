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

export const createTracker = async (data) => {
  try {
    console.log('Creating tracker with data:', data);
    const response = await api.post('/birukbilug/', data, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log(response)
    return response.data;
  } catch (error) {
    console.error('Error creating tracker:', error);
    throw error;
  }
};

export const getTrackers = async () => {
  try {
    const response = await api.get('/birukbilug/');
    return response.data;
  } catch (error) {
    console.error('Error fetching trackers:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
};

export const getTracker = async (birukBilugID) => {
  try {
    const response = await api.get(`/birukbilug/${encodeURIComponent(birukBilugID)}/`);
    return response.data;
  } catch (error) {
    console.error('Error fetching tracker:', error.response?.data || error);
    throw error;
  }
};

export const assignTrackerToBoat = async (mfbr_number, birukBilugID) => {
  try {
    // PATCH the tracker, linking it to the boat by mfbr_number
    const trackerResponse = await api.patch(`/birukbilug/${birukBilugID}/`, {
      mfbr_number,   // <-- from serializer (maps to boat OneToOneField)
      status: "assigned",
    });

    console.log("Tracker assigned:", trackerResponse.data);
    return trackerResponse.data;
  } catch (error) {
    console.error(
      "Error assigning tracker to boat:",
      error.response?.data || error
    );
    throw error;
  }
};

export const apiUpdateTrackerStatus = async (birukBilugID, status) => {
  try {
    const response = await api.put(`/birukbilug/${encodeURIComponent(birukBilugID)}/`, { status });
    return response.data;
  } catch (error) {
    console.error('Error updating tracker status:', error.response?.data || error);
    throw error;
  }
};

export const unassignTrackerFromBoat = async (birukBilugID) => {
  try {
    // PATCH the tracker, unlinking it from any boat
    const trackerResponse = await api.patch(`/birukbilug/${birukBilugID}/`, {
      mfbr_number: null,  // or "boat": null if your serializer expects boat
      status: "available",
    });

    console.log("Tracker unassigned:", trackerResponse.data);
    return trackerResponse.data;
  } catch (error) {
    console.error(
      "Error unassigning tracker from boat:",
      error.response?.data || error
    );
    throw error;
  }
};