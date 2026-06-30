import type { SettingCommandItem } from './command-center-model';
import type { SettingsRoute } from '@shared/settings-route';

export type CommandCenterSettingDefinition = Omit<
  SettingCommandItem,
  'kind' | 'mode' | 'icon' | 'title' | 'subtitle'
> & {
  titleKey: string;
  subtitleKey: string;
  iconName:
    | 'models'
    | 'key'
    | 'provider'
    | 'settings'
    | 'context'
    | 'worktrees'
    | 'plugins'
    | 'browser'
    | 'history'
    | 'personalization';
  settingsRoute?: SettingsRoute;
};

const ROUTE_MODELS_PROVIDERS: SettingsRoute = { section: 'models-providers' };
const ROUTE_CUSTOM_PROVIDERS: SettingsRoute = { section: 'custom-providers' };
const ROUTE_AGENT_GENERAL: SettingsRoute = { section: 'agent-general' };
const ROUTE_SKILLS_CONTEXT: SettingsRoute = { section: 'skills-context' };
const ROUTE_WORKTREE_SETUP: SettingsRoute = { section: 'worktree-setup' };
const ROUTE_PLUGINS: SettingsRoute = { section: 'plugins' };
const ROUTE_PERSONALIZATION: SettingsRoute = { section: 'personalization' };
const ROUTE_BROWSING: SettingsRoute = { section: 'browsing' };
const ROUTE_HISTORY: SettingsRoute = { section: 'history' };

export const commandCenterSettings: CommandCenterSettingDefinition[] = [
  {
    id: 'setting:models-providers',
    titleKey: 'commandCenter.setting.modelsProviders.title',
    subtitleKey: 'commandCenter.setting.modelsProviders.subtitle',
    keywords: ['models', 'providers', 'llm', 'ai', 'coding plans'],
    url: '',
    settingsRoute: ROUTE_MODELS_PROVIDERS,
    iconName: 'models',
  },
  {
    id: 'setting:api-keys',
    titleKey: 'commandCenter.setting.apiKeys.title',
    subtitleKey: 'commandCenter.setting.apiKeys.subtitle',
    keywords: [
      'api keys',
      'anthropic',
      'openai',
      'google',
      'deepseek',
      'moonshot',
      'alibaba',
      'z-ai',
      'minimax',
      'xiaomi-mimo',
      'mistral',
    ],
    url: '',
    settingsRoute: ROUTE_MODELS_PROVIDERS,
    iconName: 'key',
  },
  {
    id: 'setting:custom-providers',
    titleKey: 'commandCenter.setting.customProviders.title',
    subtitleKey: 'commandCenter.setting.customProviders.subtitle',
    keywords: ['custom provider', 'endpoint', 'openai compatible', 'bedrock'],
    url: '',
    settingsRoute: ROUTE_CUSTOM_PROVIDERS,
    iconName: 'provider',
  },
  {
    id: 'setting:agent-general',
    titleKey: 'commandCenter.setting.agentGeneral.title',
    subtitleKey: 'commandCenter.setting.agentGeneral.subtitle',
    keywords: ['agent', 'general', 'settings', 'behavior'],
    url: '',
    settingsRoute: ROUTE_AGENT_GENERAL,
    iconName: 'settings',
  },
  {
    id: 'setting:skills-context',
    titleKey: 'commandCenter.setting.skillsContext.title',
    subtitleKey: 'commandCenter.setting.skillsContext.subtitle',
    keywords: ['skills', 'context', 'agents.md', 'workspace.md'],
    url: '',
    settingsRoute: ROUTE_SKILLS_CONTEXT,
    iconName: 'context',
  },
  {
    id: 'setting:worktree-setup',
    titleKey: 'commandCenter.setting.worktrees.title',
    subtitleKey: 'commandCenter.setting.worktrees.subtitle',
    keywords: ['worktree', 'worktrees', 'setup', 'script', 'branch'],
    url: '',
    settingsRoute: ROUTE_WORKTREE_SETUP,
    iconName: 'worktrees',
  },
  {
    id: 'setting:plugins',
    titleKey: 'commandCenter.setting.plugins.title',
    subtitleKey: 'commandCenter.setting.plugins.subtitle',
    keywords: ['plugins', 'extensions', 'tools'],
    url: '',
    settingsRoute: ROUTE_PLUGINS,
    iconName: 'plugins',
  },
  {
    id: 'setting:personalization',
    titleKey: 'commandCenter.setting.personalization.title',
    subtitleKey: 'commandCenter.setting.personalization.subtitle',
    keywords: ['personalization', 'theme', 'colors', 'ui size', 'sound'],
    url: '',
    settingsRoute: ROUTE_PERSONALIZATION,
    iconName: 'personalization',
  },
  {
    id: 'setting:browsing',
    titleKey: 'commandCenter.setting.browsing.title',
    subtitleKey: 'commandCenter.setting.browsing.subtitle',
    keywords: ['browser', 'browsing', 'permissions', 'search engine'],
    url: '',
    settingsRoute: ROUTE_BROWSING,
    iconName: 'browser',
  },
  {
    id: 'setting:history',
    titleKey: 'commandCenter.setting.history.title',
    subtitleKey: 'commandCenter.setting.history.subtitle',
    keywords: ['history', 'visited', 'pages'],
    url: '',
    settingsRoute: ROUTE_HISTORY,
    iconName: 'history',
  },
];
