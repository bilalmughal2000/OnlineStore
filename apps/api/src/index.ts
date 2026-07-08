import { createApp } from './app';
import { env } from './env';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`🚀 API listening on http://localhost:${env.port}`);
  console.log(`   Docs:   http://localhost:${env.port}/docs`);
  console.log(`   Health: http://localhost:${env.port}/api/health`);
});

// Graceful shutdown for PM2 / SIGTERM on the VPS.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    console.log(`\n${sig} received, shutting down...`);
    server.close(() => process.exit(0));
  });
}
