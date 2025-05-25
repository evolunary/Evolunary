/**
 * Evolunary API Router
 * Combines all Evolunary route modules into a unified API interface.
 * @module evolunary/api
 */

import { Router } from 'express';
import authRoutes from './routes/auth';
import agentRoutes from './routes/agents';
import userRoutes from './routes/users';
import swarmRoutes from './routes/swarm';

const evolunaryRouter = Router();

// Mount Evolunary route modules
evolunaryRouter.use('/auth', authRoutes);
evolunaryRouter.use('/agents', agentRoutes);
evolunaryRouter.use('/user', userRoutes);
evolunaryRouter.use('/swarm', swarmRoutes);

export default evolunaryRouter;
