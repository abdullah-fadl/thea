// ─── Saudi IBAN Validator ────────────────────────────────────────────────────
// Saudi IBAN format: SA + 2 check digits + 2 bank code + 18 account digits = 24 chars total
// Validation per ISO 13616 / ISO 7064 Modulo 97-10

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SaudiBankInfo {
  nameEn: string;
  swift: string;
}

export interface IBANValidationResult {
  isValid: boolean;
  iban: string;
  formattedIBAN: string;
  errors: string[];
  bankCode?: string;
  bankNameEn?: string;
  bankSwift?: string;
  accountNumber?: string;
}

// ─── Saudi Banks ────────────────────────────────────────────────────────────

export const SAUDI_BANKS: Record<string, SaudiBankInfo> = {
  '10': { nameEn: 'Saudi National Bank (SNB)', swift: 'NCBKSAJE' },
  '15': { nameEn: 'Bank AlBilad', swift: 'ALBISARI' },
  '20': { nameEn: 'Riyad Bank', swift: 'RIBLSARI' },
  '40': { nameEn: 'Banque Saudi Fransi', swift: 'BSFRSARI' },
  '45': { nameEn: 'Saudi British Bank (SABB)', swift: 'SABBSARI' },
  '50': { nameEn: 'Bank AlJazira', swift: 'BJAZSAJE' },
  '55': { nameEn: 'Arab National Bank', swift: 'ARNBSARI' },
  '60': { nameEn: 'Saudi Investment Bank', swift: 'SIBCSARI' },
  '65': { nameEn: 'Al Rajhi Bank', swift: 'RJHISARI' },
  '76': { nameEn: 'Alinma Bank', swift: 'INMASARI' },
  '80': { nameEn: 'Samba Financial Group', swift: 'SAMBSARI' },
  '81': { nameEn: 'Bank AlAwwal', swift: 'ABORIARI' },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Formats an IBAN string with spaces every 4 characters.
 * e.g. "SA0380000000608010167519" → "SA03 8000 0000 6080 1016 7519"
 */
function formatIBAN(iban: string): string {
  return iban.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * ISO 7064 Modulo 97-10 check.
 * Rearranges the IBAN (move first 4 chars to end), converts letters to numbers,
 * and computes mod 97 using chunked arithmetic to handle large numbers.
 * A valid IBAN yields a remainder of 1.
 */
function mod97(iban: string): number {
  // Move first 4 characters to end
  const rearranged = iban.slice(4) + iban.slice(0, 4);

  // Replace each letter with its numeric value (A=10, B=11, ..., Z=35)
  let numericStr = '';
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      // Uppercase letter
      numericStr += (code - 55).toString();
    } else {
      numericStr += ch;
    }
  }

  // Compute mod 97 using chunked processing (to avoid BigInt)
  let remainder = 0;
  for (let i = 0; i < numericStr.length; i += 7) {
    const chunk = numericStr.slice(i, i + 7);
    remainder = parseInt(remainder.toString() + chunk, 10) % 97;
  }

  return remainder;
}

/**
 * Calculates the check digits for a Saudi IBAN given bank code + account number.
 * Sets check digits to "00", computes mod 97, then derives the correct digits.
 */
function calculateCheckDigits(bankCode: string, accountNumber: string): string {
  const provisional = 'SA00' + bankCode + accountNumber;
  const remainder = mod97(provisional);
  const checkDigits = (98 - remainder).toString().padStart(2, '0');
  return checkDigits;
}

// ─── Validators ─────────────────────────────────────────────────────────────

/**
 * Validates a Saudi IBAN string.
 *
 * Performs the following checks:
 * 1. Cleans input (removes spaces, dashes, converts to uppercase)
 * 2. Length must be exactly 24 characters
 * 3. Must start with "SA"
 * 4. Characters after "SA" must be digits only
 * 5. Bank code (positions 4-5) must be a known Saudi bank
 * 6. ISO 7064 Modulo 97 checksum must equal 1
 */
export function validateSaudiIBAN(iban: string): IBANValidationResult {
  const errors: string[] = [];

  // Clean input
  const cleaned = iban.replace(/[\s\-]/g, '').toUpperCase();

  // Build a default result to return early if needed
  const baseResult: IBANValidationResult = {
    isValid: false,
    iban: cleaned,
    formattedIBAN: formatIBAN(cleaned),
    errors,
  };

  // 1. Check length
  if (cleaned.length !== 24) {
    errors.push(`IBAN must be exactly 24 characters (got ${cleaned.length})`);
  }

  // 2. Check country code
  if (!cleaned.startsWith('SA')) {
    errors.push('Saudi IBAN must start with "SA"');
  }

  // 3. Check that characters after "SA" are all digits
  if (cleaned.length >= 3) {
    const afterCountry = cleaned.slice(2);
    if (!/^\d+$/.test(afterCountry)) {
      errors.push('IBAN must contain only digits after the country code "SA"');
    }
  }

  // If basic format is wrong, return early
  if (errors.length > 0) {
    return baseResult;
  }

  // 4. Extract and validate bank code
  const bankCode = cleaned.slice(4, 6);
  const bank = SAUDI_BANKS[bankCode];

  if (!bank) {
    errors.push(`Unknown bank code "${bankCode}". Not a recognized Saudi bank.`);
  }

  // 5. Extract account number
  const accountNumber = cleaned.slice(6);

  // 6. Validate check digits (ISO 7064 Mod 97)
  const remainder = mod97(cleaned);
  if (remainder !== 1) {
    errors.push('Invalid IBAN check digits. Please verify the number is correct.');
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    iban: cleaned,
    formattedIBAN: formatIBAN(cleaned),
    errors,
    bankCode: bankCode,
    bankNameEn: bank?.nameEn,
    bankSwift: bank?.swift,
    accountNumber: accountNumber,
  };
}

/**
 * Generates a valid Saudi IBAN from a bank code and account number.
 * Pads the account number to 18 digits and calculates valid check digits.
 *
 * @param bankCode - 2-digit Saudi bank code (e.g. "65" for Al Rajhi)
 * @param accountNumber - Account number (will be padded to 18 digits)
 * @returns A valid 24-character Saudi IBAN string
 */
export function generateSaudiIBAN(bankCode: string, accountNumber: string): string {
  // Validate bank code
  if (!/^\d{2}$/.test(bankCode)) {
    throw new Error('Bank code must be exactly 2 digits');
  }
  if (!SAUDI_BANKS[bankCode]) {
    throw new Error(`Unknown bank code "${bankCode}"`);
  }

  // Clean and pad account number
  const cleanedAccount = accountNumber.replace(/\D/g, '');
  if (cleanedAccount.length === 0) {
    throw new Error('Account number must contain at least one digit');
  }
  if (cleanedAccount.length > 18) {
    throw new Error('Account number cannot exceed 18 digits');
  }

  const paddedAccount = cleanedAccount.padStart(18, '0');
  const checkDigits = calculateCheckDigits(bankCode, paddedAccount);

  return 'SA' + checkDigits + bankCode + paddedAccount;
}

/**
 * Returns a sorted list of Saudi banks for use in dropdown menus.
 * Sorted alphabetically by English name.
 */
export function getSaudiBankList(): Array<{
  code: string;
  nameEn: string;
  swift: string;
}> {
  return Object.entries(SAUDI_BANKS)
    .map(([code, info]) => ({
      code,
      nameEn: info.nameEn,
      swift: info.swift,
    }))
    .sort((a, b) => a.nameEn.localeCompare(b.nameEn));
}

/**
 * Basic validation for a bank account number (without IBAN).
 * Checks that it contains only digits and is between 10-18 characters.
 */
export function validateBankAccountNumber(accountNumber: string): {
  isValid: boolean;
  cleaned: string;
  errors: string[];
} {
  const errors: string[] = [];
  const cleaned = accountNumber.replace(/[\s\-]/g, '');

  if (cleaned.length === 0) {
    errors.push('Account number is required');
    return { isValid: false, cleaned, errors };
  }

  if (!/^\d+$/.test(cleaned)) {
    errors.push('Account number must contain only digits');
  }

  if (cleaned.length < 10) {
    errors.push(`Account number is too short (minimum 10 digits, got ${cleaned.length})`);
  }

  if (cleaned.length > 18) {
    errors.push(`Account number is too long (maximum 18 digits, got ${cleaned.length})`);
  }

  return {
    isValid: errors.length === 0,
    cleaned,
    errors,
  };
}
