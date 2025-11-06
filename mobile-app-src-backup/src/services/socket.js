import io from 'socket.io-client';
import {API_CONFIG} from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = {};
  }

  async connect() {
    try {
      const token = await AsyncStorage.getItem('token');

      this.socket = io(API_CONFIG.SOCKET_URL, {
        transports: ['websocket'],
        auth: {
          token,
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });

      this.socket.on('connect', () => {
        console.log('Socket conectado:', this.socket.id);
      });

      this.socket.on('disconnect', () => {
        console.log('Socket desconectado');
      });

      this.socket.on('error', error => {
        console.error('Error de socket:', error);
      });

      return this.socket;
    } catch (error) {
      console.error('Error al conectar socket:', error);
      throw error;
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
      // Guardar referencia para poder eliminar después
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
      // Eliminar de listeners
      if (this.listeners[event]) {
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
      }
    }
  }

  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  removeAllListeners(event) {
    if (this.socket) {
      this.socket.removeAllListeners(event);
      delete this.listeners[event];
    }
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

export default new SocketService();
