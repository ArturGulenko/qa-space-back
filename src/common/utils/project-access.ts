import { NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma.service'

export async function requireProjectAccess(
  prisma: PrismaService,
  projectId: number,
  userId: number,
  workspaceId?: number,
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, workspaceId: true },
  })
  if (!project) throw new NotFoundException('Project not found')
  if (workspaceId && project.workspaceId !== workspaceId) {
    throw new NotFoundException('Project not found')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true },
  })
  if (user?.isSuperAdmin) return project

  const projectRole = await prisma.projectRole.findFirst({
    where: { projectId, userId },
    select: { id: true },
  })
  if (!projectRole) throw new NotFoundException('Project not found')
  return project
}
