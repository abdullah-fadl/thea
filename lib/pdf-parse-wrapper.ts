/**
 * Wrapper for pdf-parse to handle CommonJS/ES module interop issues
 * Using a workaround for Next.js webpack bundling issues
 */

import { logger } from '@/lib/monitoring/logger';

let pdfParseFn: ((buffer: Buffer) => Promise<{ text: string; numpages: number }>) | null = null;

type PdfParseFunction = (buffer: Buffer) => Promise<{ text: string; numpages: number }>;

export async function getPdfParse() {
  if (pdfParseFn) {
    return pdfParseFn;
  }

  try {
    // Method 1: Try dynamic import (standard way)
    let pdfParseModule: Record<string, unknown>;
    try {
      pdfParseModule = await import('pdf-parse') as Record<string, unknown>;
      logger.debug('pdf-parse module imported', { category: 'system', moduleType: typeof pdfParseModule, moduleKeys: Object.keys(pdfParseModule || {}) });
    } catch (importError: unknown) {
      logger.error('pdf-parse direct import failed', { category: 'system', error: importError });
      throw importError;
    }
    
    // Try to extract the function from the module
    // Next.js webpack may wrap CommonJS modules differently
    
    // List of known classes/exceptions to ignore (they start with capital letters)
    const classesToIgnore = new Set([
      'AbortException', 'FormatError', 'InvalidPDFException', 'PasswordException',
      'ResponseException', 'UnknownErrorException', 'Line', 'LineStore', 'Point',
      'Rectangle', 'Shape', 'Table', 'LineDirection', 'VerbosityLevel', 'getException',
      'PDFParse' // PDFParse might be a class too
    ]);
    
    // Check 1: default export (highest priority - this is usually where pdf-parse function is)
    if (pdfParseModule.default) {
      const defaultVal = pdfParseModule.default;
      const defaultType = typeof defaultVal;
      logger.debug(`pdf-parse default type: ${defaultType}`, { category: 'system' });
      
      if (defaultType === 'function') {
        pdfParseFn = defaultVal as PdfParseFunction;
        logger.debug('Found pdf-parse at .default (function)', { category: 'system' });
      } else if (defaultType === 'object' && defaultVal) {
        // default is an object, search inside it
        logger.debug('pdf-parse default is object, searching inside', { category: 'system' });
        const defaultObj = defaultVal as Record<string, unknown>;
        const defaultKeys = Object.keys(defaultObj);
        logger.debug('pdf-parse default keys', { category: 'system', defaultKeys });

        for (const key of defaultKeys) {
          const value = defaultObj[key];
          const valueType = typeof value;
          logger.debug(`pdf-parse default.${key}: type=${valueType}`, { category: 'system' });

          // Ignore classes and look for a function that's not a class
          if (valueType === 'function' && !classesToIgnore.has(key)) {
            // Check if it's a class (has prototype.constructor)
            const fn = value as Function & { prototype?: { constructor?: unknown } };
            const isClass = fn.prototype && fn.prototype.constructor === fn;
            if (!isClass) {
              logger.debug(`Found pdf-parse function at default.${key}`, { category: 'system' });
              pdfParseFn = value as PdfParseFunction;
              break;
            } else {
              logger.debug(`Skipping pdf-parse default.${key} (class)`, { category: 'system' });
            }
          }
        }
      }
    }
    
    // Check 2: Search top-level for a function (but ignore known classes)
    if (!pdfParseFn) {
      const mod = pdfParseModule;
      if (mod && typeof mod === 'object') {
        const allKeys = Object.keys(mod);
        logger.debug('Searching pdf-parse top-level for function (excluding classes)', { category: 'system' });
        
        for (const key of allKeys) {
          // Skip known classes and default (already checked)
          if (classesToIgnore.has(key) || key === 'default' || key === '__esModule') {
            continue;
          }
          
          const value = mod[key];
          const valueType = typeof value;
          
          if (valueType === 'function') {
            // Check if it's a class
            const fn = value as Function & { prototype?: { constructor?: unknown } };
            const isClass = fn.prototype && fn.prototype.constructor === fn;
            if (!isClass) {
              logger.debug(`Found pdf-parse function at "${key}"`, { category: 'system' });
              pdfParseFn = value as PdfParseFunction;
              break;
            } else {
              logger.debug(`Skipping pdf-parse ${key} (class)`, { category: 'system' });
            }
          }
        }
      }
    }

    // Check 3: Try PDFParse (might be the actual parser, but could be a class)
    if (!pdfParseFn && pdfParseModule.PDFParse) {
      const PDFParseValue = pdfParseModule.PDFParse;
      const PDFParseType = typeof PDFParseValue;
      logger.debug(`PDFParse type: ${PDFParseType}`, { category: 'system' });

      if (PDFParseType === 'function') {
        // Check if it's a class
        const fn = PDFParseValue as Function & { prototype?: { constructor?: unknown } };
        const isClass = fn.prototype && fn.prototype.constructor === fn;
        if (!isClass) {
          pdfParseFn = PDFParseValue as PdfParseFunction;
          logger.debug('Found pdf-parse at .PDFParse (function)', { category: 'system' });
        } else {
          logger.debug('PDFParse is a class, skipping', { category: 'system' });
        }
      }
    }
    
    // Check 4: module itself
    if (!pdfParseFn && typeof pdfParseModule === 'function') {
      pdfParseFn = pdfParseModule as unknown as PdfParseFunction;
      logger.debug('Found pdf-parse as module itself', { category: 'system' });
    }

    // Final validation with detailed error
    if (typeof pdfParseFn !== 'function') {
      const defaultVal = pdfParseModule.default;
      const moduleInfo = {
        type: typeof pdfParseModule,
        keys: Object.keys(pdfParseModule || {}),
        hasDefault: 'default' in (pdfParseModule || {}),
        defaultType: typeof defaultVal,
        defaultKeys: defaultVal && typeof defaultVal === 'object'
          ? Object.keys(defaultVal as Record<string, unknown>)
          : null,
        hasPDFParse: 'PDFParse' in (pdfParseModule || {}),
        PDFParseType: typeof pdfParseModule.PDFParse,
        __esModule: pdfParseModule.__esModule,
        isFunction: typeof pdfParseModule === 'function',
      };
      
      logger.error('pdf-parse import failed', { category: 'system', moduleInfo });
      throw new Error('pdf-parse is not a function after import. Module structure logged above.');
    }

    logger.info('pdf-parse loaded successfully', { category: 'system', fnType: typeof pdfParseFn });
    return pdfParseFn;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to load pdf-parse', { category: 'system', error: err, errorName: err.name });
    throw new Error(`PDF parsing library not available: ${err.message}`);
  }
}
