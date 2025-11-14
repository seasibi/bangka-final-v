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

export const getBoats = async () => {
  try {
    const response = await api.get('/boats/');
    console.log('Fetched boats:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching boats:', error);
    throw error;
  }
};

export const getBoatById = async (id) => {
  try {
    const response = await api.get(`/boats/${id}/`);
    return response.data;
  } catch (error) {
    console.error('Error fetching boat:', error);
    throw error;
  }
};

export const createBoat = async (formData) => {
  try {
    console.log("Sending data to backend:", Object.fromEntries(formData.entries()));
    const response = await api.post('/boats/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error creating boat:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
};
// Create boat measurements
export const createBoatMeasurements = async (data) => {
  try {
    console.log("Sending boat measurements data:", data);
    const response = await api.post('/boat-measurements/', data, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error creating boat measurements:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    throw error;
  }
};

// Update boat measurements
export const updateBoatMeasurements = async (boatId, data) => {
  try {
    console.log(`Updating boat measurements for boat ${boatId}:`, data);
    const response = await api.put(`/boat-measurements/${boatId}/`, data, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error updating boat measurements:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    throw error;
  }
};

// ✅ Create BoatGearAssignment (container)
export const createBoatGearAssignment = async (mfbr_number) => {
  try {
    const res = await api.post("/boat-gear-assignment/", { boat: mfbr_number });
    return res.data;
  } catch (err) {
    console.error("❌ createBoatGearAssignment failed:", err.response?.status, err.response?.data);
    throw err;
  }
}

export const createOrGetBoatGearAssignment = async (mfbr_number) => {
  try {
    return await createBoatGearAssignment(mfbr_number);
  } catch (err) {
    // if backend enforces 1:1 and this boat already has a container, reuse it
    const body = err.response?.data;
    const isDuplicate = err.response?.status === 400 && JSON.stringify(body || {}).toLowerCase().includes("already");
    if (isDuplicate) {
      const list = await getBoatGearAssignmentsByBoat(mfbr_number);
      if (list.length) return list[0];
    }
    throw err;
  }
};

// ✅ Assign a GearType to the container
export const createBoatGearTypeAssignment = async (data) => {
  // data = { boat_gear_assignment, gear_type_id, is_present }
  return (await api.post("/boat-gear-type-assignment/", data)).data;
};

// ✅ Assign a GearSubtype to the container
export const createBoatGearSubtypeAssignment = async (data) => {
  // data = { boat_gear_assignment, gear_subtype_id, is_present, quantity }
  return (await api.post("/boat-gear-subtype-assignment/", data)).data;
};

// ✅ Update a GearType assignment
export const updateBoatGearTypeAssignment = async (id, data) => {
  try {
    const response = await api.patch(`/boat-gear-type-assignment/${id}/`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating gear type assignment:', error);
    throw error;
  }
};

// ✅ Update a GearSubtype assignment
export const updateBoatGearSubtypeAssignment = async (id, data) => {
  try {
    const response = await api.patch(`/boat-gear-subtype-assignment/${id}/`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating gear subtype assignment:', error);
    throw error;
  }
};

// ✅ Delete a GearType assignment
export const deleteBoatGearTypeAssignment = async (id) => {
  try {
    const response = await api.delete(`/boat-gear-type-assignment/${id}/`);
    return response.data;
  } catch (error) {
    console.error('Error deleting gear type assignment:', error);
    throw error;
  }
};

// ✅ Delete a GearSubtype assignment
export const deleteBoatGearSubtypeAssignment = async (id) => {
  try {
    const response = await api.delete(`/boat-gear-subtype-assignment/${id}/`);
    return response.data;
  } catch (error) {
    console.error('Error deleting gear subtype assignment:', error);
    throw error;
  }
};

// ✅ Get boat gear assignments by boat
export const getBoatGearAssignmentsByBoat = async (mfbr_number) => {
  try {
    const response = await api.get(`/boat-gear-assignment/?boat=${mfbr_number}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching gear assignments:', error);
    throw error;
  }
};

export const updateBoat = async (id, data) => {
  try {
    console.log(`Updating boat with ID ${id}:`, data instanceof FormData ? Object.fromEntries(data.entries()) : data);

    // Set appropriate headers based on data type
    const config = {};
    if (data instanceof FormData) {
      config.headers = {
        'Content-Type': 'multipart/form-data',
      };
    } else {
      config.headers = {
        'Content-Type': 'application/json',
      };
    }

    const response = await api.put(`/boats/${id}/`, data, config);
    return response.data;
  } catch (error) {
    console.error('Error updating boat:', error);
    console.error('Error status:', error.response?.status);
    console.error('Error data:', error.response?.data);
    console.error('Full error response:', error.response);
    
    if (error.response?.status === 400) {
      console.error('400 Bad Request - Validation errors:', JSON.stringify(error.response.data, null, 2));
    }
    
    throw error;
  }
};

export const deleteBoat = async (id) => {
  try {
    const response = await api.delete(`/boats/${id}/`);
    return response.data;
  } catch (error) {
    console.error('Error deleting boat:', error);
    throw error;
  }
};

export const archiveBoat = async (id) => {
try {
    const boat = await getBoatById(id);

    // Remove boat_image if it's not a File object
    if (boat.boat_image && typeof boat.boat_image !== 'object') {
      delete boat.boat_image;
    }

    const updateData = {
      ...boat,
      is_active: false,
    };

    // Use FormData for consistency with your updateBoat
    const formData = new FormData();
    Object.keys(updateData).forEach(key => {
      formData.append(key, updateData[key]);
    });

    const response = await api.put(`/boats/${id}/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    console.log('Backend response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error archiving boat:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
};

// Function to get boats by municipality
export const getBoatsByMunicipality = async (municipality) => {
  try {
    const response = await api.get(`/boats/`, {
      params: { municipality }
    });    return response.data;
  } catch (error) {
    console.error('Error fetching boats by municipality:', error);
    throw error;
  }
};

// Function to get boats by type
export const getBoatsByType = async (type) => {
  try {
    const response = await api.get(`/boats/type/${type}/`);
    return response.data;
  } catch (error) {
    console.error('Error fetching boats by type:', error);
    throw error;
  }
};

// Function to get boats by status
export const getBoatsByStatus = async (status) => {
  try {
    const response = await api.get(`/boats/status/${status}/`);
    return response.data;
  } catch (error) {
    console.error('Error fetching boats by status:', error);
    throw error;
  }
};

// Function to update boat GPS location
export const updateBoatLocation = async (id, location) => {
  try {
    const response = await api.patch(`/boats/${id}/location/`, location);
    return response.data;
  } catch (error) {
    console.error('Error updating boat location:', error);
    throw error;
  }
};

// Function to get boat's location history
export const getBoatLocationHistory = async (id, startDate, endDate) => {
  try {
    const response = await api.get(`/boats/${id}/location-history/`, {
      params: { start_date: startDate, end_date: endDate }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching boat location history:', error);
    throw error;
  }
}; 

export const createFisherfolkBoat = async (formData) => {
  try {
    // If you are sending files, use FormData; otherwise, send as JSON
    // Here, we'll assume it's FormData for consistency
    console.log("Sending fisherfolk boat data to backend:", Object.fromEntries(formData.entries()));
    const response = await api.post('/fisherfolkboat/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error creating fisherfolk boat:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
};

export const getFisherfolkBoats = async () => {
  try {
    const response = await api.get('/fisherfolkboat/');
    return response.data;
  } catch (error) {
    console.error('Error fetching fisherfolk boats:', error);
    throw error;
  }
}

export const getFisherfolkBoatById = async (id) => {
  try {
    const response = await api.get(`/fisherfolkboat/${id}/`);
    return response.data;
  } catch (error) {
    console.error('Error fetching fisherfolkboat registration:', error);
    throw error;
  }
};

export const archiveFisherfolkBoat = async (id) => {
  try {
    // Fetch the current registration data
    const registration = await getFisherfolkBoatById(id);

    // Prepare update data, setting is_active to false
    const updateData = {
      ...registration,
      is_active: false,
    };

    // Use FormData for consistency
    const formData = new FormData();
    Object.keys(updateData).forEach(key => {
      formData.append(key, updateData[key]);
    });

    // Send the update request
    const response = await api.put(`/fisherfolkboat/${id}/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error archiving fisherfolk boat:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
};

export const updateFisherfolkBoat = async (id, data) => {
  try {
    console.log(`Updating boat with ID ${id}:`, data instanceof FormData ? Object.fromEntries(data.entries()) : data);

    const response = await api.put(`/fisherfolkboat/${id}/`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating fisherfolk boat:', error);
    throw error;
  }
};
