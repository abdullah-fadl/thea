/**
 * CVision Lifecycle Integration Layer
 *
 * Central module that wires all 73+ CVision systems together.
 * Each lifecycle hook orchestrates multiple existing engines
 * so API endpoints only need to add a single function call.
 */

export { initializeLifecycle } from './init';
export { onEmployeeCreated } from './employee-created';
export { onEmployeeDeparted } from './employee-departed';
export { onRequestCreated, onRequestApproved, onRequestRejected } from './request-lifecycle';
export { onTrainingCompleted } from './training-completed';
export { onPromotionApproved } from './promotion-lifecycle';
