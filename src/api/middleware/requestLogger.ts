import pinoHttp from 'pino-http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { logger } from '../../config/logger.js';

export const requestLogger = pinoHttp({
  logger,
  autoLogging: {
    ignore(req: IncomingMessage) {
      return req.url === '/health';
    },
  },
  customProps(_req: IncomingMessage, _res: ServerResponse) {
    return { context: 'http' };
  },
});
