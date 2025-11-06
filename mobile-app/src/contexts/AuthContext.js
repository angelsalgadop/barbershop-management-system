import React, {createContext, useState, useEffect, useContext} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, {setAuthToken, clearAuth} from '../services/api';
import {ENDPOINTS} from '../config/api';
import socketService from '../services/socket';

const AuthContext = createContext({});

export const AuthProvider = ({children}) => {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null); // 'admin', 'barbershop', 'barber'
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Verificar si hay una sesión guardada al iniciar
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const savedUser = await AsyncStorage.getItem('user');
      const savedUserType = await AsyncStorage.getItem('userType');

      if (token && savedUser && savedUserType) {
        setUser(JSON.parse(savedUser));
        setUserType(savedUserType);
        setIsAuthenticated(true);
        // Conectar socket en segundo plano (no bloquear el login)
        socketService.connect().catch(err => {
          console.error('Error al conectar socket en checkAuth:', err);
        });
      }
    } catch (error) {
      console.error('Error al verificar autenticación:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials, type) => {
    try {
      // El servidor espera email, password y role en el body
      const response = await api.post(ENDPOINTS.LOGIN, {
        ...credentials,
        role: type, // 'admin', 'barbershop', 'barber'
      });

      // El servidor devuelve { token, user } directamente
      if (response.data && response.data.token) {
        const {token, user: userData} = response.data;

        // Guardar token
        await setAuthToken(token);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        await AsyncStorage.setItem('userType', type);

        setUser(userData);
        setUserType(type);
        setIsAuthenticated(true);

        // Conectar socket en segundo plano (no bloquear el login)
        socketService.connect().catch(err => {
          console.error('Error al conectar socket en login:', err);
        });

        return {success: true, user: userData};
      } else {
        return {success: false, message: response.data.message};
      }
    } catch (error) {
      console.error('Error en login:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al iniciar sesión',
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.post(ENDPOINTS.REGISTER_BARBERSHOP, userData);

      if (response.data.success) {
        return {success: true, message: 'Registro exitoso'};
      } else {
        return {success: false, message: response.data.message};
      }
    } catch (error) {
      console.error('Error en registro:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al registrar',
      };
    }
  };

  const logout = async () => {
    try {
      // Desconectar socket
      socketService.disconnect();

      // Limpiar autenticación
      await clearAuth();

      setUser(null);
      setUserType(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error en logout:', error);
    }
  };

  const updateUser = async (userData) => {
    try {
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userType,
        loading,
        isAuthenticated,
        login,
        register,
        logout,
        updateUser,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

export default AuthContext;
