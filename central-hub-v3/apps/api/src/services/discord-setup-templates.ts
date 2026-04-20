/**
 * Discord Server Setup Templates
 * Predefined configurations for different server types with AI-driven customization
 */

import { Client, PermissionFlagsBits, ChannelType } from 'discord.js';

export enum SetupTemplateType {
  COMMUNITY = 'community',
  SUPPORT = 'support',
  CREATOR = 'creator',
  GAMING = 'gaming',
  PRIVATE = 'private',
  HYBRID = 'hybrid',
}

export interface RoleConfig {
  name: string;
  color: string;
  permissions: bigint[];
  position?: number;
  mentionable?: boolean;
  hoist?: boolean;
}

export interface ChannelConfig {
  name: string;
  type: ChannelType;
  topic?: string;
  nsfw?: boolean;
  rateLimitPerUser?: number;
  permissionOverwrites?: {
    id: string;
    type: 'role' | 'member';
    allow?: bigint;
    deny?: bigint;
  }[];
}

export interface SetupTemplate {
  id: SetupTemplateType;
  name: string;
  description: string;
  emoji: string;
  roles: RoleConfig[];
  channels: ChannelConfig[];
  moderationPolicy?: {
    enableAutomod: boolean;
    warnThreshold: number;
    muteThreshold: number;
    kickThreshold: number;
    banThreshold: number;
  };
  welcomeSettings?: {
    enabled: boolean;
    message: string;
    dmNewMembers: boolean;
  };
  levelingSettings?: {
    enabled: boolean;
    minXpPerMessage: number;
    maxXpPerMessage: number;
  };
}

/**
 * COMMUNITY: Public community server with general discussion, voice channels, and forums
 */
export const COMMUNITY_TEMPLATE: SetupTemplate = {
  id: SetupTemplateType.COMMUNITY,
  name: 'Community Server',
  description: 'General public community with discussion, voice chat, and forums',
  emoji: '🌍',
  roles: [
    {
      name: 'Admin',
      color: '#FF0000',
      permissions: [PermissionFlagsBits.Administrator],
      hoist: true,
    },
    {
      name: 'Moderator',
      color: '#0099FF',
      permissions: [
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageMembers,
        PermissionFlagsBits.ModerateMembers,
        PermissionFlagsBits.KickMembers,
      ],
      hoist: true,
    },
    {
      name: 'Member',
      color: '#36393F',
      permissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel],
    },
    {
      name: 'Bot',
      color: '#7289DA',
      permissions: [
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageRoles,
        PermissionFlagsBits.ManageChannels,
      ],
      hoist: true,
    },
  ],
  channels: [
    {
      name: '📢-announcements',
      type: ChannelType.GuildText,
      topic: 'Important announcements for the community',
    },
    {
      name: '💬-general',
      type: ChannelType.GuildText,
      topic: 'General discussion and off-topic chat',
    },
    {
      name: '🎉-events',
      type: ChannelType.GuildText,
      topic: 'Community events and organized activities',
    },
    {
      name: '❓-help',
      type: ChannelType.GuildText,
      topic: 'Get help and ask questions',
    },
    {
      name: '🗣️-voice',
      type: ChannelType.GuildVoice,
      topic: 'Main voice channel for the community',
    },
    {
      name: '💡-suggestions',
      type: ChannelType.GuildForum,
      topic: 'Suggest features and improvements',
    },
  ],
  moderationPolicy: {
    enableAutomod: true,
    warnThreshold: 3,
    muteThreshold: 5,
    kickThreshold: 7,
    banThreshold: 10,
  },
  welcomeSettings: {
    enabled: true,
    message: 'Welcome to our community! 🎉 Please read the rules and introduce yourself.',
    dmNewMembers: true,
  },
  levelingSettings: {
    enabled: true,
    minXpPerMessage: 10,
    maxXpPerMessage: 50,
  },
};

/**
 * SUPPORT: Customer support server with ticket system and specialized channels
 */
export const SUPPORT_TEMPLATE: SetupTemplate = {
  id: SetupTemplateType.SUPPORT,
  name: 'Support Server',
  description: 'Customer support with ticket system and specialized support channels',
  emoji: '🆘',
  roles: [
    {
      name: 'Admin',
      color: '#FF0000',
      permissions: [PermissionFlagsBits.Administrator],
      hoist: true,
    },
    {
      name: 'Support Lead',
      color: '#00FF00',
      permissions: [
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageMembers,
        PermissionFlagsBits.ViewAuditLog,
      ],
      hoist: true,
    },
    {
      name: 'Support Agent',
      color: '#0099FF',
      permissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.SendMessages],
    },
    {
      name: 'Customer',
      color: '#36393F',
      permissions: [PermissionFlagsBits.SendMessages],
    },
  ],
  channels: [
    {
      name: '📋-tickets',
      type: ChannelType.GuildText,
      topic: 'Create a support ticket here',
    },
    {
      name: '📚-documentation',
      type: ChannelType.GuildText,
      topic: 'Documentation and guides',
    },
    {
      name: '🐛-bugs',
      type: ChannelType.GuildText,
      topic: 'Report bugs and issues',
    },
    {
      name: '💡-feature-requests',
      type: ChannelType.GuildText,
      topic: 'Request new features',
    },
    {
      name: '👥-staff-only',
      type: ChannelType.GuildText,
      topic: 'Internal staff communication',
    },
  ],
  moderationPolicy: {
    enableAutomod: false,
    warnThreshold: 5,
    muteThreshold: 8,
    kickThreshold: 10,
    banThreshold: 15,
  },
};

/**
 * CREATOR: Content creator community with tier roles and exclusive channels
 */
export const CREATOR_TEMPLATE: SetupTemplate = {
  id: SetupTemplateType.CREATOR,
  name: 'Creator Community',
  description: 'Content creator community with tiered membership and exclusive content',
  emoji: '🎬',
  roles: [
    {
      name: 'Creator',
      color: '#FF1493',
      permissions: [PermissionFlagsBits.Administrator],
      hoist: true,
    },
    {
      name: 'Moderator',
      color: '#0099FF',
      permissions: [
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ModerateMembers,
      ],
    },
    {
      name: 'Tier 3 - VIP',
      color: '#FFD700',
      permissions: [PermissionFlagsBits.SendMessages],
    },
    {
      name: 'Tier 2 - Premium',
      color: '#C0C0C0',
      permissions: [PermissionFlagsBits.SendMessages],
    },
    {
      name: 'Tier 1 - Member',
      color: '#8B7355',
      permissions: [PermissionFlagsBits.SendMessages],
    },
    {
      name: 'Guest',
      color: '#36393F',
      permissions: [PermissionFlagsBits.ViewChannel],
    },
  ],
  channels: [
    {
      name: '📺-latest-content',
      type: ChannelType.GuildText,
      topic: 'Latest content and videos',
    },
    {
      name: '💬-general',
      type: ChannelType.GuildText,
      topic: 'General discussion',
    },
    {
      name: '🎁-tier3-exclusive',
      type: ChannelType.GuildText,
      topic: 'Exclusive content for VIP members',
    },
    {
      name: '🎥-tier2-exclusive',
      type: ChannelType.GuildText,
      topic: 'Exclusive content for Premium members',
    },
    {
      name: '🎤-live-chat',
      type: ChannelType.GuildVoice,
      topic: 'Live streaming voice channel',
    },
    {
      name: '🗳️-polls',
      type: ChannelType.GuildForum,
      topic: 'Community polls and voting',
    },
  ],
  levelingSettings: {
    enabled: true,
    minXpPerMessage: 15,
    maxXpPerMessage: 75,
  },
};

/**
 * GAMING: Gaming clan/community with game-specific channels
 */
export const GAMING_TEMPLATE: SetupTemplate = {
  id: SetupTemplateType.GAMING,
  name: 'Gaming Clan',
  description: 'Gaming community with voice channels, game-specific categories, and LFG system',
  emoji: '🎮',
  roles: [
    {
      name: 'Clan Leader',
      color: '#FF0000',
      permissions: [PermissionFlagsBits.Administrator],
      hoist: true,
    },
    {
      name: 'Officer',
      color: '#0099FF',
      permissions: [
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ModerateMembers,
        PermissionFlagsBits.ManageChannels,
      ],
      hoist: true,
    },
    {
      name: 'Member',
      color: '#36393F',
      permissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect],
    },
  ],
  channels: [
    {
      name: '📢-announcements',
      type: ChannelType.GuildText,
      topic: 'Clan announcements and news',
    },
    {
      name: '🎮-general-gaming',
      type: ChannelType.GuildVoice,
      topic: 'General gaming voice channel',
    },
    {
      name: '🎯-find-group',
      type: ChannelType.GuildText,
      topic: 'Looking For Group (LFG) posts',
    },
    {
      name: '⚔️-game1',
      type: ChannelType.GuildVoice,
      topic: 'Game 1 voice channel',
    },
    {
      name: '🛡️-game2',
      type: ChannelType.GuildVoice,
      topic: 'Game 2 voice channel',
    },
    {
      name: '🏆-tournaments',
      type: ChannelType.GuildText,
      topic: 'Clan tournaments and competitions',
    },
    {
      name: '💬-off-topic',
      type: ChannelType.GuildText,
      topic: 'Off-topic and general chat',
    },
  ],
};

/**
 * PRIVATE: Private operations/staff server with restricted access
 */
export const PRIVATE_TEMPLATE: SetupTemplate = {
  id: SetupTemplateType.PRIVATE,
  name: 'Private Ops Server',
  description: 'Private operations server with restricted access and security-focused setup',
  emoji: '🔒',
  roles: [
    {
      name: 'Owner',
      color: '#FF0000',
      permissions: [PermissionFlagsBits.Administrator],
      hoist: true,
    },
    {
      name: 'Staff',
      color: '#0099FF',
      permissions: [
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ViewAuditLog,
        PermissionFlagsBits.ManageRoles,
      ],
      hoist: true,
    },
  ],
  channels: [
    {
      name: '📋-operations',
      type: ChannelType.GuildText,
      topic: 'Operations and planning',
    },
    {
      name: '🔐-sensitive',
      type: ChannelType.GuildText,
      topic: 'Sensitive information and discussions',
    },
    {
      name: '📊-reports',
      type: ChannelType.GuildText,
      topic: 'Reports and analytics',
    },
    {
      name: '🎤-voice',
      type: ChannelType.GuildVoice,
      topic: 'Private voice channel',
    },
  ],
  moderationPolicy: {
    enableAutomod: true,
    warnThreshold: 2,
    muteThreshold: 3,
    kickThreshold: 5,
    banThreshold: 10,
  },
};

/**
 * HYBRID: Mix of public and private areas with access tiers
 */
export const HYBRID_TEMPLATE: SetupTemplate = {
  id: SetupTemplateType.HYBRID,
  name: 'Hybrid Community',
  description: 'Community with both public and private sections with tiered access',
  emoji: '🌐',
  roles: [
    {
      name: 'Admin',
      color: '#FF0000',
      permissions: [PermissionFlagsBits.Administrator],
      hoist: true,
    },
    {
      name: 'Moderator',
      color: '#0099FF',
      permissions: [
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ModerateMembers,
      ],
      hoist: true,
    },
    {
      name: 'Premium Member',
      color: '#FFD700',
      permissions: [PermissionFlagsBits.SendMessages],
    },
    {
      name: 'Member',
      color: '#36393F',
      permissions: [PermissionFlagsBits.SendMessages],
    },
  ],
  channels: [
    {
      name: '📢-announcements',
      type: ChannelType.GuildText,
      topic: 'Public announcements',
    },
    {
      name: '💬-general',
      type: ChannelType.GuildText,
      topic: 'Public general chat',
    },
    {
      name: '🎁-premium-content',
      type: ChannelType.GuildText,
      topic: 'Premium member exclusive content',
    },
    {
      name: '🔐-staff-only',
      type: ChannelType.GuildText,
      topic: 'Staff operations (restricted)',
    },
    {
      name: '🗣️-voice',
      type: ChannelType.GuildVoice,
      topic: 'Public voice channel',
    },
  ],
};

// Template registry
export const SETUP_TEMPLATES: Record<SetupTemplateType, SetupTemplate> = {
  [SetupTemplateType.COMMUNITY]: COMMUNITY_TEMPLATE,
  [SetupTemplateType.SUPPORT]: SUPPORT_TEMPLATE,
  [SetupTemplateType.CREATOR]: CREATOR_TEMPLATE,
  [SetupTemplateType.GAMING]: GAMING_TEMPLATE,
  [SetupTemplateType.PRIVATE]: PRIVATE_TEMPLATE,
  [SetupTemplateType.HYBRID]: HYBRID_TEMPLATE,
};

/**
 * Get template by ID
 */
export function getTemplate(templateId: SetupTemplateType): SetupTemplate {
  return SETUP_TEMPLATES[templateId];
}

/**
 * Get all available templates
 */
export function getAllTemplates(): SetupTemplate[] {
  return Object.values(SETUP_TEMPLATES);
}

/**
 * Suggest best template based on natural language description
 */
export async function suggestTemplate(userDescription: string): Promise<SetupTemplateType> {
  const keywords = userDescription.toLowerCase();

  if (keywords.match(/gaming|clan|esports|lfg|game/)) {
    return SetupTemplateType.GAMING;
  }

  if (keywords.match(/support|help|ticket|customer|bug/)) {
    return SetupTemplateType.SUPPORT;
  }

  if (keywords.match(/creator|streamer|content|patreon|tier/)) {
    return SetupTemplateType.CREATOR;
  }

  if (keywords.match(/private|staff|ops|internal|secret/)) {
    return SetupTemplateType.PRIVATE;
  }

  if (keywords.match(/hybrid|mix|public.*private|tier/)) {
    return SetupTemplateType.HYBRID;
  }

  // Default to community
  return SetupTemplateType.COMMUNITY;
}

/**
 * Convert template to setup steps
 * Generates a sequence of SetupStep configurations
 */
export function templateToSetupSteps(template: SetupTemplate): Array<{
  order: number;
  type: string;
  description: string;
  config: any;
}> {
  const steps: Array<{
    order: number;
    type: string;
    description: string;
    config: any;
  }> = [];
  let order = 1;

  // Step 1: Create roles
  for (const role of template.roles) {
    steps.push({
      order: order++,
      type: 'create_role',
      description: `Create role: ${role.name}`,
      config: role,
    });
  }

  // Step 2: Create channels
  for (const channel of template.channels) {
    steps.push({
      order: order++,
      type: 'create_channel',
      description: `Create channel: ${channel.name}`,
      config: channel,
    });
  }

  // Step 3: Configure moderation policy
  if (template.moderationPolicy) {
    steps.push({
      order: order++,
      type: 'configure_moderation',
      description: 'Configure moderation policy',
      config: template.moderationPolicy,
    });
  }

  // Step 4: Setup welcome
  if (template.welcomeSettings) {
    steps.push({
      order: order++,
      type: 'setup_welcome',
      description: 'Setup welcome messages',
      config: template.welcomeSettings,
    });
  }

  // Step 5: Setup leveling
  if (template.levelingSettings) {
    steps.push({
      order: order++,
      type: 'setup_leveling',
      description: 'Setup leveling system',
      config: template.levelingSettings,
    });
  }

  return steps;
}
