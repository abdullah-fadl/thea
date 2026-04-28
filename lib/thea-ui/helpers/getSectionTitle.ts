/**
 * Thea UI Header — Section title resolver
 *
 * Maps the current pathname to a human-readable section title
 * (+ optional subtitle) used by TheaHeader.
 */
export function getSectionTitle(
  pathname: string,
  t: any,
): { title: string; subtitle?: string } {
  const nav = t?.nav || {};

  if (pathname.startsWith('/dashboard'))    return { title: nav.dashboard || 'Dashboard' };
  if (pathname.startsWith('/opd'))          return { title: nav.opd || 'Outpatient', subtitle: 'OPD' };
  if (pathname.startsWith('/er'))           return { title: nav.er || 'Emergency', subtitle: 'ER' };
  if (pathname.startsWith('/ipd'))          return { title: nav.ipd || 'Inpatient', subtitle: 'IPD' };
  if (pathname.startsWith('/billing'))      return { title: nav.billing || 'Billing' };
  if (pathname.startsWith('/admin'))        return { title: nav.admin || 'Administration' };
  if (pathname.startsWith('/orders'))       return { title: nav.orders || nav.ordersHub || 'Orders' };
  if (pathname.startsWith('/results'))      return { title: nav.resultsInbox || 'Results' };
  if (pathname.startsWith('/tasks'))        return { title: nav.tasksQueue || 'Tasks' };
  if (pathname.startsWith('/handover'))     return { title: nav.handover || 'Handover' };
  if (pathname.startsWith('/registration') || pathname.startsWith('/search'))
    return { title: nav.registration || 'Registration' };
  if (pathname.startsWith('/notifications')) return { title: nav.notifications || 'Notifications' };
  if (pathname.startsWith('/quality'))      return { title: nav.quality || 'Quality' };
  if (pathname.startsWith('/referrals'))    return { title: nav.opdReferrals || 'Referrals' };
  if (pathname.startsWith('/sam'))          return { title: 'SAM', subtitle: 'Policy Management' };
  if (pathname.startsWith('/cvision'))     return { title: 'CVision', subtitle: 'HR Operating System' };
  if (pathname.startsWith('/account'))      return { title: nav.account || 'Account' };
  if (pathname.startsWith('/settings'))     return { title: nav.settings || 'Settings' };
  if (pathname.startsWith('/welcome') || pathname.startsWith('/platforms'))
    return { title: 'Thea Health' };

  return { title: 'Thea Health' };
}
