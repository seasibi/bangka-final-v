import axios from 'axios';
import { getRecentActivities } from '../utils/activityLog';

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

export const getDashboardStats = async (startDate = null, endDate = null) => {
  try {
    const [fisherfolk, boats] = await Promise.all([
      api.get('/fisherfolk/'),
      api.get('/boats/'),
      // api.get('/tracker/')
    ]);


    // Filter data by date range if provided
    let filteredFisherfolk = fisherfolk.data;
    let filteredBoats = boats.data;
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include end date
      
      filteredFisherfolk = fisherfolk.data.filter(f => {
        const createdDate = new Date(f.date_added || f.created_at);
        return createdDate >= start && createdDate <= end;
      });
      
      filteredBoats = boats.data.filter(b => {
        const createdDate = new Date(b.date_added || b.created_at);
        return createdDate >= start && createdDate <= end;
      });
    }
    
    const activeFisherfolk = filteredFisherfolk.filter(f => f.is_active).length;
    console.log("activeFisherfolk", activeFisherfolk, "dateRange:", startDate, "to", endDate)
    const totalFisherfolk = filteredFisherfolk.length;
    console.log("totalFisherfolk", totalFisherfolk)
    const activeBoats = filteredBoats.filter(b => b.is_active).length;
    console.log("activeBoats", activeBoats)
    const totalBoats = filteredBoats.length;
    console.log("totalBoats", totalBoats)
    // const availableTrackers = trackers.data.filter(t => t.status.toLowerCase() === 'available').length;
    //     console.log("availableTrackers", availableTrackers)
    // const totalTrackers = trackers.data.length;
    //     console.log("totalTrackers", totalTrackers)


    // Calculate percentage changes (mock data for now - you can implement real historical data comparison)
    const fisherfolkChange = ((activeFisherfolk / totalFisherfolk) * 100) - 100;
    const boatsChange = ((activeBoats / totalBoats) * 100) - 100;
    // const trackersChange = ((availableTrackers / totalTrackers) * 100) - 100;


    return {
      fisherfolk: {
        total: totalFisherfolk,
        active: activeFisherfolk,
        change: Math.round(fisherfolkChange)
      },
      boats: {
        total: totalBoats,
        active: activeBoats,
        change: Math.round(boatsChange)
      },
      // trackers: {
      //   total: totalTrackers,
      //   available: availableTrackers,
      //   change: Math.round(trackersChange)
      // },
      quickStats: {
        activeFisherfolkPercentage: Math.round((activeFisherfolk / totalFisherfolk) * 100),
        activeBoatsPercentage: Math.round((activeBoats / totalBoats) * 100),
        // trackerSignalPercentage: Math.round((availableTrackers / totalTrackers) * 100)
      }
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    throw error;
  }
};


export const getRecentActivity = async () => {
  try {
    // Fetch recent activities from backend activity log
    const activities = await getRecentActivities(4);
    console.log('Recent Activities:', activities);
    return activities;
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    throw error;
  }
};


export const getMunicipalityDashboardStats = async (municipality, startDate = null, endDate = null) => {
  try {
    const [fisherfolk, boats/*, trackers*/] = await Promise.all([
      api.get('/fisherfolk/'),
      api.get('/boats/'),
      // api.get('/tracker/')
    ]);
    console.log('Fetched fisherfolk:', fisherfolk.data);

  // Filter by municipality (nested address)
  let filteredFisherfolk = fisherfolk.data.filter(f => f.address?.municipality === municipality);
  let filteredBoats = boats.data.filter(b => b.fisherfolk?.address?.municipality === municipality);
  
  // Filter by date range if provided
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Include end date
    
    filteredFisherfolk = filteredFisherfolk.filter(f => {
      const createdDate = new Date(f.date_added || f.created_at);
      return createdDate >= start && createdDate <= end;
    });
    
    filteredBoats = filteredBoats.filter(b => {
      const createdDate = new Date(b.date_added || b.created_at);
      return createdDate >= start && createdDate <= end;
    });
  }
    // const filteredTrackers = trackers.data.filter(t => t.municipality === municipality);

    const activeFisherfolk = filteredFisherfolk.filter(f => f.is_active).length;
    const totalFisherfolk = filteredFisherfolk.length;
    const activeBoats = filteredBoats.filter(b => b.is_active).length;
    const totalBoats = filteredBoats.length;
    // const availableTrackers = filteredTrackers.filter(t => t.status.toLowerCase() === 'available').length;
    // const totalTrackers = filteredTrackers.length;

    return {
      fisherfolk: {
        total: totalFisherfolk,
        active: activeFisherfolk,
      },
      boats: {
        total: totalBoats,
        active: activeBoats,
      },
      // trackers: {
      //   total: totalTrackers,
      //   available: availableTrackers,
      // },
      quickStats: {
        activeFisherfolkPercentage: totalFisherfolk ? Math.round((activeFisherfolk / totalFisherfolk) * 100) : 0,
        activeBoatsPercentage: totalBoats ? Math.round((activeBoats / totalBoats) * 100) : 0,
        // trackerSignalPercentage: totalTrackers ? Math.round((availableTrackers / totalTrackers) * 100) : 0
      },
      fisherfolkList: filteredFisherfolk,
      boatList: filteredBoats,
      // trackerList: filteredTrackers,
    };
  } catch (error) {
    console.error('Error fetching municipality dashboard stats:', error);
    throw error;
  }
};