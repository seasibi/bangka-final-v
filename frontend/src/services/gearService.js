import axios from 'axios';
import { logActivity } from '../utils/activityLog';

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

export const getGearTypes = async () => {
  const response = await api.get("/gear-types/");
  return response.data;
};

export const getGearSubtypes = async () => {
  const response = await api.get("/gear-subtypes/");
  return response.data;
};
