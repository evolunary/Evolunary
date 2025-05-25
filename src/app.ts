/**
 * Evolunary Application Entry Point
 * Initializes the Express server, middleware, routes, and shutdown hooks.
 * @module evolunary/app
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import evolunaryRouter from './api';
import { swarmManager } from './swarm';
import { initializeDatabase } from './utils/db-init';

// Create Express application
const app = express();

// CORS policy
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
}));

// Core middleware
app.use(express.json());
app.use(cookieParser());

// API namespace
app.use('/api/v1', evolunaryRouter);

// Generic error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Unexpected server error' });
});

// Graceful shutdown hooks
process.on('SIGTERM', async () => {
  console.log('[Evolunary] SIGTERM received. Cleaning up...');
  await swarmManager.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Evolunary] SIGINT received. Cleaning up...');
  await swarmManager.shutdown();
  process.exit(0);
});

// App startup
async function startServer() {
  try {
    await initializeDatabase();
    const PORT = process.env.PORT || 3005;
    app.listen(PORT, () => {
      console.log(`[Evolunary] Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('[Evolunary] Startup failed:', error);
    process.exit(1);
  }
}

startServer();

export default app;
