import { Router } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import projectRoutes from './projectRoutes';
import teamRoutes from './teamRoutes';
import reportRoutes from './reportRoutes';
import updateRoutes from './updateRoutes';

const router = Router();

/**
 * API Routes
 */
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/projects', projectRoutes);
router.use('/teams', teamRoutes);
router.use('/reports', reportRoutes);
router.use('/updates', updateRoutes);

export default router;

