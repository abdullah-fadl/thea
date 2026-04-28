/**
 * Phase 7.4 + 7.5 — Event schema barrel
 *
 * Single boot-time entry point that registers every domain event type used
 * across all platforms. Importing this file triggers the `registerEventType()`
 * side-effects in each per-platform schema module.
 *
 * Usage: import this file ONCE at app boot — not per-request — so the
 * registry is populated before any handler attempts to call `emit()`.
 *
 * Order is significant only insofar as duplicate (eventName, version) keys
 * throw at registration time; module-load order is otherwise immaterial.
 */

import './thea-health';
import './cvision';
import './imdad';
import './sam';
import './clinical-alerts';
import './clinical-flow';

export {};
