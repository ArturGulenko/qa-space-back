import { SetMetadata } from '@nestjs/common'
export const PROJECT_ROLES_KEY = 'projectRoles'
export const ProjectRoles = (...roles: string[]) => SetMetadata(PROJECT_ROLES_KEY, roles)

