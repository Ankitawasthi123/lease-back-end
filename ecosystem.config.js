/**
 * PM2 Ecosystem Configuration
 *
 * Production start: pm2 start ecosystem.config.js --env production
 * Save & auto-start on boot: pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: 'lease-api',
      script: 'dist/index.js',

      // Run one instance per CPU core for zero-downtime deployment
      instances: 'max',
      exec_mode: 'cluster',

      // Keep the process alive; restart after 3 consecutive crashes
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',

      // Zero-downtime reload
      wait_ready: true,
      listen_timeout: 8000,
      kill_timeout: 5000,

      // Send stdout/stderr to log files
      out_file: '/var/log/lease-api/out.log',
      error_file: '/var/log/lease-api/error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Only set PORT here; all secrets must come from a real .env file
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
    },
  ],
};
