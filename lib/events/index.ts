// Side-effect import: registers all platform domain event schemas at module load.
// Must precede any export that consumers will import — keeps the registry
// populated before the first emit() call.
import './schemas';

export { emit } from './emit';
export type { EmitArgs, EmitResult } from './emit';

export { subscribe, startEventBus, stopEventBus } from './subscribe';
export type { EventEnvelope, EventHandler, SubscribeSpec, AckNack } from './subscribe';

export { registerEventType, getSchema, listRegisteredEvents, EventNotRegistered } from './registry';
export type { EventSchema } from './registry';

export {
  registerProjection,
  getProjectionState,
  rebuildProjection,
  listProjections,
  ProjectionsDisabled,
  DEFAULT_SNAPSHOT_EVERY,
} from './projections/framework';
export type {
  Projection,
  ProjectionEventEnvelope,
  RebuildReport,
} from './projections/framework';
