import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding...')
  const password = await bcrypt.hash('password', 10)

  const user = await prisma.user.upsert({
    where: { email: 'admin@local' },
    update: {},
    create: {
      email: 'admin@local',
      password,
      name: 'Admin'
    }
  })

  const ws1 = await prisma.workspace.upsert({
    where: { slug: 'acme' },
    update: {},
    create: { slug: 'acme', name: 'Acme Corp' }
  })

  const ws2 = await prisma.workspace.upsert({
    where: { slug: 'beta' },
    update: {},
    create: { slug: 'beta', name: 'Beta Org' }
  })

  await prisma.workspaceMember.upsert({
    where: { id: 1 },
    update: {},
    create: {
      workspaceId: ws1.id,
      userId: user.id,
      role: 'owner'
    }
  })

  await prisma.workspaceMember.upsert({
    where: { id: 2 },
    update: {},
    create: {
      workspaceId: ws2.id,
      userId: user.id,
      role: 'admin'
    }
  })

  const project1 = await prisma.project.upsert({
    where: { id: 1 },
    update: {},
    create: {
      key: 'ACME-APP',
      name: 'Acme App',
      workspaceId: ws1.id
    }
  })

  const project2 = await prisma.project.upsert({
    where: { id: 2 },
    update: {},
    create: {
      key: 'BETA-APP',
      name: 'Beta App',
      workspaceId: ws2.id
    }
  })

  await prisma.projectRole.upsert({
    where: { id: 1 },
    update: {},
    create: {
      projectId: project1.id,
      userId: user.id,
      role: 'admin'
    }
  })

  await prisma.projectRole.upsert({
    where: { id: 2 },
    update: {},
    create: {
      projectId: project2.id,
      userId: user.id,
      role: 'viewer'
    }
  })

  console.log('Seeding finished')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
