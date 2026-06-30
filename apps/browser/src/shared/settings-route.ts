export type SettingsSection =
  | 'models-providers'
  | 'custom-providers'
  | 'agent-general'
  | 'skills-context'
  | 'worktree-setup'
  | 'plugins'
  | 'personalization'
  | 'browsing'
  | 'history'
  | 'website-permissions'
  | 'clear-data'
  | 'account'
  | 'auto-register'
  | 'account-pool'
  | 'proxy-pool'
  | 'about';

export type SettingsRoute =
  | { section: Exclude<SettingsSection, 'website-permissions'> }
  | { section: 'website-permissions'; host: string };

export const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
  'models-providers': 'Models & Providers',
  'custom-providers': 'Custom Providers',
  'agent-general': 'General',
  'skills-context': 'Skills & Context files',
  'worktree-setup': 'Worktrees',
  plugins: 'Plugins',
  personalization: 'Personalization',
  browsing: 'General',
  history: 'History',
  'website-permissions': 'Website Permissions',
  'clear-data': 'Clear data',
  account: 'Account',
  'auto-register': '\u81ea\u52a8\u6ce8\u518c\u914d\u7f6e',
  'account-pool': '\u8d26\u53f7\u6c60',
  'proxy-pool': '\u4ee3\u7406\u6c60',
  about: 'About',
};

export const SETTINGS_SECTION_LABEL_KEYS: Record<SettingsSection, string> = {
  'models-providers': 'settings.nav.modelsProviders',
  'custom-providers': 'settings.nav.customProviders',
  'agent-general': 'settings.nav.agentGeneral',
  'skills-context': 'settings.nav.skillsContext',
  'worktree-setup': 'settings.nav.worktrees',
  plugins: 'settings.nav.plugins',
  personalization: 'settings.nav.personalization',
  browsing: 'settings.nav.browsing',
  history: 'settings.nav.history',
  'website-permissions': 'settings.nav.websitePermissions',
  'clear-data': 'settings.nav.clearData',
  account: 'settings.nav.account',
  'auto-register': 'settings.nav.autoRegister',
  'account-pool': 'settings.nav.accountPool',
  'proxy-pool': 'settings.nav.proxyPool',
  about: 'settings.nav.about',
};
