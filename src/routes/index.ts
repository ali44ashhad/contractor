import { Router } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import projectRoutes from './projectRoutes';
import teamRoutes from './teamRoutes';
import reportRoutes from './reportRoutes';
import updateRoutes from './updateRoutes';
import attendanceRoutes from './attendanceRoutes';
import requestRoutes from './requestRoutes';
import dashboardRoutes from './dashboardRoutes';

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
router.use('/attendance', attendanceRoutes);
router.use('/requests', requestRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;

