// Configuración de la API
// IMPORTANTE: Reemplaza esta URL con la dirección de tu servidor
export const API_CONFIG = {
  // Para desarrollo local desde emulador Android: 'http://10.0.2.2:80'
  // Para desarrollo local desde dispositivo físico: 'http://TU_IP_LOCAL:80'
  // Para producción: 'https://tu-dominio.com'
  BASE_URL: 'http://10.0.2.2:80', // Cambiar según tu configuración
  SOCKET_URL: 'http://10.0.2.2:80',
  TIMEOUT: 30000,
};

// Endpoints de la API
export const ENDPOINTS = {
  // Autenticación
  LOGIN_ADMIN: '/api/admin/auth/login',
  LOGIN_BARBERSHOP: '/api/barbershop/auth/login',
  LOGIN_BARBER: '/api/barber/auth/login',
  REGISTER_BARBERSHOP: '/api/barbershop/auth/register',

  // Admin
  ADMIN_DASHBOARD: '/api/admin/dashboard',
  ADMIN_BARBERSHOPS: '/api/admin/barbershops',
  ADMIN_BILLING: '/api/admin/billing',

  // Barbershop
  BARBERSHOP_DASHBOARD: '/api/barbershop/dashboard',
  BARBERSHOP_BARBERS: '/api/barbershop/barbers',
  BARBERSHOP_SCHEDULES: '/api/barbershop/schedules',
  BARBERSHOP_APPOINTMENTS: '/api/barbershop/appointments',
  BARBERSHOP_WHATSAPP: '/api/barbershop/whatsapp',

  // Barber
  BARBER_DASHBOARD: '/api/barber/dashboard',
  BARBER_QUEUE: '/api/barber/queue',
  BARBER_APPOINTMENTS: '/api/barber/appointments',
  BARBER_SCHEDULE: '/api/barber/schedule',
};
