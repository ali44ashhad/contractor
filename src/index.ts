import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDatabase } from './config/database';
import apiRoutes from './routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3000;

// Cookie parser should be before CORS (matching worker-community pattern)
app.use(cookieParser());

// CORS configuration - use simple array like worker-community
// Support multiple origins for development and production
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'https://contractror-frontend.vercel.app'];

// Simple CORS configuration like worker-community
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Explicit OPTIONS handler for ALL paths (critical for mobile browsers)
// This matches the worker-community pattern that works on mobile
app.options(/^.*$/, cors({ origin: true, credentials: true }));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// API info route
app.get('/api', (req: Request, res: Response) => {
  res.json({ 
    message: 'Welcome to the Construction API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      projects: '/api/projects',
      teams: '/api/teams',
      documents: '/api/documents',
      reports: '/api/reports'
    }
  });
});

// API routes
app.use('/api', apiRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ 
    success: false,
    error: {
      message: 'Route not found',
      statusCode: 404
    }
  });
});

// Global error handler (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDatabase();
    
    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

