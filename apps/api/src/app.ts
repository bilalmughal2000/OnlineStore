import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { env } from './env';
import { apiRouter } from './routes';
import { globalLimiter } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/error';
import { openApiDocument } from './openapi';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => {
        // Allow non-browser clients (no origin) and whitelisted origins.
        if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: origin ${origin} not allowed`));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  if (!env.isProd) app.use(morgan('dev'));
  app.use(globalLimiter);

  app.use('/api', apiRouter);
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
