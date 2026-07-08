// PM2 process manager config for the VPS.
// Usage: pm2 start deploy/ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: 'store-api',
      cwd: './apps/api',
      script: 'dist/index.js',
      node_args: '--env-file=../../.env',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '400M',
    },
    {
      name: 'store-storefront',
      cwd: './apps/storefront',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '500M',
    },
    // The admin SPA is a static build (apps/admin/dist) — serve it via Nginx,
    // not PM2. See deploy/nginx.conf.
  ],
};
