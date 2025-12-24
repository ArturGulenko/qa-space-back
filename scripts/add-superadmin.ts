/**
 * Script to set a user as system superadmin
 * Superadmin manages the entire system and has access to all workspaces
 * 
 * Usage:
 *   ts-node scripts/add-superadmin.ts <userId>
 * 
 * Or with email:
 *   ts-node scripts/add-superadmin.ts <email>
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length < 1) {
    console.error('Usage: ts-node scripts/add-superadmin.ts <userId|email>')
    console.error('Example: ts-node scripts/add-superadmin.ts 1')
    console.error('Example: ts-node scripts/add-superadmin.ts admin@example.com')
    process.exit(1)
  }

  const userIdentifier = args[0]

  // Find user by ID or email
  let user
  if (!isNaN(parseInt(userIdentifier, 10))) {
    // Try as user ID
    user = await prisma.user.findUnique({
      where: { id: parseInt(userIdentifier, 10) },
    })
  } else {
    // Try as email
    user = await prisma.user.findUnique({
      where: { email: userIdentifier },
    })
  }

  if (!user) {
    console.error(`User not found: ${userIdentifier}`)
    process.exit(1)
  }

  console.log(`User: ${user.email} (${user.name || 'No name'})`)

  if (user.isSuperAdmin) {
    console.log('User is already a system superadmin')
    process.exit(0)
  }

  // Set superadmin flag in user table
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isSuperAdmin: true },
  })

  console.log(`✓ User set as system superadmin`)
  console.log('\n✓ Done! User is now a system superadmin with access to all workspaces.')
  console.log('Superadmin can:')
  console.log('  - Access all workspaces')
  console.log('  - Manage all workspaces and projects')
  console.log('  - Bypass all permission checks')
  console.log('  - Manage the entire system')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

