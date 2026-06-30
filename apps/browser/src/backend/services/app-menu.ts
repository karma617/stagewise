import { app, Menu } from 'electron';
import path from 'node:path';
import type { Logger } from './logger';
import type { WindowLayoutService } from './window-layout';
import type { AuthService } from './auth';
import type { GlobalConfigService } from './global-config';
import { fileURLToPath } from 'node:url';
import { DisposableService } from './disposable';
import type { AppLanguage } from '@shared/karton-contracts/ui/shared-types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const appMenuDict = {
  'appMenu.settings': {
    'zh-CN': '设置',
    en: 'Settings',
  },
  'appMenu.openGithub': {
    'zh-CN': '打开 GitHub 仓库',
    en: 'Open our GitHub repository',
  },
  'appMenu.openDiscord': {
    'zh-CN': '打开 Discord 服务器',
    en: 'Open our Discord server',
  },
  'appMenu.user': {
    'zh-CN': '用户',
    en: 'User',
  },
  'appMenu.openConsole': {
    'zh-CN': '打开控制台',
    en: 'Open console',
  },
  'appMenu.logout': {
    'zh-CN': '退出登录',
    en: 'Logout',
  },
  'appMenu.loading': {
    'zh-CN': '加载中…',
    en: 'Loading...',
  },
  'appMenu.help': {
    'zh-CN': '帮助',
    en: 'Help',
  },
  'appMenu.reportIssue': {
    'zh-CN': '报告问题',
    en: 'Report an issue',
  },
  'appMenu.toggleDevTools': {
    'zh-CN': '切换开发者工具',
    en: 'Toggle developer tools',
  },
} satisfies Record<string, Record<AppLanguage, string>>;

type AppMenuKey = keyof typeof appMenuDict;

export class AppMenuService extends DisposableService {
  private readonly logger: Logger;
  private readonly authService: AuthService;
  private readonly globalConfigService: GlobalConfigService;
  private readonly windowLayoutService: WindowLayoutService;

  // Store bound callback reference for proper unregistration
  private readonly boundUpdateApplicationMenu: () => void;

  constructor(
    logger: Logger,
    authService: AuthService,
    globalConfigService: GlobalConfigService,
    windowLayoutService: WindowLayoutService,
  ) {
    super();
    this.logger = logger;
    this.authService = authService;
    this.globalConfigService = globalConfigService;
    this.windowLayoutService = windowLayoutService;

    // Bind once and store reference for later unregistration
    this.boundUpdateApplicationMenu = this.updateApplicationMenu.bind(this);

    this.logger.debug('[AppMenuService] Initializing service');

    this.authService.registerAuthStateChangeCallback(
      this.boundUpdateApplicationMenu,
    );
    this.globalConfigService.addConfigUpdatedListener(
      this.boundUpdateApplicationMenu,
    );

    this.updateApplicationMenu();

    this.logger.debug('[AppMenuService] Service initialized');
  }

  protected onTeardown(): void {
    this.logger.debug('[AppMenuService] Teardown called');

    this.authService.unregisterAuthStateChangeCallback(
      this.boundUpdateApplicationMenu,
    );
    this.globalConfigService.removeConfigUpdatedListener(
      this.boundUpdateApplicationMenu,
    );

    app.applicationMenu = null;

    this.logger.debug('[AppMenuService] Teardown complete');
  }

  private t(key: AppMenuKey): string {
    const lang = this.globalConfigService.get().appLanguage ?? 'zh-CN';
    return appMenuDict[key][lang] ?? appMenuDict[key]['zh-CN'];
  }

  private updateApplicationMenu() {
    app.applicationMenu = Menu.buildFromTemplate([
      {
        label: app.name,
        id: 'about_menu',
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          {
            label: this.t('appMenu.settings'),
            accelerator: 'CmdOrCtrl+,',
            click: () => {
              this.windowLayoutService.openSettings();
            },
          },
          { type: 'separator' },
          {
            label: this.t('appMenu.openGithub'),
            click: () => {
              void this.windowLayoutService.openUrl(
                'https://github.com/stagewise-io/stagewise',
              );
            },
          },
          {
            label: this.t('appMenu.openDiscord'),
            click: () => {
              void this.windowLayoutService.openUrl(
                'https://stagewise.io/socials/discord',
              );
            },
          },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        role: 'editMenu',
      },
      {
        label: this.t('appMenu.user'),
        id: 'user_menu',
        submenu: (() => {
          switch (this.authService.authState.status) {
            case 'authenticated':
            case 'server_unreachable':
              return [
                {
                  id: 'user_menu_open_console',
                  label: this.t('appMenu.openConsole'),
                  click: () => {
                    void this.windowLayoutService.openUrl(
                      'https://console.stagewise.io',
                    );
                  },
                },
                { type: 'separator', id: 'user_menu_separator', visible: true },
                {
                  id: 'user_menu_logout',
                  label: this.t('appMenu.logout'),
                  click: () => {
                    void this.authService.logout();
                  },
                },
              ];
            case 'unauthenticated':
            case 'authentication_invalid':
              return [];
            default:
              return [
                {
                  id: 'user_menu_loading',
                  label: this.t('appMenu.loading'),
                  visible: true,
                },
              ];
          }
        })(),
      },
      {
        label: this.t('appMenu.help'),
        id: 'help_menu',
        submenu: [
          {
            id: 'help_menu_report_issue',
            label: this.t('appMenu.reportIssue'),
            click: () => {},
            visible: true,
          },
          { type: 'separator' },
          {
            id: 'help_menu_toggle_dev_tools',
            label: this.t('appMenu.toggleDevTools'),
            click: () => {
              this.windowLayoutService.toggleUIDevTools();
            },
            visible: true,
          },
        ],
      },
    ]);
  }
}
