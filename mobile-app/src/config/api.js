// Configuración de la API
export const API_CONFIG = {
  BASE_URL: 'https://mibarberiaweb.com',
  SOCKET_URL: 'https://mibarberiaweb.com',
  TIMEOUT: 30000,
};

// Endpoints de la API
export const ENDPOINTS = {
  // Autenticación
  LOGIN: '/api/auth/login',
  REGISTER_BARBERSHOP: '/api/auth/register-barbershop',

  // Admin
  ADMIN_BARBERSHOPS: '/api/barbershops',
  ADMIN_BILLING: '/api/billing',

  // Barbershops (requieren barbershopId)
  BARBERSHOPS_BASE: '/api/barbershops',
  BARBERSHOPS_STATS: (barbershopId) => `/api/barbershops/${barbershopId}/stats`,

  // Barbers (requieren barbershopId o barberId)
  BARBERS_BY_BARBERSHOP: (barbershopId) => `/api/barbers/barbershop/${barbershopId}`,
  BARBER_DETAIL: (barberId) => `/api/barbers/${barberId}`,
  BARBER_SCHEDULE: (barberId) => `/api/barbers/${barberId}/schedule`,
  BARBER_SCHEDULE_DAY: (barberId, day) => `/api/barbers/${barberId}/schedule/${day}`,

  // Appointments (requieren barbershopId o barberId)
  APPOINTMENTS_BY_BARBERSHOP: (barbershopId) => `/api/appointments/barbershop/${barbershopId}`,
  APPOINTMENTS_BY_BARBER: (barberId, date) => `/api/appointments/barber/${barberId}/${date}`,
  APPOINTMENT_BOOK: '/api/appointments/book',
  APPOINTMENT_DETAIL: (appointmentId) => `/api/appointments/${appointmentId}`,
  APPOINTMENT_START: (appointmentId) => `/api/appointments/${appointmentId}/start`,
  APPOINTMENT_COMPLETE: (appointmentId) => `/api/appointments/${appointmentId}/complete`,
  APPOINTMENT_CANCEL: (appointmentId) => `/api/appointments/${appointmentId}/cancel`,
  APPOINTMENT_CALL_NEXT: (appointmentId) => `/api/appointments/${appointmentId}/call-next`,

  // WhatsApp (requieren barbershopId)
  WHATSAPP_INIT: (barbershopId) => `/api/whatsapp/init/${barbershopId}`,
  WHATSAPP_STATUS: (barbershopId) => `/api/whatsapp/status/${barbershopId}`,
  WHATSAPP_DISCONNECT: (barbershopId) => `/api/whatsapp/disconnect/${barbershopId}`,

  // Billing
  BILLING_LIST: '/api/billing',
  BILLING_DETAIL: (billingId) => `/api/billing/${billingId}`,
};
