module.exports = {
  apps: [{
    name: 'barbershop-platform',
    script: 'npm',
    args: 'start',
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    // Configuración para shutdown limpio
    kill_timeout: 5000, // Espera 5 segundos antes de forzar kill

    // Manejo de errores
    max_restarts: 10, // Máximo 10 reinicios en un minuto
    min_uptime: '10s', // Debe estar up al menos 10 segundos para contar como inicio exitoso

    // Logs
    error_file: '/root/.pm2/logs/barbershop-error.log',
    out_file: '/root/.pm2/logs/barbershop-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

    // Evitar reinicios en cascada
    exp_backoff_restart_delay: 100
  }]
};
