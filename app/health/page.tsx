import { redirect } from 'next/navigation';

// Phase 1: Health root route exists, but Health pages are not moved yet.
// Keep behavior minimal: send Health selection to the existing Health landing.
export default function HealthRoot() {
  redirect('/platforms/thea-health');
}

