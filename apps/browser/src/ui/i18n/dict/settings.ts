import type { Dict } from '../types';

// Settings panel translations. Keep grouped by section in declaration order:
//   general / personalization / models / browsing / history / clear-data /
//   plugins / skills-context / account / account-pool / auto-register /
//   proxy-pool / custom-providers / website-permissions / agent-worktree /
//   about.
export const settingsDict: Dict = {
  // ---- Navigation ----
  'settings.nav.back': {
    'zh-CN': '返回',
    en: 'Back',
  },
  'settings.nav.group.agent': {
    'zh-CN': '代理',
    en: 'Agent',
  },
  'settings.nav.group.personal': {
    'zh-CN': '个人',
    en: 'Personal',
  },
  'settings.nav.group.browsing': {
    'zh-CN': '浏览',
    en: 'Browsing',
  },
  'settings.nav.modelsProviders': {
    'zh-CN': '模型与提供商',
    en: 'Models & Providers',
  },
  'settings.nav.customProviders': {
    'zh-CN': '自定义提供商',
    en: 'Custom Providers',
  },
  'settings.nav.agentGeneral': {
    'zh-CN': '通用',
    en: 'General',
  },
  'settings.nav.skillsContext': {
    'zh-CN': '技能与上下文文件',
    en: 'Skills & Context files',
  },
  'settings.nav.worktrees': {
    'zh-CN': 'Worktree',
    en: 'Worktrees',
  },
  'settings.nav.plugins': {
    'zh-CN': '插件',
    en: 'Plugins',
  },
  'settings.nav.personalization': {
    'zh-CN': '个性化',
    en: 'Personalization',
  },
  'settings.nav.browsing': {
    'zh-CN': '通用',
    en: 'General',
  },
  'settings.nav.history': {
    'zh-CN': '历史记录',
    en: 'History',
  },
  'settings.nav.websitePermissions': {
    'zh-CN': '网站权限',
    en: 'Website Permissions',
  },
  'settings.nav.clearData': {
    'zh-CN': '清除数据',
    en: 'Clear data',
  },
  'settings.nav.account': {
    'zh-CN': '账号',
    en: 'Account',
  },
  'settings.nav.autoRegister': {
    'zh-CN': '自动注册配置',
    en: 'Auto-register',
  },
  'settings.nav.accountPool': {
    'zh-CN': '账号池',
    en: 'Account pool',
  },
  'settings.nav.proxyPool': {
    'zh-CN': '代理池',
    en: 'Proxy pool',
  },
  'settings.nav.about': {
    'zh-CN': '关于',
    en: 'About',
  },

  // ---- General ----
  'settings.general.title': {
    'zh-CN': '通用',
    en: 'General',
  },
  'settings.general.language.label': {
    'zh-CN': '界面语言',
    en: 'Interface language',
  },
  'settings.general.language.description': {
    'zh-CN': '选择软件界面显示语言，默认为中文。',
    en: 'Choose the display language for the application. Defaults to Chinese.',
  },
  'settings.general.language.zh-CN': {
    'zh-CN': '中文',
    en: 'Chinese',
  },
  'settings.general.language.en': {
    'zh-CN': '英文',
    en: 'English',
  },
  'settings.general.powerSave.title': {
    'zh-CN': '代理运行时保持应用活跃',
    en: 'Keep app awake while agents work',
  },
  'settings.general.powerSave.description': {
    'zh-CN':
      '防止代理运行工具循环或其他活动任务时应用被挂起。等待问题或工具审批仍算作空闲。',
    en: 'Prevent app suspension while agents run tool loops or other active work. Waiting for questions or tool approval still counts as idle.',
  },
  'settings.general.notifications.title': {
    'zh-CN': '通知声音',
    en: 'Notification sounds',
  },
  'settings.general.notifications.description': {
    'zh-CN': '当代理完成工作、提出问题或遇到错误时播放声音。',
    en: 'Play a sound when the agent finishes work, asks a question, or encounters an error.',
  },
  'settings.general.powerSave.macWarning': {
    'zh-CN':
      '在 macOS 上即使使用电池供电（包括合盖场景），要避免休眠，请在侧边栏右下角启用“保持活跃”模式。',
    en: 'To prevent sleep in battery mode on macOS, including when the lid is closed, enable Keep awake mode in the bottom-right corner of the sidebar.',
  },
  'settings.general.llmNetwork.title': {
    'zh-CN': '对话请求网络',
    en: 'Chat request network',
  },
  'settings.general.llmNetwork.description': {
    'zh-CN':
      '所有 LLM 对话请求会走这里配置的本地代理；遇到 Forbidden 时可通过 Clash 接口切换节点后自动重试。默认使用本机 7897 代理和 9097 Clash Controller。',
    en: 'All LLM chat requests use this local proxy. When Forbidden occurs, Stagewise can ask Clash to switch nodes and retry automatically. Defaults use local proxy 7897 and Clash controller 9097.',
  },
  'settings.general.llmNetwork.proxyUrl': {
    'zh-CN': '本地 HTTP 代理',
    en: 'Local HTTP proxy',
  },
  'settings.general.llmNetwork.clashApiUrl': {
    'zh-CN': 'Clash Controller 地址',
    en: 'Clash controller URL',
  },
  'settings.general.llmNetwork.clashSecret': {
    'zh-CN': 'Clash Secret',
    en: 'Clash secret',
  },
  'settings.general.llmNetwork.clashSecretPlaceholder': {
    'zh-CN': '默认已设置；留空时使用默认 Secret',
    en: 'Set by default; empty value uses the default secret',
  },
  'settings.general.llmNetwork.clashProxyGroup': {
    'zh-CN': 'Clash 代理组名',
    en: 'Clash proxy group',
  },
  'settings.general.llmNetwork.clashProxyGroupPlaceholder': {
    'zh-CN': '默认 GLOBAL，也可填写节点选择等代理组',
    en: 'Defaults to GLOBAL; enter another selector group if needed',
  },
  'settings.general.llmNetwork.note': {
    'zh-CN':
      '自动切换只在 LLM 请求返回 403/Forbidden 时触发；地址、Secret 或代理组留空时会使用默认值，默认代理组是 GLOBAL。',
    en: 'Automatic switching only triggers on 403/Forbidden LLM responses. Empty URL, secret, or group values use defaults; the default group is GLOBAL.',
  },
  'settings.general.notifications.loudness': {
    'zh-CN': '音量',
    en: 'Loudness',
  },
  'settings.general.notifications.soundPack': {
    'zh-CN': '声音主题',
    en: 'Sound pack',
  },
  'settings.general.notifications.loudness.off': {
    'zh-CN': '关闭',
    en: 'Off',
  },
  'settings.general.notifications.loudness.subtle': {
    'zh-CN': '轻柔',
    en: 'Subtle',
  },
  'settings.general.notifications.loudness.default': {
    'zh-CN': '响亮',
    en: 'Loud',
  },
  'settings.general.notifications.previewSound': {
    'zh-CN': '试听声音',
    en: 'Preview sound',
  },
  'settings.general.notifications.useCustomSound': {
    'zh-CN': '使用自定义声音…',
    en: 'Use custom sound…',
  },
  'settings.general.notifications.import.successTitle': {
    'zh-CN': '自定义声音已导入',
    en: 'Custom sound imported',
  },
  'settings.general.notifications.import.successMessage': {
    'zh-CN': '「{name}」已设置为当前通知声音。',
    en: '{name} is now selected for notifications.',
  },
  'settings.general.notifications.import.errorTitle': {
    'zh-CN': '自定义声音导入失败',
    en: 'Custom sound import failed',
  },
  'settings.general.notifications.import.errorFallback': {
    'zh-CN': '自定义声音导入失败。',
    en: 'Custom sound import failed.',
  },
  'settings.general.notifications.dockBounce.title': {
    'zh-CN': 'Dock 图标跳动',
    en: 'Dock icon bounce',
  },
  'settings.general.notifications.dockBounce.description': {
    'zh-CN':
      '当窗口未获得焦点时，代理完成、提出问题或遇到错误会让 Dock 图标跳动提示。',
    en: 'Bounce the dock icon when the agent finishes, asks a question, or encounters an error while the window is not focused.',
  },

  // ---- Personalization ----
  'settings.personalization.title': {
    'zh-CN': '个性化',
    en: 'Personalization',
  },
  'settings.personalization.uiSize.title': {
    'zh-CN': '界面缩放',
    en: 'UI size',
  },
  'settings.personalization.uiSize.description': {
    'zh-CN': '独立于网页缩放调整 stagewise 界面大小。',
    en: 'Scale the stagewise interface independently from web page zoom.',
  },
  'settings.personalization.uiSize.small': {
    'zh-CN': '小',
    en: 'Small',
  },
  'settings.personalization.uiSize.default': {
    'zh-CN': '默认',
    en: 'Default',
  },
  'settings.personalization.uiSize.large': {
    'zh-CN': '大',
    en: 'Large',
  },
  'settings.personalization.appearance.title': {
    'zh-CN': '外观',
    en: 'Appearance',
  },
  'settings.personalization.appearance.description': {
    'zh-CN': '选择跟随系统外观，或始终使用浅色/深色主题。',
    en: 'Choose whether stagewise follows your system appearance or always uses light or dark mode.',
  },
  'settings.personalization.appearance.system': {
    'zh-CN': '跟随系统',
    en: 'System',
  },
  'settings.personalization.appearance.light': {
    'zh-CN': '浅色',
    en: 'Light',
  },
  'settings.personalization.appearance.dark': {
    'zh-CN': '深色',
    en: 'Dark',
  },
  'settings.personalization.colorScheme.title': {
    'zh-CN': '调色主题',
    en: 'Color scheme',
  },
  'settings.personalization.colorScheme.description': {
    'zh-CN': '按你的喜好调整 stagewise 的颜色风格。',
    en: 'Adapt the color style of your stagewise setup to your liking.',
  },
  'settings.personalization.theme.default': {
    'zh-CN': '默认',
    en: 'Default',
  },
  'settings.personalization.theme.fire': {
    'zh-CN': '烈焰',
    en: 'Fire',
  },
  'settings.personalization.theme.forest': {
    'zh-CN': '森林',
    en: 'Forest',
  },
  'settings.personalization.theme.bubblegum': {
    'zh-CN': '泡泡糖',
    en: 'Bubblegum',
  },
  'settings.personalization.theme.titanium': {
    'zh-CN': '钛金',
    en: 'Titanium',
  },
  'settings.personalization.theme.useAria': {
    'zh-CN': '使用 {name} 主题',
    en: 'Use {name} theme',
  },

  // ---- Clear data ----
  'settings.clearData.title': {
    'zh-CN': '清除数据',
    en: 'Clear Data',
  },
  'settings.clearData.selectHeader': {
    'zh-CN': '选择要清除的数据',
    en: 'Select data to clear',
  },
  'settings.clearData.option.history.label': {
    'zh-CN': '浏览历史',
    en: 'Browsing history',
  },
  'settings.clearData.option.history.description': {
    'zh-CN': '网址、访问记录与搜索词',
    en: 'URLs, visits, and search terms',
  },
  'settings.clearData.option.downloads.label': {
    'zh-CN': '下载记录',
    en: 'Download history',
  },
  'settings.clearData.option.downloads.description': {
    'zh-CN': '已下载文件的记录（不包含文件本身）',
    en: 'List of downloaded files (not the files themselves)',
  },
  'settings.clearData.option.cookies.label': {
    'zh-CN': 'Cookies',
    en: 'Cookies',
  },
  'settings.clearData.option.cookies.description': {
    'zh-CN': '站点 Cookie 与登录会话',
    en: 'Site cookies and login sessions',
  },
  'settings.clearData.option.cache.label': {
    'zh-CN': '缓存的图片和文件',
    en: 'Cached images and files',
  },
  'settings.clearData.option.cache.description': {
    'zh-CN': '用于加速页面加载的 HTTP 缓存',
    en: 'HTTP cache for faster page loading',
  },
  'settings.clearData.option.storage.label': {
    'zh-CN': '本地存储',
    en: 'Local storage',
  },
  'settings.clearData.option.storage.description': {
    'zh-CN': 'localStorage 与 sessionStorage 数据',
    en: 'localStorage and sessionStorage data',
  },
  'settings.clearData.option.indexedDB.label': {
    'zh-CN': 'IndexedDB',
    en: 'IndexedDB',
  },
  'settings.clearData.option.indexedDB.description': {
    'zh-CN': '网站存储的结构化数据',
    en: 'Structured data stored by websites',
  },
  'settings.clearData.option.cacheStorage.label': {
    'zh-CN': 'Cache Storage',
    en: 'Cache Storage',
  },
  'settings.clearData.option.cacheStorage.description': {
    'zh-CN': 'Web 应用使用的 Cache API 存储',
    en: 'Cache API storage used by web apps',
  },
  'settings.clearData.option.serviceWorkers.label': {
    'zh-CN': 'Service Workers',
    en: 'Service Workers',
  },
  'settings.clearData.option.serviceWorkers.description': {
    'zh-CN': '提供离线能力的后台脚本',
    en: 'Background scripts that power offline functionality',
  },
  'settings.clearData.option.favicons.label': {
    'zh-CN': '缓存的网站图标',
    en: 'Cached favicons',
  },
  'settings.clearData.option.favicons.description': {
    'zh-CN': '站点图标与图片',
    en: 'Site icons and images',
  },
  'settings.clearData.option.permissionExceptions.label': {
    'zh-CN': '站点权限设置',
    en: 'Site permission settings',
  },
  'settings.clearData.option.permissionExceptions.description': {
    'zh-CN': '针对摄像头、位置等已保存的允许/拒绝设置',
    en: 'Saved Allow/Block choices for camera, location, etc.',
  },
  'settings.clearData.button.clearing': {
    'zh-CN': '正在清除…',
    en: 'Clearing...',
  },
  'settings.clearData.button.clearLast24h': {
    'zh-CN': '清除近 24 小时',
    en: 'Clear last 24 hours',
  },
  'settings.clearData.button.clearAllTime': {
    'zh-CN': '清除全部时间',
    en: 'Clear all time',
  },
  'settings.clearData.error.selectAtLeastOne': {
    'zh-CN': '请至少选择一种要清除的数据类型',
    en: 'Please select at least one data type to clear',
  },
  'settings.clearData.error.clearFailed': {
    'zh-CN': '清除数据失败',
    en: 'Failed to clear data',
  },
  'settings.clearData.success.cleared': {
    'zh-CN': '已成功清除: {items}',
    en: 'Successfully cleared {items}',
  },
  'settings.clearData.success.fallback': {
    'zh-CN': '数据清除成功',
    en: 'Data cleared successfully',
  },
  'settings.clearData.summary.historyEntry': {
    'zh-CN': '{n} 条浏览历史',
    en: '{n} history entry',
  },
  'settings.clearData.summary.historyEntries': {
    'zh-CN': '{n} 条浏览历史',
    en: '{n} history entries',
  },
  'settings.clearData.summary.downloads': {
    'zh-CN': '下载记录',
    en: 'downloads',
  },
  'settings.clearData.summary.favicons': {
    'zh-CN': '{n} 个图标',
    en: '{n} favicons',
  },
  'settings.clearData.summary.cookies': {
    'zh-CN': 'Cookie',
    en: 'cookies',
  },
  'settings.clearData.summary.cache': {
    'zh-CN': '缓存',
    en: 'cache',
  },
  'settings.clearData.summary.storage': {
    'zh-CN': '本地存储',
    en: 'storage',
  },
  'settings.clearData.summary.sitePermissions': {
    'zh-CN': '站点权限设置',
    en: 'site permission settings',
  },

  // ---- Website permissions ----
  'settings.websitePermissions.title': {
    'zh-CN': '网站权限',
    en: 'Website Permissions',
  },
  'settings.websitePermissions.noHostSelected': {
    'zh-CN': '未选择网站，请在「浏览设置」页面选择一个网站。',
    en: 'No website selected. Please select a website from the Browsing Settings page.',
  },
  'settings.websitePermissions.summary.none': {
    'zh-CN': '未为此站点设置自定义权限，全部使用全局默认值。',
    en: 'No custom permissions set for this site. All permissions use global defaults.',
  },
  'settings.websitePermissions.summary.count': {
    'zh-CN': '已为此站点设置 {n} 项自定义权限。',
    en: '{n} custom permission(s) set for this site.',
  },
  'settings.websitePermissions.section.title': {
    'zh-CN': '权限设置',
    en: 'Permission Settings',
  },
  'settings.websitePermissions.section.description': {
    'zh-CN': '配置此站点可以访问哪些浏览器能力。',
    en: 'Configure how this site can access browser features.',
  },
  'settings.websitePermissions.customSetting': {
    'zh-CN': '自定义设置',
    en: 'Custom setting',
  },
  'settings.websitePermissions.option.default.label': {
    'zh-CN': '默认',
    en: 'Default',
  },
  'settings.websitePermissions.option.default.description': {
    'zh-CN': '使用全局默认值（{default}）',
    en: 'Use global default ({default})',
  },
  'settings.websitePermissions.option.ask.label': {
    'zh-CN': '每次询问',
    en: 'Ask',
  },
  'settings.websitePermissions.option.ask.description': {
    'zh-CN': '每次都询问',
    en: 'Ask every time',
  },
  'settings.websitePermissions.option.allow.label': {
    'zh-CN': '允许',
    en: 'Allow',
  },
  'settings.websitePermissions.option.allow.description': {
    'zh-CN': '始终允许此站点',
    en: 'Always allow for this site',
  },
  'settings.websitePermissions.option.block.label': {
    'zh-CN': '拒绝',
    en: 'Block',
  },
  'settings.websitePermissions.option.block.description': {
    'zh-CN': '始终拒绝此站点',
    en: 'Always block for this site',
  },
  'settings.websitePermissions.permission.media': {
    'zh-CN': '摄像头与麦克风',
    en: 'Camera & Microphone',
  },
  'settings.websitePermissions.permission.geolocation': {
    'zh-CN': '位置',
    en: 'Location',
  },
  'settings.websitePermissions.permission.notifications': {
    'zh-CN': '通知',
    en: 'Notifications',
  },
  'settings.websitePermissions.permission.fullscreen': {
    'zh-CN': '全屏',
    en: 'Fullscreen',
  },
  'settings.websitePermissions.permission.bluetooth': {
    'zh-CN': '蓝牙',
    en: 'Bluetooth',
  },
  'settings.websitePermissions.permission.hid': {
    'zh-CN': 'HID 设备',
    en: 'HID Devices',
  },
  'settings.websitePermissions.permission.serial': {
    'zh-CN': '串口',
    en: 'Serial Ports',
  },
  'settings.websitePermissions.permission.usb': {
    'zh-CN': 'USB 设备',
    en: 'USB Devices',
  },
  'settings.websitePermissions.permission.clipboard-read': {
    'zh-CN': '读取剪贴板',
    en: 'Clipboard Read',
  },
  'settings.websitePermissions.permission.display-capture': {
    'zh-CN': '屏幕捕获',
    en: 'Screen Capture',
  },
  'settings.websitePermissions.permission.midi': {
    'zh-CN': 'MIDI 设备',
    en: 'MIDI Devices',
  },
  'settings.websitePermissions.permission.idle-detection': {
    'zh-CN': '空闲检测',
    en: 'Idle Detection',
  },
  'settings.websitePermissions.permission.speaker-selection': {
    'zh-CN': '扣选扬声器',
    en: 'Speaker Selection',
  },
  'settings.websitePermissions.permission.storage-access': {
    'zh-CN': '存储访问',
    en: 'Storage Access',
  },

  // ---- Plugins ----
  'settings.plugins.title': {
    'zh-CN': '插件',
    en: 'Plugins',
  },
  'settings.plugins.description': {
    'zh-CN': '启用或禁用插件，为代理扩展额外的能力。',
    en: "Enable or disable plugins to extend the agent's capabilities with additional skills.",
  },
  'settings.plugins.enabled': {
    'zh-CN': '已启用',
    en: 'Enabled',
  },
  'settings.plugins.disabled': {
    'zh-CN': '已禁用',
    en: 'Disabled',
  },
  'settings.plugins.meta.skillsSingular': {
    'zh-CN': '{n} 个技能',
    en: '{n} skill',
  },
  'settings.plugins.meta.skillsPlural': {
    'zh-CN': '{n} 个技能',
    en: '{n} skills',
  },
  'settings.plugins.meta.credentials': {
    'zh-CN': '凭证',
    en: 'credentials',
  },
  'settings.plugins.meta.credentialSingular': {
    'zh-CN': '{n} 个凭证',
    en: '{n} credential',
  },
  'settings.plugins.meta.credentialPlural': {
    'zh-CN': '{n} 个凭证',
    en: '{n} credentials',
  },
  'settings.plugins.credential.enterPlaceholder': {
    'zh-CN': '请输入{label}…',
    en: 'Enter {label}...',
  },
  'settings.plugins.credential.save': {
    'zh-CN': '保存',
    en: 'Save',
  },
  'settings.plugins.credential.clear': {
    'zh-CN': '清除',
    en: 'Clear',
  },
  'settings.plugins.credential.learnMore': {
    'zh-CN': '（了解更多）',
    en: '(Learn more)',
  },

  // ---- Proxy pool ----
  'settings.proxyPool.title': {
    'zh-CN': '代理池',
    en: 'Proxy pool',
  },
  'settings.proxyPool.description': {
    'zh-CN':
      '支持批量添加、地区标记和启停用；自动注册时只会从启用代理里随机选择一个。未配置则使用系统代理或直连。',
    en: 'Add proxies in bulk, tag them by region, and toggle them on or off. Auto-register picks one randomly from the enabled list; otherwise it uses the system proxy or a direct connection.',
  },
  'settings.proxyPool.llmSwitch.title': {
    'zh-CN': 'LLM 对话优先使用代理池',
    en: 'Prefer proxy pool for LLM chat',
  },
  'settings.proxyPool.llmSwitch.description': {
    'zh-CN':
      '默认关闭。打开后，LLM 对话请求会优先从启用代理里随机选择；没有可用代理时回落到本地系统代理配置。',
    en: 'Off by default. When enabled, LLM chat requests pick randomly from enabled proxies first, then fall back to the local system proxy setting when none are available.',
  },
  'settings.proxyPool.metric.total': {
    'zh-CN': '总数',
    en: 'Total',
  },
  'settings.proxyPool.metric.active': {
    'zh-CN': '启用',
    en: 'Active',
  },
  'settings.proxyPool.metric.success': {
    'zh-CN': '成功',
    en: 'Success',
  },
  'settings.proxyPool.metric.fail': {
    'zh-CN': '失败',
    en: 'Failed',
  },
  'settings.proxyPool.add.title': {
    'zh-CN': '添加代理',
    en: 'Add proxies',
  },
  'settings.proxyPool.add.description': {
    'zh-CN': '每行一个，重复地址会自动跳过。',
    en: 'One per line. Duplicate URLs are skipped automatically.',
  },
  'settings.proxyPool.add.regionPlaceholder': {
    'zh-CN': '地区标记（可选）',
    en: 'Region label (optional)',
  },
  'settings.proxyPool.add.submit': {
    'zh-CN': '添加到代理池',
    en: 'Add to proxy pool',
  },
  'settings.proxyPool.list.title': {
    'zh-CN': '代理列表',
    en: 'Proxy list',
  },
  'settings.proxyPool.list.testing': {
    'zh-CN': '检测中…',
    en: 'Testing...',
  },
  'settings.proxyPool.list.test': {
    'zh-CN': '测试',
    en: 'Test',
  },
  'settings.proxyPool.table.url': {
    'zh-CN': '地址',
    en: 'URL',
  },
  'settings.proxyPool.table.region': {
    'zh-CN': '地区',
    en: 'Region',
  },
  'settings.proxyPool.table.successFail': {
    'zh-CN': '成功 / 失败',
    en: 'Success / Fail',
  },
  'settings.proxyPool.table.status': {
    'zh-CN': '状态',
    en: 'Status',
  },
  'settings.proxyPool.table.actions': {
    'zh-CN': '操作',
    en: 'Actions',
  },
  'settings.proxyPool.table.empty': {
    'zh-CN': '暂无代理',
    en: 'No proxies yet',
  },
  'settings.proxyPool.status.enabled': {
    'zh-CN': '启用',
    en: 'Enabled',
  },
  'settings.proxyPool.status.disabled': {
    'zh-CN': '停用',
    en: 'Disabled',
  },
  'settings.proxyPool.action.disable': {
    'zh-CN': '停用',
    en: 'Disable',
  },
  'settings.proxyPool.action.enable': {
    'zh-CN': '启用',
    en: 'Enable',
  },
  'settings.proxyPool.action.delete': {
    'zh-CN': '删除',
    en: 'Delete',
  },
  'settings.proxyPool.notice.saveFailed': {
    'zh-CN': '保存失败',
    en: 'Save failed',
  },
  'settings.proxyPool.notice.duplicated': {
    'zh-CN': '代理已存在',
    en: 'Proxy already exists',
  },
  'settings.proxyPool.notice.added': {
    'zh-CN': '已添加',
    en: 'Added',
  },
  'settings.proxyPool.notice.updated': {
    'zh-CN': '已更新',
    en: 'Updated',
  },
  'settings.proxyPool.notice.deleted': {
    'zh-CN': '已删除',
    en: 'Deleted',
  },
  'settings.proxyPool.notice.empty': {
    'zh-CN': '暂无代理',
    en: 'No proxies yet',
  },
  'settings.proxyPool.notice.testSummary': {
    'zh-CN': '检测完成：可用 {ok}，不可用 {fail}',
    en: 'Test finished: {ok} available, {fail} unavailable',
  },
  'settings.proxyPool.notice.testFailed': {
    'zh-CN': '检测失败：{err}',
    en: 'Test failed: {err}',
  },

  // ---- Auto register ----
  'settings.autoRegister.title': {
    'zh-CN': '自动注册配置',
    en: 'Auto-register configuration',
  },
  'settings.autoRegister.description': {
    'zh-CN': '配置邮箱池参数，用于账号配额达到上限时自动注册并切换新账号。',
    en: 'Configure mailbox-pool parameters so a new account is registered and switched in automatically when the current account hits its quota.',
  },
  'settings.autoRegister.section.mailbox': {
    'zh-CN': '邮箱池设置',
    en: 'Mailbox pool settings',
  },
  'settings.autoRegister.field.mailboxService': {
    'zh-CN': '邮箱服务',
    en: 'Mailbox service',
  },
  'settings.autoRegister.mailbox.outlookManagerPlus': {
    'zh-CN': 'OutlookManagerPlus',
    en: 'OutlookManagerPlus',
  },
  'settings.autoRegister.field.apiUrl': {
    'zh-CN': 'API URL',
    en: 'API URL',
  },
  'settings.autoRegister.field.apiBase': {
    'zh-CN': 'API Base',
    en: 'API Base',
  },
  'settings.autoRegister.field.apiKey': {
    'zh-CN': 'API Key',
    en: 'API Key',
  },
  'settings.autoRegister.field.apiKeyOptional': {
    'zh-CN': 'API Key（可选）',
    en: 'API Key (optional)',
  },
  'settings.autoRegister.field.adminPassword': {
    'zh-CN': '管理密码',
    en: 'Admin password',
  },
  'settings.autoRegister.field.domain': {
    'zh-CN': '域名',
    en: 'Domain',
  },
  'settings.autoRegister.field.domainOptional': {
    'zh-CN': '域名（可选）',
    en: 'Domain (optional)',
  },
  'settings.autoRegister.field.expiryTime': {
    'zh-CN': '过期时间',
    en: 'Expiry time',
  },
  'settings.autoRegister.field.randomSubdomain': {
    'zh-CN': '随机子域名',
    en: 'Random subdomain',
  },
  'settings.autoRegister.field.defaultDomain': {
    'zh-CN': '默认域名',
    en: 'Default domain',
  },
  'settings.autoRegister.field.groupId': {
    'zh-CN': '群组 ID',
    en: 'Group ID',
  },
  'settings.autoRegister.field.tagIds': {
    'zh-CN': '标签 ID',
    en: 'Tag IDs',
  },
  'settings.autoRegister.field.emailFolder': {
    'zh-CN': '邮件文件夹',
    en: 'Mail folder',
  },
  'settings.autoRegister.field.emailTop': {
    'zh-CN': '取件数量',
    en: 'Messages per fetch',
  },
  'settings.autoRegister.field.pollInterval': {
    'zh-CN': '轮询间隔 (ms)',
    en: 'Poll interval (ms)',
  },
  'settings.autoRegister.section.captcha': {
    'zh-CN': '安全验证方式',
    en: 'Security verification',
  },
  'settings.autoRegister.captcha.description': {
    'zh-CN':
      '选择 Turnstile 验证码的获取方式。推荐使用真实浏览器页面流，让 Cloudflare 在可见窗口中完成正常验证。',
    en: 'Choose how Turnstile verification is completed. The recommended option uses the real browser page flow so Cloudflare can complete verification in a visible window.',
  },
  'settings.autoRegister.captcha.label': {
    'zh-CN': '验证方式',
    en: 'Provider',
  },
  'settings.autoRegister.captcha.consoleHandoff': {
    'zh-CN': '浏览器授权（默认）',
    en: 'Browser handoff (default)',
  },
  'settings.autoRegister.captcha.consoleHandoffHint': {
    'zh-CN':
      '点击注册后会打开系统浏览器，在浏览器中完成邮箱验证后自动登录。此方式不支持批量自动注册。',
    en: 'Sign-in opens in the system browser. After completing the email verification, you are signed in automatically. Batch auto-register is not supported in this mode.',
  },
  'settings.autoRegister.captcha.browserUiFlow': {
    'zh-CN': '真实浏览器页面注册',
    en: 'Real browser page registration',
  },
  'settings.autoRegister.captcha.browserUiFlowHint': {
    'zh-CN':
      '启动一个可见的隔离 Electron 窗口加载 console.stagewise.io 登录页，页面自行完成 Turnstile，必要时可手动交互，然后自动填入邮箱与 OTP。',
    en: 'Opens a visible isolated Electron window for the real console.stagewise.io sign-in page. The page completes Turnstile itself, allows manual interaction when needed, then auto-fills email and OTP.',
  },
  'settings.autoRegister.captcha.apiKey': {
    'zh-CN': 'API Key',
    en: 'API Key',
  },
  'settings.autoRegister.test.success': {
    'zh-CN': '连接成功，共 {n} 个可用账号',
    en: 'Connection succeeded, {n} accounts available',
  },
  'settings.autoRegister.test.fail': {
    'zh-CN': '连接失败：{err}',
    en: 'Connection failed: {err}',
  },
  'settings.autoRegister.register.success': {
    'zh-CN': '注册成功：',
    en: 'Registration succeeded: ',
  },
  'settings.autoRegister.button.testing': {
    'zh-CN': '测试中…',
    en: 'Testing...',
  },
  'settings.autoRegister.button.test': {
    'zh-CN': '测试连接',
    en: 'Test connection',
  },
  'settings.autoRegister.button.saveBack': {
    'zh-CN': '保存',
    en: 'Save',
  },
  'settings.autoRegister.button.saving': {
    'zh-CN': '保存中…',
    en: 'Saving...',
  },
  'settings.autoRegister.save.success': {
    'zh-CN': '已保存自动注册配置',
    en: 'Auto-register configuration saved',
  },
  'settings.autoRegister.save.fail': {
    'zh-CN': '保存失败：{err}',
    en: 'Save failed: {err}',
  },

  // ---- Skills & context files ----
  'settings.skillsContext.title': {
    'zh-CN': '技能与上下文文件',
    en: 'Skills & Context files',
  },
  'settings.skillsContext.description': {
    'zh-CN': '按工作区配置 stagewise 代理可用的上下文文件与技能。',
    en: 'Per-workspace configuration, context files, and skills for the stagewise agent.',
  },
  'settings.skillsContext.noWorkspaces': {
    'zh-CN': '当前未连接工作区。请先为代理连接一个工作区后再进行配置。',
    en: 'No workspaces are currently connected. Connect a workspace to an agent to configure workspace-specific settings.',
  },
  'settings.skillsContext.skills.title': {
    'zh-CN': '技能',
    en: 'Skills',
  },
  'settings.skillsContext.skills.description': {
    'zh-CN': '为当前工作区启用或禁用技能。',
    en: 'Enable or disable skills for this workspace.',
  },
  'settings.skillsContext.skills.empty': {
    'zh-CN': '当前工作区未检测到技能。',
    en: 'No skills detected in this workspace.',
  },
  'settings.skillsContext.contextFiles.title': {
    'zh-CN': '上下文文件',
    en: 'Context files',
  },
  'settings.skillsContext.contextFiles.description': {
    'zh-CN': '管理代理使用的工作区上下文文件。',
    en: 'Manage workspace context files used by the AI agent.',
  },
  'settings.skillsContext.workspaceMd.generated': {
    'zh-CN': '自动生成的项目分析。',
    en: 'Auto-generated project analysis.',
  },
  'settings.skillsContext.workspaceMd.notGenerated': {
    'zh-CN': '尚未生成。',
    en: 'Not yet generated.',
  },
  'settings.skillsContext.workspaceMd.updating': {
    'zh-CN': '更新中…',
    en: 'Updating…',
  },
  'settings.skillsContext.workspaceMd.generating': {
    'zh-CN': '生成中…',
    en: 'Generating…',
  },
  'settings.skillsContext.workspaceMd.regenerate': {
    'zh-CN': '重新生成',
    en: 'Regenerate',
  },
  'settings.skillsContext.workspaceMd.generate': {
    'zh-CN': '生成',
    en: 'Generate',
  },
  'settings.skillsContext.agentsMd.includeInContext': {
    'zh-CN': '包含在代理上下文中',
    en: 'Include in agent context',
  },

  // ---- History ----
  'settings.history.title': {
    'zh-CN': '浏览历史',
    en: 'History',
  },
  'settings.history.searchPlaceholder': {
    'zh-CN': '搜索历史',
    en: 'Search history',
  },
  'settings.history.error.loadFailed': {
    'zh-CN': '加载历史失败',
    en: 'Failed to load history',
  },
  'settings.history.error.technicalDetails': {
    'zh-CN': '技术详情（开发模式）',
    en: 'Technical details (dev mode)',
  },
  'settings.history.retry': {
    'zh-CN': '重试',
    en: 'Retry',
  },
  'settings.history.empty.noSearchResults': {
    'zh-CN': '未找到匹配的历史记录',
    en: 'No history found matching your search',
  },
  'settings.history.empty.noHistory': {
    'zh-CN': '暂无历史记录',
    en: 'No history yet',
  },
  'settings.history.copyLink': {
    'zh-CN': '复制链接',
    en: 'Copy link',
  },
  'settings.history.copied': {
    'zh-CN': '已复制！',
    en: 'Copied!',
  },
  // ---- account pool ----
  'settings.accountPool.status.normal': {
    'zh-CN': '正常',
    en: 'Normal',
  },
  'settings.accountPool.status.throttled': {
    'zh-CN': '限流中',
    en: 'Throttled',
  },
  'settings.accountPool.status.dailyLimit': {
    'zh-CN': '\u65e5\u9650\u989d',
    en: 'Daily limit',
  },
  'settings.accountPool.status.weeklyLimit': {
    'zh-CN': '\u5468\u9650\u989d',
    en: 'Weekly limit',
  },
  'settings.accountPool.status.monthlyLimit': {
    'zh-CN': '\u6708\u9650\u989d',
    en: 'Monthly limit',
  },
  'settings.accountPool.status.banned': {
    'zh-CN': '已封禁',
    en: 'Banned',
  },
  'settings.accountPool.status.observing': {
    'zh-CN': '待观察',
    en: 'Observing',
  },
  'settings.accountPool.window.daily': {
    'zh-CN': '日额度',
    en: 'Daily quota',
  },
  'settings.accountPool.window.weekly': {
    'zh-CN': '周额度',
    en: 'Weekly quota',
  },
  'settings.accountPool.window.monthly': {
    'zh-CN': '月额度',
    en: 'Monthly quota',
  },
  'settings.accountPool.usage.empty': {
    'zh-CN': '用量信息未获取，点击「健康检测」或刷新获取。',
    en: 'Usage not loaded yet. Click "Health Check" or Refresh to fetch.',
  },
  'settings.accountPool.usage.prepaid': {
    'zh-CN': '预付费余额：$',
    en: 'Prepaid balance: $',
  },
  'settings.accountPool.usage.refreshedAt': {
    'zh-CN': '刷新于 ',
    en: 'Refreshed at ',
  },
  'settings.accountPool.usage.resetsAt': {
    'zh-CN': '重置 ',
    en: 'Resets at ',
  },
  'settings.accountPool.error.configMissing': {
    'zh-CN': '配置缺失，请先到《自动注册配置》填写邮箱池参数。',
    en: 'Configuration missing. Open "Auto-register settings" and fill in the mailbox pool parameters.',
  },
  'settings.accountPool.error.startFailed': {
    'zh-CN': '启动失败：',
    en: 'Failed to start: ',
  },
  'settings.accountPool.title': {
    'zh-CN': '账号池',
    en: 'Account pool',
  },
  'settings.accountPool.description': {
    'zh-CN': '已注册的账号列表，可切换或删除。',
    en: 'List of registered accounts. You can switch or remove them.',
  },
  'settings.accountPool.overview.total': {
    'zh-CN': '总账号数',
    en: 'Total accounts',
  },
  'settings.accountPool.overview.available': {
    'zh-CN': '可用账号数',
    en: 'Available',
  },
  'settings.accountPool.overview.dailyLimit': {
    'zh-CN': '日限额数',
    en: 'Daily limit',
  },
  'settings.accountPool.overview.weeklyLimit': {
    'zh-CN': '周限额数',
    en: 'Weekly limit',
  },
  'settings.accountPool.overview.monthlyLimit': {
    'zh-CN': '月限额数',
    en: 'Monthly limit',
  },
  'settings.accountPool.overview.banned': {
    'zh-CN': '已封禁数',
    en: 'Banned',
  },
  'settings.accountPool.overview.observing': {
    'zh-CN': '待观察数',
    en: 'Observing',
  },
  'settings.accountPool.autoSwitchRetry.title': {
    'zh-CN': '自动切换失败重试次数',
    en: 'Auto-switch retry attempts',
  },
  'settings.accountPool.autoSwitchRetry.description': {
    'zh-CN':
      '当前帐号达到额度上限后，自动切换可用帐号异常时最多重试这么多次。默认 30 次。',
    en: 'When the current account reaches its quota, retry automatic account switching this many times after failures. Default: 30.',
  },
  'settings.accountPool.import': {
    'zh-CN': '\u5bfc\u5165\u8d26\u53f7',
    en: 'Import accounts',
  },
  'settings.accountPool.importing': {
    'zh-CN': '\u5bfc\u5165\u4e2d...',
    en: 'Importing...',
  },
  'settings.accountPool.export': {
    'zh-CN': '\u5bfc\u51fa\u8d26\u53f7',
    en: 'Export accounts',
  },
  'settings.accountPool.exporting': {
    'zh-CN': '\u5bfc\u51fa\u4e2d...',
    en: 'Exporting...',
  },
  'settings.accountPool.exportSuccess': {
    'zh-CN': '\u5df2\u5bfc\u51fa {count} \u4e2a\u8d26\u53f7\u3002',
    en: 'Exported {count} account(s).',
  },
  'settings.accountPool.importSuccess': {
    'zh-CN':
      '\u5df2\u5bfc\u5165 {imported} \u4e2a\u65b0\u8d26\u53f7\uff0c\u66f4\u65b0 {updated} \u4e2a\u8d26\u53f7\uff0c\u8df3\u8fc7 {skipped} \u6761\u8bb0\u5f55\u3002',
    en: 'Imported {imported} new account(s), updated {updated}, skipped {skipped} record(s).',
  },
  'settings.accountPool.transferFailed': {
    'zh-CN': '\u64cd\u4f5c\u5931\u8d25\uff1a',
    en: 'Operation failed: ',
  },
  'settings.accountPool.startAuto': {
    'zh-CN': '开启自动任务',
    en: 'Start auto task',
  },
  'settings.accountPool.startAutoRunning': {
    'zh-CN': '自动任务进行中...',
    en: 'Auto task running...',
  },
  'settings.accountPool.checking': {
    'zh-CN': '检测中…',
    en: 'Checking...',
  },
  'settings.accountPool.healthCheck': {
    'zh-CN': '健康检测',
    en: 'Health check',
  },
  'settings.accountPool.healthTask.title': {
    'zh-CN': '\u6279\u91cf\u5065\u5eb7\u68c0\u6d4b',
    en: 'Batch health check',
  },
  'settings.accountPool.healthTask.starting': {
    'zh-CN': '\u6b63\u5728\u542f\u52a8\u5065\u5eb7\u68c0\u6d4b...',
    en: 'Starting health check...',
  },
  'settings.accountPool.healthTask.running': {
    'zh-CN': '\u68c0\u6d4b\u4e2d...',
    en: 'Running...',
  },
  'settings.accountPool.healthTask.completed': {
    'zh-CN': '\u5df2\u5b8c\u6210',
    en: 'Completed',
  },
  'settings.accountPool.healthTask.error': {
    'zh-CN': '\u5f02\u5e38',
    en: 'Error',
  },
  'settings.accountPool.healthTask.progress': {
    'zh-CN': '\u8fdb\u5ea6',
    en: 'Progress',
  },
  'settings.accountPool.healthTask.failed': {
    'zh-CN': '\u5931\u8d25',
    en: 'Failed',
  },
  'settings.accountPool.healthTask.skipped': {
    'zh-CN': '\u8df3\u8fc7',
    en: 'Skipped',
  },
  'settings.accountPool.healthTask.active': {
    'zh-CN': '\u6b63\u5728\u68c0\u6d4b\uff1a',
    en: 'Checking: ',
  },
  'settings.accountPool.healthTask.rowChecking': {
    'zh-CN': '\u68c0\u6d4b\u4e2d',
    en: 'Checking',
  },
  'settings.accountPool.healthTask.pollFailed': {
    'zh-CN': '\u83b7\u53d6\u68c0\u6d4b\u8fdb\u5ea6\u5931\u8d25\uff1a',
    en: 'Failed to poll health check progress: ',
  },
  'settings.accountPool.healthTask.startFailed': {
    'zh-CN': '\u542f\u52a8\u5065\u5eb7\u68c0\u6d4b\u5931\u8d25\uff1a',
    en: 'Failed to start health check: ',
  },
  'settings.accountPool.refreshing': {
    'zh-CN': '刷新中…',
    en: 'Refreshing...',
  },
  'settings.accountPool.refresh': {
    'zh-CN': '刷新',
    en: 'Refresh',
  },
  'settings.accountPool.refreshLog.title': {
    'zh-CN': '刷新额度接口请求日志',
    en: 'Usage refresh request log',
  },
  'settings.accountPool.refreshLog.starting': {
    'zh-CN': '请求：正在刷新该账号额度信息...',
    en: 'Request: refreshing usage for this account...',
  },
  'settings.accountPool.refreshLog.failed': {
    'zh-CN': '错误：刷新额度请求失败：{message}',
    en: 'Error: usage refresh request failed: {message}',
  },
  'settings.accountPool.cleaning': {
    'zh-CN': '\u6e05\u7406\u4e2d...',
    en: 'Cleaning...',
  },
  'settings.accountPool.cleanup': {
    'zh-CN': '\u6e05\u7406\u5e10\u53f7',
    en: 'Clean accounts',
  },
  'settings.accountPool.cleanupConfirm.title': {
    'zh-CN': '确认清理帐号？',
    en: 'Clean banned accounts?',
  },
  'settings.accountPool.cleanupConfirm.description': {
    'zh-CN': '该操作将删除所有被判定为已封禁的帐号，是否确认？',
    en: 'This will delete all accounts that have been marked as banned. Continue?',
  },
  'settings.accountPool.cleanupConfirm.confirm': {
    'zh-CN': '确认清理',
    en: 'Clean accounts',
  },
  'settings.accountPool.cleanupResult': {
    'zh-CN': '\u5df2\u6e05\u7406 {count} \u4e2a\u65e0\u6548\u5e10\u53f7\u3002',
    en: 'Cleaned {count} invalid account(s).',
  },
  'settings.accountPool.switchFailed': {
    'zh-CN': '切换失败：',
    en: 'Switch failed: ',
  },
  'settings.accountPool.switchedTo': {
    'zh-CN': '已切换到：',
    en: 'Switched to: ',
  },
  'settings.accountPool.batchTask.title': {
    'zh-CN': '批量注册任务',
    en: 'Batch registration task',
  },
  'settings.accountPool.batchTask.cancel': {
    'zh-CN': '取消',
    en: 'Cancel',
  },
  'settings.accountPool.batchTask.close': {
    'zh-CN': '关闭',
    en: 'Close',
  },
  'settings.accountPool.batchTask.progress': {
    'zh-CN': '进度',
    en: 'Progress',
  },
  'settings.accountPool.batchTask.success': {
    'zh-CN': '成功',
    en: 'Success',
  },
  'settings.accountPool.batchTask.failed': {
    'zh-CN': '失败',
    en: 'Failed',
  },
  'settings.accountPool.batchTask.statusRunning': {
    'zh-CN': '进行中…',
    en: 'Running...',
  },
  'settings.accountPool.batchTask.statusCompleted': {
    'zh-CN': '完成',
    en: 'Completed',
  },
  'settings.accountPool.batchTask.statusCancelled': {
    'zh-CN': '已取消',
    en: 'Cancelled',
  },
  'settings.accountPool.batchTask.statusError': {
    'zh-CN': '错误',
    en: 'Error',
  },
  'settings.accountPool.batchTask.copy': {
    'zh-CN': '\u590d\u5236\u65e5\u5fd7',
    en: 'Copy logs',
  },
  'settings.accountPool.batchTask.copied': {
    'zh-CN': '\u5df2\u590d\u5236',
    en: 'Copied',
  },
  'settings.accountPool.batchTask.floating': {
    'zh-CN': '正在装弹：{done}/{total}',
    en: 'Loading accounts: {done}/{total}',
  },
  'settings.accountPool.empty': {
    'zh-CN': '账号池为空，请先在《自动注册配置》中进行注册。',
    en: 'Account pool is empty. Register accounts in "Auto-register settings" first.',
  },
  'settings.accountPool.loading': {
    'zh-CN': '正在读取帐号列表....',
    en: 'Loading account list...',
  },
  'settings.accountPool.current': {
    'zh-CN': '当前',
    en: 'Current',
  },
  'settings.accountPool.switching': {
    'zh-CN': '切换中…',
    en: 'Switching...',
  },
  'settings.accountPool.switch': {
    'zh-CN': '切换',
    en: 'Switch',
  },
  'settings.accountPool.remove': {
    'zh-CN': '删除',
    en: 'Remove',
  },
  'settings.accountPool.throttledResetsAt': {
    'zh-CN': '限流重置时间：',
    en: 'Throttle resets at: ',
  },
  'settings.accountPool.lastCheckedAt': {
    'zh-CN': '上次校验：',
    en: 'Last checked: ',
  },
  'settings.accountPool.modal.description': {
    'zh-CN':
      '在后台批量注册账号，注册完成的账号会进入账号池备用，不会影响当前登录状态。',
    en: 'Registers accounts in batch in the background. Newly registered accounts go to the pool as standby and do not change your current login.',
  },
  'settings.accountPool.modal.count': {
    'zh-CN': '注册数量',
    en: 'Number of accounts',
  },
  'settings.accountPool.modal.interval': {
    'zh-CN': '每轮延时 (ms)',
    en: 'Delay per round (ms)',
  },
  'settings.accountPool.modal.starting': {
    'zh-CN': '启动中…',
    en: 'Starting...',
  },
  'settings.accountPool.modal.start': {
    'zh-CN': '开始任务',
    en: 'Start task',
  },

  // ---- account section ----
  'settings.account.title': {
    'zh-CN': '账号',
    en: 'Account',
  },
  'settings.account.register.title': {
    'zh-CN': '注册并登录',
    en: 'Register & Sign in',
  },
  'settings.account.register.description': {
    'zh-CN': '此按钮会直接走自动注册流程，注册成功后自动登录新账号。',
    en: 'This button runs the auto-registration flow and signs you in to the new account on success.',
  },
  'settings.account.register.button': {
    'zh-CN': '注册并登录',
    en: 'Register & Sign in',
  },
  'settings.account.register.running': {
    'zh-CN': '处理中…',
    en: 'Working...',
  },
  'settings.account.register.cancel': {
    'zh-CN': '取消',
    en: 'Cancel',
  },
  'settings.account.register.openAutoRegister': {
    'zh-CN': '打开自动注册配置',
    en: 'Open auto-register settings',
  },
  'settings.account.register.logsTitle': {
    'zh-CN': '流程日志',
    en: 'Flow logs',
  },
  'settings.account.register.copyLogs': {
    'zh-CN': '\u590d\u5236\u65e5\u5fd7',
    en: 'Copy logs',
  },
  'settings.account.register.copiedLogs': {
    'zh-CN': '\u5df2\u590d\u5236',
    en: 'Copied',
  },
  'settings.account.log.preparing': {
    'zh-CN': '准备配置中…',
    en: 'Preparing configuration...',
  },
  'settings.account.log.configMissing': {
    'zh-CN': '配置缺失，请先到自动注册配置页面填写邮箱池参数。',
    en: 'Configuration missing. Go to the auto-register settings page and fill in the mailbox pool parameters.',
  },
  'settings.account.log.consoleHandoff': {
    'zh-CN': '浏览器授权模式，打开系统浏览器登录…',
    en: 'Browser auth mode: opening the system browser to sign in...',
  },
  'settings.account.log.signInSuccess': {
    'zh-CN': '登录成功。',
    en: 'Signed in successfully.',
  },
  'settings.account.log.signInFailed': {
    'zh-CN': '登录失败：{error}',
    en: 'Sign-in failed: {error}',
  },
  'settings.account.log.useProvider': {
    'zh-CN': '使用 {provider} 获取安全验证 token…',
    en: 'Fetching security verification token via {provider}...',
  },
  'settings.account.log.captchaPending': {
    'zh-CN': '前端未拿到验证码，交给后端处理...',
    en: 'Frontend has no captcha yet; handing off to backend...',
  },
  'settings.account.log.captchaReady': {
    'zh-CN': '已拿到前端验证码，直接传给后端',
    en: 'Frontend captcha obtained; forwarding to backend.',
  },
  'settings.account.log.registerStart': {
    'zh-CN': '开始注册账号…',
    en: 'Starting account registration...',
  },
  'settings.account.log.autoRegisterNotReady': {
    'zh-CN': '错误：autoRegister 函数未就绪',
    en: 'Error: autoRegister function is not ready.',
  },
  'settings.account.log.registerFailed': {
    'zh-CN': '注册失败：{error}',
    en: 'Registration failed: {error}',
  },
  'settings.account.log.registerSuccess': {
    'zh-CN': '注册成功：{email}',
    en: 'Registration succeeded: {email}',
  },
  'settings.account.log.autoSignedIn': {
    'zh-CN': '已自动登录。',
    en: 'Signed in automatically.',
  },
  'settings.account.log.registerError': {
    'zh-CN': '注册异常：{message}',
    en: 'Registration error: {message}',
  },
  'settings.account.log.cancelled': {
    'zh-CN': '已取消注册。',
    en: 'Registration cancelled.',
  },
  'settings.account.authenticated.unknownUser': {
    'zh-CN': '未知用户',
    en: 'Unknown user',
  },
  'settings.account.authenticated.signedIn': {
    'zh-CN': '已登录',
    en: 'Signed in',
  },
  'settings.account.authenticated.email': {
    'zh-CN': '邮箱',
    en: 'Email',
  },
  'settings.account.authenticated.plan': {
    'zh-CN': '套餐',
    en: 'Plan',
  },
  'settings.account.authenticated.free': {
    'zh-CN': 'Free',
    en: 'Free',
  },
  'settings.account.authenticated.expires': {
    'zh-CN': '到期时间',
    en: 'Expires',
  },
  'settings.account.authenticated.machineId': {
    'zh-CN': '设备 ID',
    en: 'Machine ID',
  },
  'settings.account.authenticated.signOut': {
    'zh-CN': '退出登录',
    en: 'Sign out',
  },
  'settings.account.authenticated.openConsole': {
    'zh-CN': '打开控制台',
    en: 'Open Console',
  },
  'settings.account.usage.title': {
    'zh-CN': '使用量',
    en: 'Usage',
  },
  'settings.account.usage.unavailable': {
    'zh-CN': '使用量数据不可用（后端未连接）',
    en: 'Usage data unavailable (backend not connected)',
  },
  'settings.account.usage.loading': {
    'zh-CN': '加载使用量中…',
    en: 'Loading usage...',
  },
  'settings.account.usage.loadFailed': {
    'zh-CN': '加载使用量数据失败。',
    en: 'Failed to load usage data.',
  },
  'settings.account.usage.credits': {
    'zh-CN': '余额',
    en: 'Credits',
  },
  'settings.account.usage.remaining': {
    'zh-CN': '{amount} 剩余',
    en: '{amount} remaining',
  },
  'settings.account.usage.percentLeft': {
    'zh-CN': '{pct}% 剩余 · 重置于 {when}',
    en: '{pct}% left · resets {when}',
  },
  'settings.account.usage.reset.now': {
    'zh-CN': '现在',
    en: 'now',
  },
  'settings.account.usage.reset.hours': {
    'zh-CN': '{h} 小时后',
    en: 'in {h}h',
  },
  'settings.account.usage.reset.days': {
    'zh-CN': '{d} 天后',
    en: 'in {d}d',
  },
  'settings.account.usage.window.daily': {
    'zh-CN': '日',
    en: 'Daily',
  },
  'settings.account.usage.window.weekly': {
    'zh-CN': '周',
    en: 'Weekly',
  },
  'settings.account.usage.window.monthly': {
    'zh-CN': '月',
    en: 'Monthly',
  },
  // ---- browsing settings ----
  'settings.browsing.searchEngine.title': {
    'zh-CN': '默认搜索引擎',
    en: 'Default Search Engine',
  },
  'settings.browsing.searchEngine.cannotDeleteDefault': {
    'zh-CN': '无法删除默认引擎',
    en: 'Cannot delete default engine',
  },
  'settings.browsing.searchEngine.removeEngine': {
    'zh-CN': '删除搜索引擎',
    en: 'Remove search engine',
  },
  'settings.browsing.searchEngine.removeFailed': {
    'zh-CN': '删除搜索引擎失败',
    en: 'Failed to remove search engine',
  },
  'settings.browsing.searchEngine.add': {
    'zh-CN': '添加搜索引擎',
    en: 'Add Search Engine',
  },
  'settings.browsing.searchEngine.dialogTitle': {
    'zh-CN': '添加搜索引擎',
    en: 'Add Search Engine',
  },
  'settings.browsing.searchEngine.fieldName': {
    'zh-CN': '名称',
    en: 'Name',
  },
  'settings.browsing.searchEngine.placeholderName': {
    'zh-CN': '我的搜索引擎',
    en: 'My Search Engine',
  },
  'settings.browsing.searchEngine.fieldKeyword': {
    'zh-CN': '关键词',
    en: 'Keyword',
  },
  'settings.browsing.searchEngine.placeholderKeyword': {
    'zh-CN': 'mysearch.com',
    en: 'mysearch.com',
  },
  'settings.browsing.searchEngine.keywordHelp': {
    'zh-CN': '用于识别该搜索引擎的关键词',
    en: 'The keyword used to identify this search engine',
  },
  'settings.browsing.searchEngine.fieldUrl': {
    'zh-CN': '搜索 URL',
    en: 'Search URL',
  },
  'settings.browsing.searchEngine.placeholderUrl': {
    'zh-CN': 'https://example.com/search?q=%s',
    en: 'https://example.com/search?q=%s',
  },
  'settings.browsing.searchEngine.urlHelp': {
    'zh-CN': 'URL 中用 %s 作为搜索词插入位置',
    en: 'URL with %s where the search query should be inserted',
  },
  'settings.browsing.searchEngine.urlInvalid': {
    'zh-CN': 'URL 必须合法且含有 %s 占位符',
    en: 'URL must be valid and contain %s placeholder',
  },
  'settings.browsing.searchEngine.adding': {
    'zh-CN': '添加中…',
    en: 'Adding...',
  },
  'settings.browsing.searchEngine.cancel': {
    'zh-CN': '取消',
    en: 'Cancel',
  },
  'settings.browsing.page.optionHome': {
    'zh-CN': 'Stagewise 首页',
    en: 'Stagewise Home',
  },
  'settings.browsing.page.optionHomeDesc': {
    'zh-CN': '打开 stagewise 首页',
    en: 'Open the stagewise home page',
  },
  'settings.browsing.page.optionCustom': {
    'zh-CN': '自定义 URL',
    en: 'Custom URL',
  },
  'settings.browsing.page.optionCustomDesc': {
    'zh-CN': '打开指定 URL',
    en: 'Open a specific URL',
  },
  'settings.browsing.page.urlPlaceholder': {
    'zh-CN': 'https://example.com',
    en: 'https://example.com',
  },
  'settings.browsing.newTab.title': {
    'zh-CN': '新标签页',
    en: 'New Tab Page',
  },
  'settings.browsing.newTab.description': {
    'zh-CN': '选择新建标签时打开的页面。',
    en: 'Choose what page opens when you create a new tab.',
  },
  'settings.browsing.startup.title': {
    'zh-CN': '浏览器启动时',
    en: 'On Browser Start',
  },
  'settings.browsing.startup.description': {
    'zh-CN': '选择 stagewise 启动时打开的页面。',
    en: 'Choose what page opens when stagewise starts.',
  },
  'settings.browsing.permission.media': {
    'zh-CN': '摄像头与麦克风',
    en: 'Camera & Microphone',
  },
  'settings.browsing.permission.geolocation': {
    'zh-CN': '位置',
    en: 'Location',
  },
  'settings.browsing.permission.notifications': {
    'zh-CN': '通知',
    en: 'Notifications',
  },
  'settings.browsing.permission.fullscreen': {
    'zh-CN': '全屏',
    en: 'Fullscreen',
  },
  'settings.browsing.permission.bluetooth': {
    'zh-CN': '蓝牙',
    en: 'Bluetooth',
  },
  'settings.browsing.permission.hid': {
    'zh-CN': 'HID 设备',
    en: 'HID Devices',
  },
  'settings.browsing.permission.serial': {
    'zh-CN': '串口',
    en: 'Serial Ports',
  },
  'settings.browsing.permission.usb': {
    'zh-CN': 'USB 设备',
    en: 'USB Devices',
  },
  'settings.browsing.permission.clipboardRead': {
    'zh-CN': '剪贴板读取',
    en: 'Clipboard Read',
  },
  'settings.browsing.permission.displayCapture': {
    'zh-CN': '屏幕捕获',
    en: 'Screen Capture',
  },
  'settings.browsing.permission.midi': {
    'zh-CN': 'MIDI 设备',
    en: 'MIDI Devices',
  },
  'settings.browsing.permission.idleDetection': {
    'zh-CN': '空闲检测',
    en: 'Idle Detection',
  },
  'settings.browsing.permission.speakerSelection': {
    'zh-CN': '扬声器选择',
    en: 'Speaker Selection',
  },
  'settings.browsing.permission.storageAccess': {
    'zh-CN': '存储访问',
    en: 'Storage Access',
  },
  'settings.browsing.permission.setting.ask': {
    'zh-CN': '询问',
    en: 'Ask',
  },
  'settings.browsing.permission.setting.allow': {
    'zh-CN': '允许',
    en: 'Allow',
  },
  'settings.browsing.permission.setting.block': {
    'zh-CN': '拒绝',
    en: 'Block',
  },
  'settings.browsing.permission.setting.askDesc': {
    'zh-CN': '每次询问',
    en: 'Ask every time',
  },
  'settings.browsing.permission.setting.allowDesc': {
    'zh-CN': '始终允许',
    en: 'Always allow',
  },
  'settings.browsing.permission.setting.blockDesc': {
    'zh-CN': '始终拒绝',
    en: 'Always block',
  },
  'settings.browsing.permissionDefaults.title': {
    'zh-CN': '默认权限',
    en: 'Permission Defaults',
  },
  'settings.browsing.permissionDefaults.description': {
    'zh-CN': '设置网站请求这些权限时的默认行为。',
    en: 'Set the default behavior when websites request these permissions.',
  },
  'settings.browsing.websitePerm.title': {
    'zh-CN': '网站专属设置',
    en: 'Website-Specific Settings',
  },
  'settings.browsing.websitePerm.descEmpty': {
    'zh-CN': '含自定义权限设置的网站会出现在这里。',
    en: 'Sites with custom permission settings will appear here.',
  },
  'settings.browsing.websitePerm.empty': {
    'zh-CN': '尚无网站设置自定义权限。',
    en: 'No websites have custom permission settings yet.',
  },
  'settings.browsing.websitePerm.desc': {
    'zh-CN': '含自定义权限设置的网站，点击查看或编辑。',
    en: 'Sites with custom permission settings. Click to view or edit.',
  },
  'settings.browsing.websitePerm.countOne': {
    'zh-CN': '{n} 项自定义权限',
    en: '{n} custom permission',
  },
  'settings.browsing.websitePerm.countMany': {
    'zh-CN': '{n} 项自定义权限',
    en: '{n} custom permissions',
  },
  'settings.browsing.headerTitle': {
    'zh-CN': '常规',
    en: 'General',
  },
  'settings.browsing.section.general': {
    'zh-CN': '常规',
    en: 'General',
  },
  'settings.browsing.section.privacy': {
    'zh-CN': '隐私',
    en: 'Privacy',
  },
  'settings.browsing.section.privacyDesc': {
    'zh-CN': '管理你的隐私与数据共享偏好。',
    en: 'Manage your privacy and data sharing preferences.',
  },

  // ---- about section ----
  'settings.about.title': {
    'zh-CN': '关于',
    en: 'About',
  },
  'settings.about.update.checking': {
    'zh-CN': '正在检查更新',
    en: 'Checking for Updates',
  },
  'settings.about.update.downloading': {
    'zh-CN': '正在下载更新…',
    en: 'Downloading Update...',
  },
  'settings.about.update.upToDate': {
    'zh-CN': '已是最新版本',
    en: 'Up to date',
  },
  'settings.about.update.checkAgain': {
    'zh-CN': '再次检查',
    en: 'Check Again',
  },
  'settings.about.update.installRestart': {
    'zh-CN': '安装更新并重启',
    en: 'Install Update & Restart',
  },
  'settings.about.update.checkForUpdates': {
    'zh-CN': '检查更新',
    en: 'Check for Updates',
  },
  'settings.about.update.versionAvailable': {
    'zh-CN': '已有版本 {version} 可用',
    en: 'Version {version} available',
  },
  'settings.about.updateChannel.title': {
    'zh-CN': '更新通道',
    en: 'Update Channel',
  },
  'settings.about.updateChannel.description': {
    'zh-CN': '选择接收更新的预发布通道。',
    en: 'Choose which pre-release channel to receive updates from.',
  },
  'settings.about.updateChannel.beta': {
    'zh-CN': 'Beta',
    en: 'Beta',
  },
  'settings.about.updateChannel.betaDesc': {
    'zh-CN': '较为稳定的预发布更新',
    en: 'More stable pre-release updates',
  },
  'settings.about.updateChannel.alpha': {
    'zh-CN': 'Alpha',
    en: 'Alpha',
  },
  'settings.about.updateChannel.alphaDesc': {
    'zh-CN': '包含 alpha 与 beta 发布的最前沿更新',
    en: 'Bleeding-edge updates including alpha and beta releases',
  },
  'settings.about.licenses.ghRepo': {
    'zh-CN': 'GitHub 仓库',
    en: 'GitHub Repository',
  },
  'settings.about.licenses.noLicenseText': {
    'zh-CN': '此包没有可用的许可证文本。',
    en: 'No license text available for this package.',
  },
  'settings.about.licenses.title': {
    'zh-CN': '开源许可证',
    en: 'Open Source Licenses',
  },
  'settings.about.licenses.description': {
    'zh-CN': '本软件使用了开源包，在下方可查看它们的许可证。',
    en: 'This software incorporates open source packages. View their licenses below.',
  },
  'settings.about.licenses.loading': {
    'zh-CN': '加载中…',
    en: 'Loading...',
  },
  'settings.about.licenses.collapse': {
    'zh-CN': '收起',
    en: 'Collapse',
  },
  'settings.about.licenses.viewAll': {
    'zh-CN': '查看全部',
    en: 'View All',
  },
  'settings.about.licenses.total': {
    'zh-CN': '合计',
    en: 'Total',
  },
  'settings.about.licenses.searchPlaceholder': {
    'zh-CN': '搜索包或许可证…',
    en: 'Search packages or licenses...',
  },
  'settings.about.licenses.noMatch': {
    'zh-CN': '未找到匹配“{q}”的包',
    en: 'No packages found matching "{q}"',
  },
  'settings.about.licenses.viewRepo': {
    'zh-CN': '查看仓库',
    en: 'View repository',
  },
  'settings.about.licenses.viewLicenseText': {
    'zh-CN': '查看许可证全文',
    en: 'View license text',
  },
  'settings.about.details.bundleId': {
    'zh-CN': '包标识',
    en: 'Bundle ID',
  },
  'settings.about.details.releaseChannel': {
    'zh-CN': '发布通道',
    en: 'Release Channel',
  },
  'settings.about.details.platform': {
    'zh-CN': '平台',
    en: 'Platform',
  },
  'settings.about.details.arch': {
    'zh-CN': '架构',
    en: 'Architecture',
  },
  'settings.about.details.author': {
    'zh-CN': '作者',
    en: 'Author',
  },
  'settings.about.details.copyright': {
    'zh-CN': '版权',
    en: 'Copyright',
  },
  'settings.about.details.license': {
    'zh-CN': '许可证',
    en: 'License',
  },
  'settings.about.details.viewFullLicense': {
    'zh-CN': '查看完整许可证文本',
    en: 'View full license text',
  },
  'settings.about.details.homepage': {
    'zh-CN': '主页',
    en: 'Homepage',
  },
  'settings.about.details.otherVersions': {
    'zh-CN': '其他版本',
    en: 'Other Versions',
  },
  'settings.about.details.na': {
    'zh-CN': '无',
    en: 'N/A',
  },

  // ---- custom providers ----
  'settings.customProviders.title': {
    'zh-CN': '自定义服务商',
    en: 'Custom Providers',
  },
  'settings.customProviders.description': {
    'zh-CN': '为自托管或第三方 LLM 服务添加自定义 API 端点。',
    en: 'Add custom API endpoints for self-hosted or third-party LLM services.',
  },
  'settings.customProviders.add': {
    'zh-CN': '添加服务商',
    en: 'Add Provider',
  },
  'settings.customProviders.addCustom': {
    'zh-CN': '添加自定义服务商',
    en: 'Add Custom Provider',
  },
  'settings.customProviders.edit': {
    'zh-CN': '编辑服务商',
    en: 'Edit Provider',
  },
  'settings.customProviders.empty': {
    'zh-CN': '尚未配置自定义服务商。',
    en: 'No custom providers configured yet.',
  },
  'settings.customProviders.cancel': {
    'zh-CN': '取消',
    en: 'Cancel',
  },
  'settings.customProviders.save': {
    'zh-CN': '保存更改',
    en: 'Save Changes',
  },
  'settings.customProviders.delete': {
    'zh-CN': '删除',
    en: 'Delete',
  },
  'settings.customProviders.dialog.title.add': {
    'zh-CN': '添加自定义服务商',
    en: 'Add Custom Provider',
  },
  'settings.customProviders.dialog.title.edit': {
    'zh-CN': '编辑服务商',
    en: 'Edit Provider',
  },
  'settings.customProviders.dialog.description': {
    'zh-CN': '为 LLM 服务配置自定义 API 端点。',
    en: 'Configure a custom API endpoint for LLM services.',
  },
  'settings.customProviders.dialog.name': {
    'zh-CN': '名称',
    en: 'Name',
  },
  'settings.customProviders.dialog.namePlaceholder': {
    'zh-CN': '我的 OpenAI 端点',
    en: 'My OpenAI endpoint',
  },
  'settings.customProviders.dialog.providerType': {
    'zh-CN': '服务商类型',
    en: 'Provider Type',
  },
  'settings.customProviders.dialog.baseUrl': {
    'zh-CN': '基础 URL',
    en: 'Base URL',
  },
  'settings.customProviders.dialog.baseUrlPlaceholder': {
    'zh-CN': 'https://your-endpoint.example.com/v1',
    en: 'https://your-endpoint.example.com/v1',
  },
  'settings.customProviders.dialog.orBaseUrl': {
    'zh-CN': '（或使用基础 URL）',
    en: '(or use Base URL)',
  },
  'settings.customProviders.dialog.apiKey': {
    'zh-CN': 'API 密钥',
    en: 'API Key',
  },
  'settings.customProviders.dialog.apiKeyPlaceholder': {
    'zh-CN': '输入 API 密钥…',
    en: 'Enter API key...',
  },
  'settings.customProviders.dialog.keepKeyBlank': {
    'zh-CN': '留空则保留当前密钥',
    en: 'Leave blank to keep current key',
  },
  'settings.customProviders.dialog.keepCredsBlank': {
    'zh-CN': '留空则保留当前凭据',
    en: 'Leave blank to keep current credentials',
  },
  'settings.customProviders.dialog.modelMapping': {
    'zh-CN': '建议映射',
    en: 'Suggested mapping',
  },
  'settings.customProviders.dialog.modelMappingOptional': {
    'zh-CN': '（可选）',
    en: '(optional)',
  },
  'settings.customProviders.dialog.modelMappingTooltip': {
    'zh-CN':
      '将内置 Claude 模型映射到适合当前区域的 Bedrock 跨区域推理配置文件。关闭后可手动编辑映射。',
    en: 'Map the built-in Claude models to the matching Bedrock cross-region inference profiles for your region. Turn off to edit the mapping manually.',
  },
  'settings.customProviders.dialog.modelMappingDescription': {
    'zh-CN': '将内置模型 ID 映射为此端点期望的 ID，例如服务商使用不同命名时。',
    en: 'Map built-in model IDs to the IDs this endpoint expects, e.g. when the provider uses different naming.',
  },
  'settings.customProviders.dialog.invalidJson': {
    'zh-CN': 'JSON 无效',
    en: 'Invalid JSON',
  },
  'settings.customProviders.dialog.noUrl': {
    'zh-CN': '未设置 URL',
    en: 'No URL set',
  },
  'settings.customProviders.dialog.serviceAccountJson': {
    'zh-CN': '服务账号凭据 (JSON)',
    en: 'Service Account Credentials (JSON)',
  },
  'settings.customProviders.dialog.projectId': {
    'zh-CN': '项目 ID',
    en: 'Project ID',
  },
  'settings.customProviders.dialog.projectIdPlaceholder': {
    'zh-CN': 'my-gcp-project',
    en: 'my-gcp-project',
  },
  'settings.customProviders.dialog.location': {
    'zh-CN': '位置',
    en: 'Location',
  },
  'settings.customProviders.dialog.locationPlaceholder': {
    'zh-CN': 'us-central1',
    en: 'us-central1',
  },
  'settings.customProviders.dialog.apiVersion': {
    'zh-CN': 'API 版本',
    en: 'API Version',
  },
  'settings.customProviders.dialog.apiVersionPlaceholder': {
    'zh-CN': 'v1',
    en: 'v1',
  },
  'settings.customProviders.dialog.resourceName': {
    'zh-CN': '资源名称',
    en: 'Resource Name',
  },
  'settings.customProviders.dialog.resourceNamePlaceholder': {
    'zh-CN': 'my-azure-resource',
    en: 'my-azure-resource',
  },
  'settings.customProviders.dialog.azurePlaceholder': {
    'zh-CN': 'https://my-resource.openai.azure.com/openai',
    en: 'https://my-resource.openai.azure.com/openai',
  },
  'settings.customProviders.dialog.azureUrlLabel': {
    'zh-CN': 'Azure 端点 URL',
    en: 'Azure Endpoint URL',
  },
  'settings.customProviders.dialog.authenticationMethod': {
    'zh-CN': '认证方式',
    en: 'Authentication Method',
  },
  'settings.customProviders.dialog.awsProfile': {
    'zh-CN': 'AWS 配置文件',
    en: 'AWS Profile',
  },
  'settings.customProviders.dialog.awsProfilePlaceholder': {
    'zh-CN': '选择配置文件…',
    en: 'Select a profile...',
  },
  'settings.customProviders.dialog.accessKeyId': {
    'zh-CN': '访问密钥 ID',
    en: 'Access Key ID',
  },
  'settings.customProviders.dialog.secretAccessKey': {
    'zh-CN': '秘密访问密钥',
    en: 'Secret Access Key',
  },
  'settings.customProviders.dialog.secretKeyPlaceholder': {
    'zh-CN': '输入秘密访问密钥…',
    en: 'Enter secret access key...',
  },
  'settings.customProviders.dialog.loadingProfiles': {
    'zh-CN': '正在加载配置文件…',
    en: 'Loading profiles...',
  },
  'settings.customProviders.dialog.profileNotFound': {
    'zh-CN': '{name}（未找到）',
    en: '{name} (not found)',
  },
  'settings.customProviders.dialog.regionFromProfile': {
    'zh-CN': '来自配置文件 / AWS_REGION',
    en: 'from profile / AWS_REGION',
  },
  'settings.customProviders.dialog.fromAwsRegion': {
    'zh-CN': '（来自 AWS_REGION）',
    en: '(from AWS_REGION)',
  },
  'settings.customProviders.dialog.noProfiles': {
    'zh-CN':
      '在 ~/.aws/config 或 ~/.aws/credentials 中未找到配置文件。如有需要，可手动输入名称。',
    en: 'No profiles found in ~/.aws/config or ~/.aws/credentials. Type a name manually if needed.',
  },
  'settings.customProviders.dialog.ssoHintPrefix': {
    'zh-CN':
      'SSO 配置文件需要有效会话。如果请求因 token 过期失败，请在终端运行',
    en: 'SSO profiles require an active session. If requests fail with an expired-token error, run',
  },
  'settings.customProviders.dialog.ssoHintSuffix': {
    'zh-CN': '。',
    en: 'in your terminal.',
  },
  'settings.customProviders.dialog.defaultChainDescription': {
    'zh-CN':
      '凭据将通过标准 AWS 提供商链解析：环境变量、共享凭据文件、ECS/EC2 实例元数据和 SSO。',
    en: 'Credentials will be resolved from the standard AWS provider chain: environment variables, shared credentials file, ECS/EC2 instance metadata, and SSO.',
  },
  'settings.customProviders.dialog.region': {
    'zh-CN': '区域',
    en: 'Region',
  },
  'settings.customProviders.dialog.regionOptional': {
    'zh-CN': '（可选）',
    en: '(optional)',
  },
  'settings.customProviders.dialog.regionOverride': {
    'zh-CN': '（可选覆盖）',
    en: '(optional override)',
  },
  'settings.customProviders.dialog.resourceOverride': {
    'zh-CN': '（覆盖资源名称）',
    en: '(overrides Resource Name)',
  },
  'settings.customProviders.dialog.detectedRegion': {
    'zh-CN': '检测到的区域：',
    en: 'Detected region:',
  },
  'settings.customProviders.dialog.profilesLoadFailed': {
    'zh-CN': '加载 AWS 配置文件失败',
    en: 'Failed to load AWS profiles',
  },
  'settings.customProviders.dialog.awsSsoHint': {
    'zh-CN': 'aws sso login --profile <name>',
    en: 'aws sso login --profile <name>',
  },
  'settings.customProviders.dialog.test': {
    'zh-CN': '测试连接',
    en: 'Test connection',
  },
  'settings.customProviders.dialog.testing': {
    'zh-CN': '测试中…',
    en: 'Testing...',
  },
  'settings.customProviders.dialog.testOk': {
    'zh-CN': '连接成功',
    en: 'Connection OK',
  },
  'settings.customProviders.dialog.testFailed': {
    'zh-CN': '连接失败',
    en: 'Connection failed',
  },
  'settings.customProviders.group.generic': {
    'zh-CN': '通用',
    en: 'Generic',
  },
  'settings.customProviders.group.cloud': {
    'zh-CN': '云',
    en: 'Cloud',
  },
  'settings.customProviders.auth.accessKeys': {
    'zh-CN': '访问密钥',
    en: 'Access Keys',
  },
  'settings.customProviders.auth.namedProfile': {
    'zh-CN': '命名配置文件',
    en: 'Named Profile',
  },
  'settings.customProviders.auth.defaultChain': {
    'zh-CN': '默认凭据链',
    en: 'Default Credential Chain',
  },
  'settings.customProviders.deleteConfirm': {
    'zh-CN':
      '以下自定义模型正在使用此服务商，删除后将停止工作：\n\n{names}\n\n仍要删除吗？',
    en: 'The following custom models use this provider and will stop working:\n\n{names}\n\nDelete anyway?',
  },

  // ---- models providers ----
  'settings.models.title': {
    'zh-CN': '模型与服务商',
    en: 'Models & Providers',
  },
  'settings.models.configureProviders': {
    'zh-CN': '配置服务商',
    en: 'Configure Providers',
  },
  'settings.models.apiKeys': {
    'zh-CN': 'API 密钥',
    en: 'API Keys',
  },
  'settings.models.apiKey': {
    'zh-CN': 'API 密钥',
    en: 'API Key',
  },
  'settings.models.apiKeyPlaceholder': {
    'zh-CN': '输入 API 密钥…',
    en: 'Enter API key...',
  },
  'settings.models.validating': {
    'zh-CN': '验证中…',
    en: 'validating...',
  },
  'settings.models.customProviders': {
    'zh-CN': '自定义服务商',
    en: 'Custom Providers',
  },
  'settings.models.modelsTitle': {
    'zh-CN': '模型',
    en: 'Models',
  },
  'settings.models.addModel': {
    'zh-CN': '添加模型',
    en: 'Add Model',
  },
  'settings.models.codingPlans': {
    'zh-CN': '编程套餐',
    en: 'Coding Plans',
  },
  'settings.models.codingPlans.description': {
    'zh-CN':
      '连接你已经订阅的套餐。我们会验证密钥，然后通过该服务商直接路由内置模型。',
    en: 'Connect a subscription you already pay for. We validate your key, then route built-in models through the provider directly.',
  },
  'settings.models.plan.glm.displayName': {
    'zh-CN': 'GLM 编程套餐',
    en: 'GLM Coding Plan',
  },
  'settings.models.plan.glm.tagline': {
    'zh-CN': '通过 Z.ai 订阅使用 GLM-5.2、5.1、5V-Turbo',
    en: 'GLM-5.2, 5.1, 5V-Turbo via Z.ai subscription',
  },
  'settings.models.plan.glm.helpText': {
    'zh-CN': '在 z.ai → 管理 API 密钥 获取密钥',
    en: 'Get your key at z.ai → Manage API keys',
  },
  'settings.models.plan.glm.endpointHelpText': {
    'zh-CN': '通过 api.z.ai/api/coding/paas/v4 路由。',
    en: 'Routed through api.z.ai/api/coding/paas/v4.',
  },
  'settings.models.plan.glm.disclaimer': {
    'zh-CN':
      'stagewise 还不是 GLM 编程套餐的官方支持工具。我们正在与 Z.ai 推进合作。',
    en: 'stagewise is not yet an officially supported tool for the GLM Coding Plan. We are working with Z.ai on a partnership.',
  },
  'settings.models.plan.kimi.displayName': {
    'zh-CN': 'Kimi',
    en: 'Kimi',
  },
  'settings.models.plan.kimi.tagline': {
    'zh-CN': '通过 Moonshot 平台使用 Kimi K2 系列',
    en: 'Kimi K2-series via Moonshot platform',
  },
  'settings.models.plan.kimi.helpText': {
    'zh-CN': '在 platform.moonshot.ai → 控制台 → API 密钥 创建密钥',
    en: 'Create one at platform.moonshot.ai → Console → API keys',
  },
  'settings.models.plan.qwen.displayName': {
    'zh-CN': 'Qwen 编程套餐',
    en: 'Qwen Coding Plan',
  },
  'settings.models.plan.qwen.tagline': {
    'zh-CN': '通过阿里云 DashScope 使用 Qwen3-Coder',
    en: 'Qwen3-Coder via Alibaba DashScope',
  },
  'settings.models.plan.qwen.helpText': {
    'zh-CN': '在 dashscope.console.aliyun.com → API-KEY 创建密钥',
    en: 'Create one at dashscope.console.aliyun.com → API-KEY',
  },
  'settings.models.plan.minimax.displayName': {
    'zh-CN': 'MiniMax',
    en: 'MiniMax',
  },
  'settings.models.plan.minimax.tagline': {
    'zh-CN': '通过 platform.minimax.io 使用 MiniMax M 系列',
    en: 'MiniMax M-series via platform.minimax.io',
  },
  'settings.models.plan.minimax.helpText': {
    'zh-CN': '在 platform.minimax.io → 用户中心 → 接口密钥 创建密钥',
    en: 'Create one at platform.minimax.io → User Center → Interface key',
  },
  'settings.models.plan.mimo.displayName': {
    'zh-CN': 'Xiaomi MiMo',
    en: 'Xiaomi MiMo',
  },
  'settings.models.plan.mimo.tagline': {
    'zh-CN': '通过 platform.xiaomimimo.com 使用 MiMo V2.5 系列',
    en: 'MiMo V2.5-series via platform.xiaomimimo.com',
  },
  'settings.models.plan.mimo.helpText': {
    'zh-CN': '在 platform.xiaomimimo.com → 订阅 获取 tp- 密钥',
    en: 'Get your tp- key at platform.xiaomimimo.com → Subscription',
  },
  'settings.models.plan.mimo.endpointHelpText': {
    'zh-CN':
      'MiMo Token Plan 密钥（tp-xxxxx）会通过 https://token-plan-cn.xiaomimimo.com/v1 路由。也支持新加坡和欧洲集群（token-plan-sgp / token-plan-ams）。',
    en: 'MiMo Token Plan keys (tp-xxxxx) are routed through https://token-plan-cn.xiaomimimo.com/v1. Singapore and Europe clusters are also available (token-plan-sgp / token-plan-ams).',
  },
  'settings.models.plan.apiKeyLabel': {
    'zh-CN': '{plan} API 密钥',
    en: '{plan} API key',
  },
  'settings.models.apiKeys.description': {
    'zh-CN':
      '配置代理如何连接 LLM 服务商。可使用 stagewise 账号、官方服务商端点或自定义 URL。',
    en: 'Configure how the agent connects to LLM providers. Use your stagewise account, official provider endpoints, or custom URLs.',
  },
  'settings.models.models.description': {
    'zh-CN':
      '内置模型会作为参考显示。你也可以定义使用内置服务商或自定义端点的额外模型。',
    en: 'Built-in models are shown for reference. Define additional models that use built-in providers or custom endpoints.',
  },
  'settings.models.empty': {
    'zh-CN': '尚未配置自定义服务商。',
    en: 'No custom providers configured yet.',
  },
  'settings.models.filter.placeholder': {
    'zh-CN': '筛选模型…',
    en: 'Filter models...',
  },
  'settings.models.filter.noMatch': {
    'zh-CN': '没有匹配的模型。',
    en: 'No models match your filter.',
  },
  'settings.models.clear': {
    'zh-CN': '清空',
    en: 'Clear',
  },
  'settings.models.edit': {
    'zh-CN': '编辑',
    en: 'Edit',
  },
  'settings.models.save': {
    'zh-CN': '保存',
    en: 'Save',
  },
  'settings.models.cancel': {
    'zh-CN': '取消',
    en: 'Cancel',
  },
  'settings.models.advanced': {
    'zh-CN': '高级',
    en: 'Advanced',
  },
  'settings.models.showLess': {
    'zh-CN': '收起',
    en: 'Show less',
  },
  'settings.models.showMorePlans': {
    'zh-CN': '显示另外 {count} 个套餐',
    en: 'Show {count} more plans',
  },
  'settings.models.showMoreProviders': {
    'zh-CN': '显示另外 {count} 个服务商',
    en: 'Show {count} more providers',
  },
  'settings.models.unknown': {
    'zh-CN': '未知',
    en: 'Unknown',
  },
  'settings.models.disableModelAria': {
    'zh-CN': '禁用 {name}',
    en: 'Disable {name}',
  },
  'settings.models.enableModelAria': {
    'zh-CN': '启用 {name}',
    en: 'Enable {name}',
  },
  'settings.models.updated': {
    'zh-CN': '已更新',
    en: 'Updated',
  },
  'settings.models.connected.viaPlan': {
    'zh-CN': '已通过 {plan} 连接。',
    en: 'Connected via {plan}.',
  },
  'settings.models.connected.badge': {
    'zh-CN': '已连接',
    en: 'Connected',
  },
  'settings.models.connect': {
    'zh-CN': '连接',
    en: 'Connect',
  },
  'settings.models.connecting': {
    'zh-CN': '连接中…',
    en: 'Connecting…',
  },
  'settings.models.disconnect': {
    'zh-CN': '断开连接',
    en: 'Disconnect',
  },
  'settings.models.disconnecting': {
    'zh-CN': '断开中…',
    en: 'Disconnecting…',
  },
  'settings.models.connectFailed': {
    'zh-CN': '连接失败，请重试。',
    en: 'Connection failed. Please try again.',
  },
  'settings.models.disconnectFailed': {
    'zh-CN': '断开失败，请重试。',
    en: 'Disconnection failed. Please try again.',
  },
  'settings.models.customSwitchNotice': {
    'zh-CN': '该服务商当前设置为自定义。连接后会切换到官方端点。',
    en: 'This provider is currently set to Custom. Connecting will switch it to Official.',
  },
  'settings.models.use.stagewise': {
    'zh-CN': '使用我的 stagewise 账号',
    en: 'Use my stagewise account',
  },
  'settings.models.use.ownKey': {
    'zh-CN': '使用 {provider} 的 API 密钥',
    en: 'Use own API key with {provider} API',
  },
  'settings.models.use.custom': {
    'zh-CN': '使用自定义服务商',
    en: 'Use custom provider',
  },
  'settings.models.dialog.title.add': {
    'zh-CN': '添加模型',
    en: 'Add Model',
  },
  'settings.models.dialog.title.edit': {
    'zh-CN': '编辑模型',
    en: 'Edit Model',
  },
  'settings.models.dialog.description': {
    'zh-CN': '定义一个模型，并将其分配给某个服务商或自定义端点。',
    en: 'Define a model and assign it to a provider or custom endpoint.',
  },
  'settings.models.dialog.modelId': {
    'zh-CN': '模型 ID',
    en: 'Model ID',
  },
  'settings.models.dialog.modelIdPlaceholder': {
    'zh-CN': 'gpt-4o-mini',
    en: 'gpt-4o-mini',
  },
  'settings.models.dialog.modelIdExists': {
    'zh-CN': '该模型 ID 已存在。',
    en: 'This model ID already exists.',
  },
  'settings.models.dialog.displayName': {
    'zh-CN': '显示名称',
    en: 'Display Name',
  },
  'settings.models.dialog.displayNamePlaceholder': {
    'zh-CN': 'GPT-4o Mini',
    en: 'GPT-4o Mini',
  },
  'settings.models.dialog.description.label': {
    'zh-CN': '描述',
    en: 'Description',
  },
  'settings.models.dialog.descriptionPlaceholder': {
    'zh-CN': '一个快速且经济的模型…',
    en: 'A fast, affordable model...',
  },
  'settings.models.dialog.provider': {
    'zh-CN': '服务商',
    en: 'Provider',
  },
  'settings.models.dialog.providerPlaceholder': {
    'zh-CN': '选择服务商…',
    en: 'Select a provider...',
  },
  'settings.models.dialog.endpoint': {
    'zh-CN': '端点',
    en: 'Endpoint',
  },
  'settings.models.dialog.endpointUrl': {
    'zh-CN': '端点 URL',
    en: 'Endpoint URL',
  },
  'settings.models.dialog.contextWindow': {
    'zh-CN': '上下文窗口',
    en: 'Context Window',
  },
  'settings.models.dialog.inputModalities': {
    'zh-CN': '输入模态',
    en: 'Input Modalities',
  },
  'settings.models.dialog.outputModalities': {
    'zh-CN': '输出模态',
    en: 'Output Modalities',
  },
  'settings.models.dialog.toolCalling': {
    'zh-CN': '工具调用',
    en: 'Tool Calling',
  },
  'settings.models.dialog.thinking': {
    'zh-CN': '思考',
    en: 'Thinking',
  },
  'settings.models.dialog.capabilities': {
    'zh-CN': '能力',
    en: 'Capabilities',
  },
  'settings.models.dialog.headersJson': {
    'zh-CN': '请求头 (JSON)',
    en: 'Headers (JSON)',
  },
  'settings.models.dialog.providerOptionsJson': {
    'zh-CN': '服务商选项 (JSON)',
    en: 'Provider Options (JSON)',
  },

  // ---- worktree setup ----
  'settings.worktree.title': {
    'zh-CN': 'Worktree 配置',
    en: 'Worktrees',
  },
  'settings.worktree.description': {
    'zh-CN': '配置脚本并清理 stagewise 管理的 Git worktree。',
    en: 'Configure scripts and clean stagewise-managed Git worktrees.',
  },
  'settings.worktree.script': {
    'zh-CN': '脚本',
    en: 'Script',
  },
  'settings.worktree.reset': {
    'zh-CN': '重置',
    en: 'Reset',
  },
  'settings.worktree.cancel': {
    'zh-CN': '取消',
    en: 'Cancel',
  },
  'settings.worktree.envVars.title': {
    'zh-CN': '配置脚本环境变量',
    en: 'Setup script environment variables',
  },
  'settings.worktree.envVars.aria': {
    'zh-CN': '显示脚本环境变量',
    en: 'Show setup script environment variables',
  },
  'settings.worktree.envVars.available': {
    'zh-CN': '可用变量',
    en: 'Available variables',
  },
  'settings.worktree.envVars.posixHint': {
    'zh-CN': '在 POSIX shell 脚本中通过',
    en: 'In POSIX shell scripts, access these via',
  },
  'settings.worktree.managed.title': {
    'zh-CN': '已管理的 worktree',
    en: 'Managed worktrees',
  },
  'settings.worktree.managed.description': {
    'zh-CN': '此仓库由 stagewise 控制的 worktree 实例。',
    en: 'Stagewise-controlled worktree instances for this repository.',
  },
  'settings.worktree.managed.empty': {
    'zh-CN': '此仓库没有 stagewise 管理的 worktree。',
    en: 'No stagewise-managed worktrees for this repository.',
  },
  'settings.worktree.managed.filterPlaceholder': {
    'zh-CN': '筛选 worktree…',
    en: 'Filter worktrees...',
  },
  'settings.worktree.managed.noFilterMatch': {
    'zh-CN': '没有匹配的 worktree。',
    en: 'No worktrees match your filter.',
  },
  'settings.worktree.delete.confirm': {
    'zh-CN': '删除 worktree?',
    en: 'Delete worktree?',
  },
  'settings.worktree.save': {
    'zh-CN': '保存',
    en: 'Save',
  },
  'settings.worktree.saving': {
    'zh-CN': '保存中…',
    en: 'Saving...',
  },
  'settings.worktree.deleting': {
    'zh-CN': '删除中…',
    en: 'Deleting...',
  },
  'settings.worktree.deleteAction': {
    'zh-CN': '删除 worktree',
    en: 'Delete worktree',
  },
  'settings.worktree.scriptHelp': {
    'zh-CN':
      '当切出的分支包含此文件时，新 worktree 会运行该脚本。会执行匹配当前平台的变体。',
    en: "Runs for new worktrees when the checked-out branch contains this file. The variant for the worktree's platform is executed.",
  },
  'settings.worktree.empty': {
    'zh-CN':
      '尚无已知的 Git 仓库。先连接一次 Git 工作区，再在此处配置 worktree。',
    en: 'No known Git repositories yet. Connect a Git workspace once to configure worktree setup here.',
  },
  'settings.worktree.loading': {
    'zh-CN': '加载仓库中…',
    en: 'Loading repositories...',
  },
  'settings.worktree.subLabel.one': {
    'zh-CN': '使用了 {count} 个 worktree',
    en: '{count} worktree used',
  },
  'settings.worktree.subLabel.other': {
    'zh-CN': '使用了 {count} 个 worktree',
    en: '{count} worktrees used',
  },
  'settings.worktree.envVars.description': {
    'zh-CN': '运行 worktree 配置脚本时可使用以下路径变量。',
    en: 'These path variables are available when the worktree setup script runs.',
  },
  'settings.worktree.envVars.sourceLabel': {
    'zh-CN': '源 worktree 路径',
    en: 'Source worktree path',
  },
  'settings.worktree.envVars.targetLabel': {
    'zh-CN': '目标 worktree 路径',
    en: 'Target worktree path',
  },
  'settings.worktree.envVars.mainLabel': {
    'zh-CN': '主 worktree 路径',
    en: 'Main worktree path',
  },
  'settings.worktree.envVars.posixHintSuffix': {
    'zh-CN': '访问；在 PowerShell 中请使用',
    en: '. In PowerShell, use',
  },
  'settings.worktree.envVars.copyAria': {
    'zh-CN': '复制 {value}',
    en: 'Copy {value}',
  },
  'settings.worktree.toast.saveSuccessTitle': {
    'zh-CN': 'Worktree 配置脚本已保存',
    en: 'Worktree setup script saved',
  },
  'settings.worktree.toast.saveSuccessMsg': {
    'zh-CN': '配置脚本已更新。',
    en: 'Your setup script was updated.',
  },
  'settings.worktree.toast.saveErrorTitle': {
    'zh-CN': '保存配置脚本失败',
    en: 'Failed to save setup script',
  },
  'settings.worktree.toast.deleteSuccessTitle': {
    'zh-CN': '已删除 worktree',
    en: 'Worktree deleted',
  },
  'settings.worktree.toast.deleteSuccessMsg': {
    'zh-CN': '本地 worktree 检出已移除。',
    en: 'The local worktree checkout was removed.',
  },
  'settings.worktree.toast.deleteErrorTitle': {
    'zh-CN': '删除 worktree 失败',
    en: 'Failed to delete worktree',
  },
  'settings.worktree.delete.description': {
    'zh-CN': '此操作会移除本地 worktree 检出，但不会删除分支。',
    en: 'This removes the local worktree checkout. It does not delete the branch.',
  },
  'settings.worktree.delete.aria': {
    'zh-CN': '删除 {name}',
    en: 'Delete {name}',
  },
  'settings.worktree.delete.cannotAria': {
    'zh-CN': '无法删除 {name}',
    en: 'Cannot delete {name}',
  },
  'settings.worktree.time.never': {
    'zh-CN': '从未使用',
    en: 'Never used',
  },
  'settings.worktree.time.minutes': {
    'zh-CN': '{n} 分钟前',
    en: '{n}m ago',
  },
  'settings.worktree.time.hours': {
    'zh-CN': '{n} 小时前',
    en: '{n}h ago',
  },
  'settings.worktree.time.days': {
    'zh-CN': '{n} 天前',
    en: '{n}d ago',
  },
};
