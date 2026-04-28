function isPlainObject(value: any) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

const SAFE_CLINIC_KEY = /^[a-z0-9][a-z0-9-_]*$/i;

export function isSafeClinicKey(value: any) {
  const key = String(value || '').trim();
  if (!key) return false;
  if (key.includes('.') || key.startsWith('$')) return false;
  return SAFE_CLINIC_KEY.test(key);
}

function deepMerge(target: Record<string, any>, source: Record<string, any>) {
  const result: Record<string, any> = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function buildClinicExtensionsPatch(
  existingExtensions: Record<string, any> | null | undefined,
  incomingExtensions: Record<string, any>
) {
  const invalidKeys: string[] = [];
  const patch: Record<string, any> = {};
  const nextExtensions: Record<string, any> = { ...(existingExtensions || {}) };

  for (const [rawKey, value] of Object.entries(incomingExtensions)) {
    const cleanKey = String(rawKey || '').trim();
    if (!isSafeClinicKey(cleanKey)) {
      invalidKeys.push(cleanKey || '(empty)');
      continue;
    }
    if (!isPlainObject(value)) {
      invalidKeys.push(cleanKey);
      continue;
    }
    const existingClinic = isPlainObject(nextExtensions[cleanKey]) ? nextExtensions[cleanKey] : {};
    const merged = deepMerge(existingClinic, value);
    patch[`opdClinicExtensions.${cleanKey}`] = merged;
    nextExtensions[cleanKey] = merged;
  }

  return { invalidKeys, patch, nextExtensions };
}
