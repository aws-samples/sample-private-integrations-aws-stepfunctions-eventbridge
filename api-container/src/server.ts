import express, { Request, Response, NextFunction } from 'express';
import os from 'os';

const app = express();
const port: number = process.env.PORT ? parseInt(process.env.PORT) : 80;

// Interface definitions
interface MainResponse {
  message: string;
  timestamp: string;
  environment: string;
}

interface ErrorResponse {
  error: string;
}

// Middleware to check for API key
const authenticateApiKey = (req: Request, res: Response<ErrorResponse>, next: NextFunction) => {
  const apiKey = req.header('x-api-key');
  
  if (!apiKey || apiKey !== '1234567890') {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  
  next();
  return;
};

// Health check endpoint - no authentication required, just returns 200
app.get('/health', (_req: Request, res: Response) => {
  res.sendStatus(200);
});

// Apply authentication middleware to all routes AFTER the health endpoint
app.use(authenticateApiKey);

app.get('/', (_req: Request, res: Response<MainResponse>) => {
  res.json({
    message: 'Successfully processed the reviews',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;