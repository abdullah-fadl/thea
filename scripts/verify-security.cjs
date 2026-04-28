#!/usr/bin/env node

/**
 * Security Verification Script
 * 
 * Runs quality gate checks to verify:
 * - Tenant isolation
 * - Subscription enforcement
 * - Owner separation
 * - Session restore
 */

const http = require('http');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

async function runVerification() {
  console.log('🔒 Running Security Verification Checks...\n');

  try {
    const response = await fetch(`${API_BASE}/api/quality/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    console.log('📊 Verification Results:\n');
    
    let allPassed = true;
    data.results.forEach((result, index) => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} Check ${index + 1}: ${result.message}`);
      if (result.details) {
        console.log(`   Details:`, JSON.stringify(result.details, null, 2));
      }
      if (!result.passed) {
        allPassed = false;
      }
    });

    console.log(`\n${allPassed ? '✅' : '❌'} Overall: ${allPassed ? 'PASSED' : 'FAILED'}\n`);

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

// Polyfill fetch for Node.js < 18
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

runVerification();
