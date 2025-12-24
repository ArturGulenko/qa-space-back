import { SetMetadata } from '@nestjs/common'
import { Permission } from '../permissions/permissions.enum'

export const PERMISSIONS_KEY = 'permissions'

/**
 * Decorator to specify required permissions for an endpoint
 * @param permissions - Array of permissions required to access the endpoint
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions)



