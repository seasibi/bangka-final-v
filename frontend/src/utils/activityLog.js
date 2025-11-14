import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true
});

// Since we're using HttpOnly cookies, they'll be sent automatically with withCredentials: true

/**
 * Log a new activity to the backend
 * @param {Object} activity - { action: string, description: string, timestamp: string|Date }
 * action: High-level category (e.g., "Fisherfolk Management", "Boat Registry")
 * description: Specific details (e.g., "Retrieved all fisherfolk records")
 */
export async function logActivity(activity) {
  try {
    const payload = {
      action: activity.action || activity.type || 'Unknown',
      description: activity.description || activity.message || '',
      timestamp: activity.timestamp ? new Date(activity.timestamp).toISOString() : new Date().toISOString()
    };
    console.log('Logging activity:', payload);
    await api.post('/activitylog/', payload);
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw - activity logging shouldn't break the app
  }
}

/**
 * Get recent activities from the backend
 * @param {number} count - Number of recent activities to return
 * @returns {Promise<Array>}
 */
export async function getRecentActivities(count = 5) {
  const res = await api.get(`/activitylog/?count=${count}`);
  // Optionally, you can log the activities to the console for verification
  console.log('Recent Activities:', res.data);
  return res.data;
}

export async function getActivities() {
  const res = await api.get(`/activitylog/`);
  // Optionally, you can log the activities to the console for verification
  console.log(' Activities:', res.data);
  return res.data;
}

/**
 * Clear all activities (if supported by backend, otherwise no-op)
 */
export async function clearActivityLog() {
  // Optionally implement if backend supports it
  // await api.delete('/activity-log/');
}
