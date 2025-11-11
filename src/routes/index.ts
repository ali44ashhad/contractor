import { Router } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import projectRoutes from './projectRoutes';
import teamRoutes from './teamRoutes';
import documentRoutes from './documentRoutes';
import reportRoutes from './reportRoutes';

const router = Router();

/**
 * API Routes
 */
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/projects', projectRoutes);
router.use('/teams', teamRoutes);
router.use('/documents', documentRoutes);
router.use('/reports', reportRoutes);

export default router;

