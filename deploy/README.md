# Deployment (VPS — Hostinger / GoDaddy)

This app targets a **VPS or Cloud Hosting** tier with root/SSH access. Basic shared/cPanel hosting cannot run Node/Postgres/Redis and will not work.

## Recommended spec
4 GB RAM / 2 vCPU minimum (Node API + Next.js SSR + Postgres + Redis on one box). Offload Postgres/Redis to managed tiers (Supabase/Neon, Upstash) if RAM is tight.

## One-time server setup
```bash
sudo apt update && sudo apt install -y nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - && sudo apt install -y nodejs
sudo npm i -g pm2
# Postgres + Redis: apt/docker locally, or use managed URLs in .env
```

## Deploy
```bash
git clone <repo> /var/www/store && cd /var/www/store
cp .env.example .env      # fill in production secrets, DB/Redis URLs, gateway keys
npm ci
npm run build             # builds packages + api + storefront + admin
npm run db:migrate:deploy -w @store/database

pm2 start deploy/ecosystem.config.cjs
pm2 save && pm2 startup

sudo cp deploy/nginx.conf /etc/nginx/sites-available/store
sudo ln -s /etc/nginx/sites-available/store /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## SSL
Use Cloudflare (proxy DNS, free SSL) **or** Certbot: `sudo certbot --nginx`.

## Backups (cron)
```bash
# nightly pg_dump to Backblaze/S3
0 2 * * * pg_dump "$DATABASE_URL" | gzip > /backups/store-$(date +\%F).sql.gz
```

## CI/CD
`.github/workflows/deploy.yml` builds + typechecks on push, then (with SSH secrets configured) can `git pull && npm ci && npm run build && pm2 reload all` on the VPS.
