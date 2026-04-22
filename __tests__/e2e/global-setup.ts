import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000';
  const testSecret = process.env.TEST_SECRET || 'test-secret-change-in-production';
  
  console.log('🌱 Seeding test data...');
  
  // Set test mode
  process.env.Thea_TEST_MODE = 'true';
  
  try {
    const response = await fetch(`${baseURL}/api/test/seed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-secret': testSecret,
        'x-test-mode': 'true',
      },
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to seed test data: ${error}`);
    }
    
    const data = await response.json();
    console.log('✅ Test data seeded:', data.message);
  } catch (error) {
    console.error('❌ Failed to seed test data:', error);
    // Don't fail the test run, but log the error
    // Tests will fail if they can't login anyway
  }
}

export default globalSetup;
