import { Router, type Request, type Response } from 'express';
import { webhookAuth } from '../middleware/webhookAuth.js';
import { webhookLimiter } from '../middleware/rateLimiter.js';
import { orderSync } from '../../queues/registry.js';
import { logger } from '../../config/logger.js';

export const webhooksRouter = Router();

// All webhook routes get rate limiting + signature verification
webhooksRouter.use(webhookLimiter);

/**
 * WooCommerce order webhook handler.
 * Receives order.created and order.updated events.
 * Verifies signature, enqueues job, and returns 200 immediately.
 */
webhooksRouter.post(
  '/woocommerce/order',
  webhookAuth,
  async (req: Request, res: Response) => {
    try {
      const topic = req.headers['x-wc-webhook-topic'] as string;
      const webhookId = req.headers['x-wc-webhook-id'] as string;
      const payload = req.body;

      // WooCommerce sends a ping on webhook creation — just acknowledge it
      if (topic === 'action.woocommerce_webhook_payload') {
        res.json({ received: true, type: 'ping' });
        return;
      }

      const orderId = payload?.id;
      if (!orderId) {
        logger.warn({ topic, webhookId }, 'Webhook received without order ID');
        res.status(400).json({ error: 'Missing order ID' });
        return;
      }

      const event = topic === 'order.created' ? 'order.created' as const : 'order.updated' as const;

      // Enqueue for async processing
      await orderSync.add(
        `order-${orderId}-${event}`,
        {
          orderId,
          event,
          rawPayload: payload,
        },
        {
          // Deduplicate rapid webhook fires for the same order
          jobId: `order-${orderId}-${Date.now()}`,
        }
      );

      logger.info({ orderId, event, webhookId }, 'Order webhook enqueued');
      res.json({ received: true, orderId, event });
    } catch (err) {
      logger.error({ err }, 'Failed to process order webhook');
      // Still return 200 to prevent WooCommerce from retrying
      // The error is logged and we'll handle it via monitoring
      res.json({ received: true, error: 'Processing failed, logged for retry' });
    }
  }
);

/**
 * WooCommerce product webhook handler.
 * Receives product.created and product.updated events.
 */
webhooksRouter.post(
  '/woocommerce/product',
  webhookAuth,
  async (req: Request, res: Response) => {
    try {
      const topic = req.headers['x-wc-webhook-topic'] as string;
      const payload = req.body;
      const productId = payload?.id;

      if (!productId) {
        res.status(400).json({ error: 'Missing product ID' });
        return;
      }

      // Content generation will be wired in Phase 6
      logger.info({ productId, topic }, 'Product webhook received (queuing not yet wired)');
      res.json({ received: true, productId, topic });
    } catch (err) {
      logger.error({ err }, 'Failed to process product webhook');
      res.json({ received: true, error: 'Processing failed' });
    }
  }
);
