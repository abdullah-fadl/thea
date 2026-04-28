/**
 * Find User Script
 * 
 * Searches for a user by email in the database
 * 
 * Usage:
 *   npx tsx scripts/find-user.ts demo@tak.com
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { getCollection } from '../lib/db';

async function findUser(email: string) {
  try {
    console.log('🔍 Searching for user:', email);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const usersCollection = await getCollection('users');
    
    const user = await usersCollection.findOne({ 
      email: email.toLowerCase() 
    });

    if (!user) {
      console.log('❌ User not found');
      console.log(`   Email: ${email}`);
      process.exit(1);
    }

    console.log('✅ User found!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   ID:           ${user.id}`);
    console.log(`   Email:        ${user.email}`);
    console.log(`   First Name:   ${user.firstName || 'N/A'}`);
    console.log(`   Last Name:    ${user.lastName || 'N/A'}`);
    console.log(`   Role:         ${user.role || 'N/A'}`);
    console.log(`   Tenant ID:    ${user.tenantId || 'N/A'}`);
    console.log(`   Group ID:     ${user.groupId || 'N/A'}`);
    console.log(`   Is Active:    ${user.isActive ? 'Yes' : 'No'}`);
    console.log(`   Created At:   ${user.createdAt ? new Date(user.createdAt).toISOString() : 'N/A'}`);
    console.log(`   Updated At:   ${user.updatedAt ? new Date(user.updatedAt).toISOString() : 'N/A'}`);
    
    if (user.permissions) {
      console.log(`   Permissions:   ${Array.isArray(user.permissions) ? user.permissions.length : 'N/A'} permissions`);
    }
    
    if (user.employeeId) {
      console.log(`   Employee ID:  ${user.employeeId}`);
    }
    
    if (user.department) {
      console.log(`   Department:   ${user.department}`);
    }

    // Get tenant info if tenantId exists
    if (user.tenantId) {
      const tenantsCollection = await getCollection('tenants');
      const tenant = await tenantsCollection.findOne({ tenantId: user.tenantId });
      if (tenant) {
        console.log('\n📋 Tenant Information:');
        console.log(`   Tenant ID:    ${tenant.tenantId}`);
        console.log(`   Tenant Name:  ${tenant.name || 'N/A'}`);
        console.log(`   Status:       ${tenant.status || 'N/A'}`);
        console.log(`   Plan Type:    ${tenant.planType || 'N/A'}`);
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error('❌ Error: Email is required');
  console.log('\nUsage:');
  console.log('  npx tsx scripts/find-user.ts <email>');
  console.log('\nExample:');
  console.log('  npx tsx scripts/find-user.ts demo@tak.com');
  process.exit(1);
}

findUser(email);

