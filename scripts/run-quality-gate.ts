/**
 * Script to run quality gate verification
 * 
 * Usage: yarn test:quality
 */

import { scanAllRoutes, generateScanReport } from '../lib/core/quality/routeScanner';

async function main() {
  console.log('🔍 Running Quality Gate Verification...\n');
  
  // Scan all routes
  console.log('📋 Scanning all API routes...');
  const scanResults = scanAllRoutes();
  const report = generateScanReport(scanResults);
  
  console.log(report.summary);
  console.log('\n');
  
  // Print violations
  if (report.violations.length > 0) {
    console.log('❌ Violations Found:\n');
    
    const violationsByRoute = report.violations.reduce((acc, v) => {
      if (!acc[v.route]) acc[v.route] = [];
      acc[v.route].push(v);
      return acc;
    }, {} as Record<string, typeof report.violations>);
    
    for (const [route, violations] of Object.entries(violationsByRoute)) {
      console.log(`\n📍 ${route}:`);
      for (const violation of violations) {
        console.log(`  [${violation.severity.toUpperCase()}] ${violation.type}`);
        console.log(`     ${violation.message}`);
        if (violation.line) {
          console.log(`     Line ${violation.line}: ${violation.codeSnippet}`);
        }
      }
    }
  }
  
  // Exit with error code if there are critical or high violations
  if (report.criticalViolations > 0 || report.highViolations > 0) {
    console.log('\n❌ Quality gate FAILED. Fix violations before deploying.');
    process.exit(1);
  } else {
    console.log('\n✅ Quality gate PASSED. All security checks passed.');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Error running quality gate:', error);
  process.exit(1);
});
