export enum Role {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator',
  MANAGER = 'manager',
  VIEWER = 'viewer',
  OWNER = 'owner',
  MEMBER = 'member',
  GUEST = 'guest',
  DATA_PROTECTION_OFFICER = 'data_protection_officer'
}

export const RoleHierarchy = {
  [Role.ADMIN]: 100,
  [Role.DATA_PROTECTION_OFFICER]: 95,
  [Role.OWNER]: 90,
  [Role.MANAGER]: 80,
  [Role.MODERATOR]: 70,
  [Role.USER]: 50,
  [Role.MEMBER]: 40,
  [Role.VIEWER]: 20,
  [Role.GUEST]: 10
};

export function hasPermission(userRole: Role, requiredRole: Role): boolean {
  return RoleHierarchy[userRole] >= RoleHierarchy[requiredRole];
}

export function getRoleLevel(role: Role): number {
  return RoleHierarchy[role] || 0;
}
