/**
 * Real-time Infrastructure — barrel exports
 *
 * Provides Redis-backed Pub/Sub and SSE stream management for Thea EHR.
 */

// Pub/Sub
export {
  publishEvent,
  subscribeToTenant,
  unsubscribeAll,
  type RealtimeEvent,
  type RealtimeEventCallback,
} from './pubsub';

// SSE Manager
export {
  createSSEStream,
  broadcastToTenant,
  getActiveConnectionCount,
  type CreateSSEStreamOptions,
} from './sseManager';
