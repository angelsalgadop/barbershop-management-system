import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_CONFIG} from '../config/api';

// Crear instancia de axios
const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token a las peticiones
api.interceptors.request.use(
  async config => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error al obtener token:', error);
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  },
);

// Interceptor para manejar respuestas y errores
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // Token expirado o inválido, limpiar almacenamiento
      await AsyncStorage.multiRemove(['token', 'user', 'userType']);
      // Aquí podrías navegar al login si tienes acceso a la navegación
    }
    return Promise.reject(error);
  },
);

export default api;

// Funciones de utilidad
export const setAuthToken = async token => {
  if (token) {
    await AsyncStorage.setItem('token', token);
  } else {
    await AsyncStorage.removeItem('token');
  }
};

export const getAuthToken = async () => {
  return await AsyncStorage.getItem('token');
};

export const clearAuth = async () => {
  await AsyncStorage.multiRemove(['token', 'user', 'userType']);
};
