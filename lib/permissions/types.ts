/**
 * Permission type definition
 */
export interface Permission {
  key: string;
  label: string;
  labelAr?: string;  // Arabic label for bilingual admin UI
  category: string;
  group?: string;    // permissions with same group are toggled together in admin UI
  hidden?: boolean;  // hidden permissions don't show as separate rows in admin UI
}
