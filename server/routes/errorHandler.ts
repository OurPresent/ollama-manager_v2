import type { Response } from 'express';
import { ZodError } from 'zod';

export const handleRouteError = (error: unknown, res: Response): void => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: error.issues });
    return;
  }
  res.status(500).json({ error: 'Internal server error' });
};
