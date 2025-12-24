/**
 * Script to create a superadmin user with password "password"
 * 
 * Usage:
 *   npm run create-superadmin
 *   or
 *   ts-node scripts/create-superadmin.ts
 */

import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('Creating superadmin user...')

  // Hash password
  const password = await bcrypt.hash('password', 10)

  // Create or get superadmin user
  const superadmin = await prisma.user.upsert({
    where: { email: 'superadmin@local' },
    update: {
      password, // Update password in case it was changed
      isSuperAdmin: true, // Ensure superadmin flag is set
    },
    create: {
      email: 'superadmin@local',
      password,
      name: 'Super Admin',
      isSuperAdmin: true,
    },
  })

  console.log(`✓ User created/updated: ${superadmin.email} (ID: ${superadmin.id})`)
  console.log(`✓ Superadmin flag set: ${superadmin.isSuperAdmin}`)

  console.log('\n' + '='.repeat(50))
  console.log('Superadmin created successfully!')
  console.log('='.repeat(50))
  console.log(`Email: ${superadmin.email}`)
  console.log('Password: password')
  console.log('Role: System Superadmin')
  console.log('Access: All workspaces and system-wide')
  console.log('='.repeat(50))
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

