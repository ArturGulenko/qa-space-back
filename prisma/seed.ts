import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding...')
  const password = await bcrypt.hash('password', 10)

  const [admin, qaUser, regularUser] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@local' },
      update: {},
      create: {
        email: 'admin@local',
        password,
        name: 'Admin'
      }
    }),
    prisma.user.upsert({
      where: { email: 'qa@local' },
      update: {},
      create: {
        email: 'qa@local',
        password,
        name: 'QA Engineer'
      }
    }),
    prisma.user.upsert({
      where: { email: 'user@local' },
      update: {},
      create: {
        email: 'user@local',
        password,
        name: 'Test User'
      }
    })
  ])

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

  await Promise.all([
    prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: ws1.id, userId: admin.id } },
      update: {},
      create: {
        workspaceId: ws1.id,
        userId: admin.id,
        role: 'owner'
      }
    }),
    prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: ws2.id, userId: admin.id } },
      update: {},
      create: {
        workspaceId: ws2.id,
        userId: admin.id,
        role: 'admin'
      }
    }),
    prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: ws1.id, userId: qaUser.id } },
      update: {},
      create: {
        workspaceId: ws1.id,
        userId: qaUser.id,
        role: 'admin'
      }
    }),
    prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: ws2.id, userId: qaUser.id } },
      update: {},
      create: {
        workspaceId: ws2.id,
        userId: qaUser.id,
        role: 'viewer'
      }
    }),
    prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: ws1.id, userId: regularUser.id } },
      update: {},
      create: {
        workspaceId: ws1.id,
        userId: regularUser.id,
        role: 'member'
      }
    }),
    prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: ws2.id, userId: regularUser.id } },
      update: {},
      create: {
        workspaceId: ws2.id,
        userId: regularUser.id,
        role: 'viewer'
      }
    })
  ])

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

  await Promise.all([
    prisma.projectRole.upsert({
      where: { projectId_userId: { projectId: project1.id, userId: admin.id } },
      update: {},
      create: {
        projectId: project1.id,
        userId: admin.id,
        role: 'admin'
      }
    }),
    prisma.projectRole.upsert({
      where: { projectId_userId: { projectId: project2.id, userId: admin.id } },
      update: {},
      create: {
        projectId: project2.id,
        userId: admin.id,
        role: 'admin'
      }
    }),
    prisma.projectRole.upsert({
      where: { projectId_userId: { projectId: project1.id, userId: qaUser.id } },
      update: {},
      create: {
        projectId: project1.id,
        userId: qaUser.id,
        role: 'admin'
      }
    }),
    prisma.projectRole.upsert({
      where: { projectId_userId: { projectId: project2.id, userId: qaUser.id } },
      update: {},
      create: {
        projectId: project2.id,
        userId: qaUser.id,
        role: 'viewer'
      }
    }),
    prisma.projectRole.upsert({
      where: { projectId_userId: { projectId: project1.id, userId: regularUser.id } },
      update: {},
      create: {
        projectId: project1.id,
        userId: regularUser.id,
        role: 'viewer'
      }
    }),
    prisma.projectRole.upsert({
      where: { projectId_userId: { projectId: project2.id, userId: regularUser.id } },
      update: {},
      create: {
        projectId: project2.id,
        userId: regularUser.id,
        role: 'viewer'
      }
    })
  ])

  // Suites
  const acmeRootSuite = await prisma.suite.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Acme Root',
      order: 0,
      projectId: project1.id,
      workspaceId: ws1.id
    }
  })

  const betaRootSuite = await prisma.suite.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: 'Beta Root',
      order: 0,
      projectId: project2.id,
      workspaceId: ws2.id
    }
  })

  // Test cases
  await prisma.testCase.upsert({
    where: { projectId_key: { projectId: project1.id, key: 'ACME-APP-TC-00001' } },
    update: {},
    create: {
      key: 'ACME-APP-TC-00001',
      title: 'Login with valid credentials',
      priority: 'high',
      status: 'draft',
      tags: ['auth', 'smoke'],
      projectId: project1.id,
      workspaceId: ws1.id,
      suiteId: acmeRootSuite.id,
      steps: {
        create: [
          { order: 1, action: 'Open login page', expected: 'Login form is visible' },
          { order: 2, action: 'Enter valid credentials', expected: 'Fields accept input' },
          { order: 3, action: 'Click Login', expected: 'User is redirected to dashboard' }
        ]
      }
    }
  })

  await prisma.testCase.upsert({
    where: { projectId_key: { projectId: project2.id, key: 'BETA-APP-TC-00001' } },
    update: {},
    create: {
      key: 'BETA-APP-TC-00001',
      title: 'View projects list',
      priority: 'medium',
      status: 'draft',
      tags: ['projects'],
      projectId: project2.id,
      workspaceId: ws2.id,
      suiteId: betaRootSuite.id,
      steps: {
        create: [
          { order: 1, action: 'Open dashboard', expected: 'Dashboard loads' },
          { order: 2, action: 'Open Projects', expected: 'Projects list is shown' }
        ]
      }
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
