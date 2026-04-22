type OpdStatusLabel = 'BOOKED' | 'ARRIVED' | 'CHECKED_IN';

export function deriveOpdStatus(params: {
  checkedInAt?: Date | string | null;
  arrivedAt?: Date | string | null;
}): OpdStatusLabel {
  const checkedIn = params.checkedInAt ? new Date(params.checkedInAt) : null;
  if (checkedIn && !Number.isNaN(checkedIn.getTime())) return 'CHECKED_IN';
  const arrived = params.arrivedAt ? new Date(params.arrivedAt) : null;
  if (arrived && !Number.isNaN(arrived.getTime())) return 'ARRIVED';
  return 'BOOKED';
}
