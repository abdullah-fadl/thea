const FINAL_ER_STATUSES = ['DISCHARGED', 'ADMITTED', 'TRANSFERRED', 'DEATH', 'CANCELLED'] as const;

export function isFinalErStatus(status: string | null | undefined): boolean {
  return (FINAL_ER_STATUSES as readonly string[]).includes(String(status || '').trim().toUpperCase());
}

export function getFinalStatusBlock(status: string | null | undefined, context: string): {
  status: number;
  body: { error: string; status: string | null; context: string };
} | null {
  if (!isFinalErStatus(status)) {
    return null;
  }
  return {
    status: 409,
    body: {
      error: 'Encounter is finalized',
      status: String(status || '') || null,
      context,
    },
  };
}
