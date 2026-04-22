/**
 * Permission hooks — derive role & access flags from the auth store.
 * All logic mirrors the backend User.can_manage(guild) method.
 */
import { useAuthStore, type UserGuild } from '../store/authStore'

export interface GuildPermissions {
  /** Global hub admin override — sees and controls everything */
  isAdmin: boolean
  /** Owns this specific guild on Discord */
  isOwner: boolean
  /** Has GuildMember.can_manage=True for this guild */
  isManager: boolean
  /** Can manage: isAdmin OR isOwner OR isManager */
  canManage: boolean
  /** Can access server detail page (same as canManage) */
  canViewServer: boolean
  /** The role string for display */
  role: UserGuild['role'] | null
}

/**
 * Returns permission flags for a specific guild.
 * Pass `guildId` as a number or numeric string.
 */
export function useGuildPermissions(guildId?: number | string | null): GuildPermissions {
  const user = useAuthStore((s) => s.user)

  const isAdmin = user?.is_admin ?? false
  const numId = guildId != null ? Number(guildId) : null
  const guild = user?.guilds?.find((g) => g.id === numId) ?? null

  const role = guild?.role ?? null
  const isOwner = role === 'owner'
  const isManager = role === 'manager'
  const canManage = isAdmin || isOwner || isManager

  return {
    isAdmin,
    isOwner,
    isManager,
    canManage,
    canViewServer: canManage,
    role,
  }
}

/**
 * Returns only the guilds the current user can access/manage.
 */
export function useAccessibleGuilds(): UserGuild[] {
  const user = useAuthStore((s) => s.user)
  return user?.guilds ?? []
}

/**
 * Returns a human-readable role label for display.
 */
export function getRoleLabel(role: UserGuild['role'] | null): string {
  switch (role) {
    case 'owner':
      return 'Owner'
    case 'manager':
      return 'Manager'
    case 'admin_override':
      return 'Admin'
    default:
      return 'View Only'
  }
}

/**
 * Returns Tailwind classes for role badge styling.
 */
export function getRoleBadgeClass(role: UserGuild['role'] | null): string {
  switch (role) {
    case 'owner':
      return 'bg-amber/20 text-amber border border-amber/40'
    case 'manager':
      return 'bg-cyan/20 text-cyan border border-cyan/40'
    case 'admin_override':
      return 'bg-lime/20 text-lime border border-lime/40'
    default:
      return 'bg-surface text-text-2 border border-cyan/10'
  }
}
