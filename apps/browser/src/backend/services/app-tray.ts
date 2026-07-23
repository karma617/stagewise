import { Menu, Tray, app } from 'electron';
import path from 'node:path';
import type { AppLanguage } from '@shared/karton-contracts/ui/shared-types';
import { DisposableService } from './disposable';
import type { GlobalConfigService } from './global-config';
import type { Logger } from './logger';
import type { WindowLayoutService } from './window-layout';

const trayDict = {
  'tray.show': {
    'zh-CN': '显示 PickStar Studio',
    en: 'Show PickStar Studio',
  },
  'tray.hide': {
    'zh-CN': '隐藏窗口',
    en: 'Hide Window',
  },
  'tray.exit': {
    'zh-CN': '退出',
    en: 'Exit',
  },
} satisfies Record<string, Record<AppLanguage, string>>;

type TrayDictKey = keyof typeof trayDict;

function getTrayIconPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'icon.png');
  }

  return path.join(
    app.getAppPath(),
    'assets',
    'icons',
    __APP_RELEASE_CHANNEL__,
    'icon.png',
  );
}

export class AppTrayService extends DisposableService {
  private readonly logger: Logger;
  private readonly globalConfigService: GlobalConfigService;
  private readonly windowLayoutService: WindowLayoutService;
  private readonly boundUpdateContextMenu: () => void;
  private tray: Tray | null = null;

  constructor(
    logger: Logger,
    globalConfigService: GlobalConfigService,
    windowLayoutService: WindowLayoutService,
  ) {
    super();
    this.logger = logger;
    this.globalConfigService = globalConfigService;
    this.windowLayoutService = windowLayoutService;
    this.boundUpdateContextMenu = this.updateContextMenu.bind(this);

    this.logger.debug('[AppTrayService] Initializing service');

    this.tray = new Tray(getTrayIconPath());
    this.tray.setToolTip(__APP_NAME__);
    this.tray.on('click', () => this.windowLayoutService.showMainWindow());
    this.tray.on('double-click', () =>
      this.windowLayoutService.showMainWindow(),
    );

    this.globalConfigService.addConfigUpdatedListener(
      this.boundUpdateContextMenu,
    );
    this.updateContextMenu();

    this.logger.debug('[AppTrayService] Service initialized');
  }

  protected onTeardown(): void {
    this.logger.debug('[AppTrayService] Teardown called');

    this.globalConfigService.removeConfigUpdatedListener(
      this.boundUpdateContextMenu,
    );
    this.tray?.destroy();
    this.tray = null;

    this.logger.debug('[AppTrayService] Teardown complete');
  }

  private t(key: TrayDictKey): string {
    const lang = this.globalConfigService.get().appLanguage ?? 'zh-CN';
    return trayDict[key][lang] ?? trayDict[key]['zh-CN'];
  }

  private updateContextMenu(): void {
    if (!this.tray) return;

    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: this.t('tray.show'),
          click: () => this.windowLayoutService.showMainWindow(),
        },
        {
          label: this.t('tray.hide'),
          click: () => this.windowLayoutService.hideMainWindow(),
        },
        { type: 'separator' },
        {
          label: this.t('tray.exit'),
          click: () => this.windowLayoutService.quitFromTray(),
        },
      ]),
    );
  }
}
