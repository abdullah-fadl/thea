/**
 * Create Subscription Contract for Tenant
 * 
 * Usage: npx tsx scripts/create-subscription-contract.ts <tenantId>
 * Example: npx tsx scripts/create-subscription-contract.ts "1"
 */

import { getPlatformCollection } from '../lib/db/platformDb';
import { SubscriptionContract } from '../lib/core/models/Subscription';
import { v4 as uuidv4 } from 'uuid';

async function createSubscriptionContract(tenantId: string) {
  console.log(`\n🔧 Creating subscription contract for tenant: ${tenantId}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const contractsCollection = await getPlatformCollection('subscription_contracts');
    const tenantsCollection = await getPlatformCollection('tenants');
    
    // Check if tenant exists
    const tenant = await tenantsCollection.findOne({ tenantId });
    if (!tenant) {
      console.error(`❌ Tenant "${tenantId}" not found!`);
      console.log('\n💡 Please create the tenant first or check the tenantId.');
      process.exit(1);
    }
    
    console.log(`✅ Found tenant: ${tenant.name || tenantId}`);
    
    // Check if contract already exists
    const existingContract = await contractsCollection.findOne<SubscriptionContract>({
      tenantId,
    });
    
    if (existingContract) {
      console.log(`⚠️  Subscription contract already exists for tenant "${tenantId}"`);
      console.log(`   Status: ${existingContract.status}`);
      console.log(`   Plan: ${existingContract.planType}`);
      console.log(`   Platforms: SAM=${existingContract.enabledPlatforms.sam}, Health=${existingContract.enabledPlatforms.theaHealth}`);
      console.log('\n💡 To update the contract, delete it first or modify this script.');
      process.exit(0);
    }
    
    // Get tenant entitlements (default to all enabled if not set)
    const entitlements = tenant.entitlements || {
      sam: true,
      health: true,
      edrac: false,
      cvision: false,
    };
    
    const now = new Date();
    const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    
    // Create subscription contract
    const contract: SubscriptionContract = {
      id: uuidv4(),
      tenantId,
      status: tenant.status === 'blocked' ? 'blocked' : 'active',
      enabledPlatforms: {
        sam: entitlements.sam || false,
        theaHealth: entitlements.health || false, // Map health to theaHealth
        cvision: entitlements.cvision || false,
        edrac: entitlements.edrac || false,
      },
      maxUsers: tenant.maxUsers || 100,
      currentUsers: 0,
      enabledFeatures: {},
      storageLimit: 1000000000, // 1GB
      aiQuota: {
        monthlyLimit: 10000,
        currentUsage: 0,
        resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
      branchLimits: {
        maxDepartments: 0,
        maxUnits: 0,
        maxFloors: 0,
      },
      planType: tenant.planType || 'enterprise',
      subscriptionStartsAt: now,
      subscriptionEndsAt: tenant.subscriptionEndsAt || oneYearFromNow,
      gracePeriodEnabled: tenant.gracePeriodEnabled || false,
      createdAt: now,
      updatedAt: now,
    };
    
    await contractsCollection.insertOne(contract);
    
    console.log('✅ Subscription contract created successfully!');
    console.log(`\n📋 Contract Details:`);
    console.log(`   Tenant ID: ${contract.tenantId}`);
    console.log(`   Status: ${contract.status}`);
    console.log(`   Plan: ${contract.planType}`);
    console.log(`   Max Users: ${contract.maxUsers}`);
    console.log(`   Platforms:`);
    console.log(`     - SAM: ${contract.enabledPlatforms.sam ? '✅' : '❌'}`);
    console.log(`     - Thea Health: ${contract.enabledPlatforms.theaHealth ? '✅' : '❌'}`);
    console.log(`     - EDRAC: ${contract.enabledPlatforms.edrac ? '✅' : '❌'}`);
    console.log(`     - CVision: ${contract.enabledPlatforms.cvision ? '✅' : '❌'}`);
    console.log(`   Subscription Ends: ${contract.subscriptionEndsAt?.toLocaleDateString() || 'Never'}`);
    console.log('\n✅ Done! You can now login.');
    
  } catch (error) {
    console.error('❌ Error creating subscription contract:', error);
    process.exit(1);
  }
}

// Get tenantId from command line arguments
const tenantId = process.argv[2];

if (!tenantId) {
  console.error('❌ Error: Tenant ID is required');
  console.log('\nUsage: npx tsx scripts/create-subscription-contract.ts <tenantId>');
  console.log('Example: npx tsx scripts/create-subscription-contract.ts "1"');
  process.exit(1);
}

createSubscriptionContract(tenantId)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
