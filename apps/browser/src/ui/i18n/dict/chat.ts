import type { Dict } from '../types';

export const chatDict: Dict = {
  'chat.input.placeholder': {
    'zh-CN': '输入 / 来规划和运行命令，输入 @ 添加上下文。{queued}',
    en: 'Use / to plan and run commands. Use @ for context. {queued}',
  },
  'chat.input.queuedHint': {
    'zh-CN': '按 ↵ 立即发送',
    en: 'Press ↵ to send now',
  },
  'chat.input.selectContext': {
    'zh-CN': '选择上下文元素',
    en: 'Select context elements',
  },
  'chat.input.stopSelecting': {
    'zh-CN': '停止选择元素',
    en: 'Stop selecting elements',
  },
  'chat.input.addReference': {
    'zh-CN': '添加引用元素',
    en: 'Add reference elements',
  },
  'chat.input.attachFile': {
    'zh-CN': '附加文件',
    en: 'Attach file',
  },
  'chat.input.stopAgent': {
    'zh-CN': '停止代理',
    en: 'Stop agent',
  },
  'chat.input.sendMessage': {
    'zh-CN': '发送消息',
    en: 'Send message',
  },
  'chat.goalMode.toggle': {
    'zh-CN': '切换目标模式',
    en: 'Toggle goal mode',
  },
  'chat.goalMode.enabledTooltip': {
    'zh-CN': '目标模式已开启：发送后会创建可跟踪目标',
    en: 'Goal mode is on: sending creates a tracked goal',
  },
  'chat.goalMode.disabledTooltip': {
    'zh-CN': '开启目标模式',
    en: 'Turn on goal mode',
  },
  'chat.goalStatus.title': {
    'zh-CN': '目标模式',
    en: 'Goal mode',
  },
  'chat.goalStatus.active': {
    'zh-CN': '执行中',
    en: 'Active',
  },
  'chat.goalStatus.paused': {
    'zh-CN': '已暂停',
    en: 'Paused',
  },
  'chat.goalStatus.complete': {
    'zh-CN': '已完成',
    en: 'Complete',
  },
  'chat.goalStatus.blocked': {
    'zh-CN': '已阻塞',
    en: 'Blocked',
  },
  'chat.goalStatus.pause': {
    'zh-CN': '暂停目标',
    en: 'Pause goal',
  },
  'chat.goalStatus.resume': {
    'zh-CN': '继续目标',
    en: 'Resume goal',
  },
  'chat.goalStatus.edit': {
    'zh-CN': '编辑目标',
    en: 'Edit goal',
  },
  'chat.goalStatus.delete': {
    'zh-CN': '删除目标',
    en: 'Delete goal',
  },
  'chat.goalStatus.save': {
    'zh-CN': '保存目标',
    en: 'Save goal',
  },
  'chat.goalStatus.cancel': {
    'zh-CN': '取消编辑',
    en: 'Cancel edit',
  },
  'chat.llmNetwork.readingNodes': {
    'zh-CN': '正在读取 Clash 可用节点…',
    en: 'Reading Clash node candidates...',
  },
  'chat.llmNetwork.switchingNode': {
    'zh-CN': '正在切换可用节点 {attempt}：{node}（{group}）…',
    en: 'Switching node {attempt}: {node} ({group})...',
  },
  'chat.llmNetwork.retryingRequest': {
    'zh-CN': '节点已切换，正在重试对话请求 {attempt}：{node}…',
    en: 'Node switched. Retrying chat request {attempt}: {node}...',
  },
  'chat.runtimePhase.compressingContext': {
    'zh-CN': '正在压缩上下文…',
    en: 'Compressing context...',
  },
  'chat.runtimePhase.preparingContext': {
    'zh-CN': '正在准备上下文…',
    en: 'Preparing context...',
  },
  'chat.runtimePhase.preparingTools': {
    'zh-CN': '正在准备工具…',
    en: 'Preparing tools...',
  },
  'chat.runtimePhase.waitingForModel': {
    'zh-CN': '正在等待模型响应…',
    en: 'Waiting for model response...',
  },
  'chat.slash.group.skills': {
    'zh-CN': '技能',
    en: 'Skills',
  },
  'chat.slash.group.plugins': {
    'zh-CN': '插件',
    en: 'Plugins',
  },
  'chat.slash.empty.noCommands': {
    'zh-CN': '没有命令',
    en: 'No commands',
  },
  'chat.slash.description.plan': {
    'zh-CN': '编码前创建结构化实施计划',
    en: 'Create a structured implementation plan before coding',
  },
  'chat.slash.description.debug': {
    'zh-CN': '通过本地日志文件使用日志调用进行深入调试',
    en: 'Use logging calls for in-depth debugging via local log files',
  },
  'chat.slash.description.preview': {
    'zh-CN': '在浏览器标签页中创建交互式设计预览',
    en: 'Create an interactive design-preview in a browser tab',
  },
  'chat.slash.description.learn': {
    'zh-CN':
      '创建、提取或更新技能。适用于从零编写技能、从当前会话提取知识，或在用户意图与技能指导冲突、内容混乱/过时时更新现有技能。',
    en:
      'Create, extract, or update a skill. Use when authoring a new skill from scratch, extracting knowledge from the current session, or updating an existing skill when the user\'s intentions contradicted skill guidance or content is confusing/outdated.',
  },
  'chat.slash.description.plugin.figma': {
    'zh-CN':
      'Figma 插件完整指南，包括 REST API 访问、通过 CDP 实时监控选择内容，以及 figma-app 交互式 UI。用户要求处理 Figma 时应立即阅读。',
    en:
      'Complete guide for the Figma plugin — REST API access, real-time selection monitoring via CDP, and the figma-app interactive UI. Read this IMMEDIATELY when the user asks to work with Figma.',
  },
  'chat.slash.description.plugin.github': {
    'zh-CN':
      'GitHub 插件完整指南，包括使用 GitHub Personal Access Token 通过 REST API 访问仓库、议题、拉取请求、Actions、发布和搜索。',
    en:
      'Complete guide for the GitHub plugin — REST API access for repositories, issues, pull requests, actions, releases, and search using a GitHub Personal Access Token.',
  },
  'chat.slash.description.plugin.javascriptSandbox': {
    'zh-CN':
      '使用 PickStar Studio 内置 JavaScript 沙箱的最佳实践。说明如何访问浏览器调试/交互 API，使用外部依赖、文件系统访问、运行 mini-app 等。',
    en:
      'Best practices for using the PickStar Studio built-in JavaScript sandbox. Explains how to access APIs for browser debugging/interaction, use external dependencies, file system access, running mini-apps, etc.',
  },
  'chat.slash.description.plugin.miniApps': {
    'zh-CN':
      '构建在浏览器标签页中展示的自定义交互式 Web 应用（mini apps）指南，包括脚手架、iframe 约束、与沙箱的双向消息通信和迭代流程。',
    en:
      'Guide for building custom interactive web apps ("mini apps") displayed in browser tabs — scaffolding, iframe constraints, bidirectional messaging with the sandbox, and iteration workflows.',
  },
  'chat.slash.description.plugin.posthog': {
    'zh-CN':
      'PostHog 插件完整指南，包括使用 HogQL 查询分析、管理功能开关、检查事件和用户、读取洞察、实验、群组、问卷等。',
    en:
      'Complete guide for the PostHog plugin — REST API access for querying analytics with HogQL, managing feature flags, inspecting events and persons, reading insights, experiments, cohorts, surveys, and more.',
  },
  'chat.slash.description.plugin.remotion': {
    'zh-CN':
      '使用 Remotion 创建或编辑视频。PickStar Studio 与 Remotion 第一方技能，包含完整视频制作流程。',
    en:
      'Create or edit video with Remotion. First-party PickStar Studio + Remotion skill. Contains full video-making process.',
  },
  'chat.slash.description.plugin.supabase': {
    'zh-CN':
      'Supabase 插件完整指南，包括通过 Management API 运行 SQL 查询、列出项目、管理 Edge Functions、密钥、迁移并检查项目健康状况。',
    en:
      'Complete guide for the Supabase plugin — Management API access for running SQL queries, listing projects, managing edge functions, secrets, migrations, and inspecting project health.',
  },
  'chat.slash.description.plugin.vercel': {
    'zh-CN':
      'Vercel 插件完整指南，包括使用 Vercel Personal Access Token 通过 REST API 访问部署、日志、项目和环境变量。',
    en:
      'Complete guide for the Vercel plugin — REST API access for deployments, logs, projects, and environment variables using a Vercel Personal Access Token.',
  },
  'commandCenter.mode.all': {
    'zh-CN': '全部',
    en: 'All',
  },
  'commandCenter.mode.agents': {
    'zh-CN': '智能体',
    en: 'Agents',
  },
  'commandCenter.mode.browser': {
    'zh-CN': '浏览器',
    en: 'Browser',
  },
  'commandCenter.mode.files': {
    'zh-CN': '文件',
    en: 'Files',
  },
  'commandCenter.mode.settings': {
    'zh-CN': '设置',
    en: 'Settings',
  },
  'commandCenter.mode.switchAria': {
    'zh-CN': '切换到 {mode} 模式',
    en: 'Switch to {mode} mode',
  },
  'commandCenter.search.placeholder.default': {
    'zh-CN': '搜索智能体、标签页、设置…',
    en: 'Search agents, tabs, settings…',
  },
  'commandCenter.search.placeholder.files': {
    'zh-CN': '搜索文件…',
    en: 'Search files…',
  },
  'commandCenter.group.agents': {
    'zh-CN': '智能体',
    en: 'Agents',
  },
  'commandCenter.group.browser': {
    'zh-CN': '浏览器',
    en: 'Browser',
  },
  'commandCenter.group.files': {
    'zh-CN': '文件',
    en: 'Files',
  },
  'commandCenter.group.settings': {
    'zh-CN': '设置',
    en: 'Settings',
  },
  'commandCenter.group.actions': {
    'zh-CN': '操作',
    en: 'Actions',
  },
  'commandCenter.group.lastChanged': {
    'zh-CN': '最近更改',
    en: 'Last changed',
  },
  'commandCenter.group.today': {
    'zh-CN': '今天',
    en: 'Today',
  },
  'commandCenter.group.yesterday': {
    'zh-CN': '昨天',
    en: 'Yesterday',
  },
  'commandCenter.group.last7Days': {
    'zh-CN': '最近 7 天',
    en: 'Last 7 days',
  },
  'commandCenter.group.last30Days': {
    'zh-CN': '最近 30 天',
    en: 'Last 30 days',
  },
  'commandCenter.group.older': {
    'zh-CN': '更早',
    en: 'Older',
  },
  'commandCenter.fileFilter.showResultsFor': {
    'zh-CN': '显示结果范围',
    en: 'Show results for',
  },
  'commandCenter.fileFilter.showingResultsFor': {
    'zh-CN': '正在显示 {workspace} 的结果',
    en: 'Showing results for {workspace}',
  },
  'commandCenter.empty.loading': {
    'zh-CN': '加载中…',
    en: 'Loading…',
  },
  'commandCenter.empty.noResults': {
    'zh-CN': '无结果',
    en: 'No results',
  },
  'commandCenter.agent.thinking': {
    'zh-CN': '思考中…',
    en: 'Thinking…',
  },
  'commandCenter.agent.waitingForResponse': {
    'zh-CN': '等待回复…',
    en: 'Waiting for response...',
  },
  'commandCenter.agent.working': {
    'zh-CN': '工作中…',
    en: 'Working…',
  },
  'commandCenter.agent.untitled': {
    'zh-CN': '未命名智能体',
    en: 'Untitled Agent',
  },
  'commandCenter.agent.messages': {
    'zh-CN': '{count} 条消息',
    en: '{count} messages',
  },
  'commandCenter.tab.untitled': {
    'zh-CN': '未命名标签页',
    en: 'Untitled Tab',
  },
  'commandCenter.tab.iconAlt': {
    'zh-CN': '{title} 图标',
    en: '{title} icon',
  },
  'commandCenter.tab.genericIconAlt': {
    'zh-CN': '标签页图标',
    en: 'Tab icon',
  },
  'commandCenter.footer.deleteConfirm': {
    'zh-CN': '删除“{title}”？',
    en: 'Delete “{title}”?',
  },
  'commandCenter.footer.copyUrl': {
    'zh-CN': '复制 URL',
    en: 'Copy URL',
  },
  'commandCenter.footer.searchFilenamesOnly': {
    'zh-CN': '只搜索文件名',
    en: 'Search filenames only',
  },
  'commandCenter.footer.searchInContent': {
    'zh-CN': '搜索内容',
    en: 'Search in content',
  },
  'commandCenter.footer.includeGitignored': {
    'zh-CN': '包含 gitignore 文件',
    en: 'Include gitignored',
  },
  'commandCenter.footer.excludeGitignored': {
    'zh-CN': '排除 gitignore 文件',
    en: 'Exclude gitignored',
  },
  'commandCenter.setting.modelsProviders.title': {
    'zh-CN': '模型与提供商',
    en: 'Models & Providers',
  },
  'commandCenter.setting.modelsProviders.subtitle': {
    'zh-CN': '配置模型提供商和 Coding 套餐',
    en: 'Configure model providers and coding plans',
  },
  'commandCenter.setting.apiKeys.title': {
    'zh-CN': '设置 API 密钥',
    en: 'Set API Keys',
  },
  'commandCenter.setting.apiKeys.subtitle': {
    'zh-CN': '连接 Anthropic、OpenAI、Google 等提供商',
    en: 'Connect Anthropic, OpenAI, Google, and other providers',
  },
  'commandCenter.setting.customProviders.title': {
    'zh-CN': '自定义提供商',
    en: 'Custom Providers',
  },
  'commandCenter.setting.customProviders.subtitle': {
    'zh-CN': '管理自定义模型端点',
    en: 'Manage custom model endpoints',
  },
  'commandCenter.setting.agentGeneral.title': {
    'zh-CN': '通用代理设置',
    en: 'General Agent Settings',
  },
  'commandCenter.setting.agentGeneral.subtitle': {
    'zh-CN': '配置默认代理行为',
    en: 'Configure default agent behavior',
  },
  'commandCenter.setting.skillsContext.title': {
    'zh-CN': '技能与上下文文件',
    en: 'Skills & Context files',
  },
  'commandCenter.setting.skillsContext.subtitle': {
    'zh-CN': '管理技能与上下文文件偏好',
    en: 'Manage skill and context file preferences',
  },
  'commandCenter.setting.worktrees.title': {
    'zh-CN': 'Worktree 配置',
    en: 'Worktrees',
  },
  'commandCenter.setting.worktrees.subtitle': {
    'zh-CN': '管理 worktree 配置脚本',
    en: 'Manage worktree setup scripts',
  },
  'commandCenter.setting.plugins.title': {
    'zh-CN': '插件',
    en: 'Plugins',
  },
  'commandCenter.setting.plugins.subtitle': {
    'zh-CN': '配置内置及已启用插件',
    en: 'Configure bundled and enabled plugins',
  },
  'commandCenter.setting.personalization.title': {
    'zh-CN': '个性化',
    en: 'Personalization',
  },
  'commandCenter.setting.personalization.subtitle': {
    'zh-CN': '配置 UI 尺寸、主题色、通知与 Dock 行为',
    en: 'Configure UI size, theme colors, notifications, and dock behavior',
  },
  'commandCenter.setting.browsing.title': {
    'zh-CN': '浏览设置',
    en: 'Browsing Settings',
  },
  'commandCenter.setting.browsing.subtitle': {
    'zh-CN': '配置浏览器行为与权限',
    en: 'Configure browser behavior and permissions',
  },
  'commandCenter.setting.history.title': {
    'zh-CN': '历史记录',
    en: 'History',
  },
  'commandCenter.setting.history.subtitle': {
    'zh-CN': '打开浏览历史',
    en: 'Open browsing history',
  },
  'chat.modelSelect.search': {
    'zh-CN': '搜索…',
    en: 'Search…',
  },
  'chat.modelSelect.noResults': {
    'zh-CN': '无结果',
    en: 'No results',
  },
  'chat.modelSelect.openSettings': {
    'zh-CN': '模型设置',
    en: 'Model settings',
  },
  'chat.modelSelect.editThinking': {
    'zh-CN': '编辑',
    en: 'Edit',
  },
  'chat.modelSelect.group.recommended': {
    'zh-CN': '推荐',
    en: 'Recommended',
  },
  'chat.modelSelect.group.custom': {
    'zh-CN': '自定义',
    en: 'Custom',
  },
  'chat.toolApproval.alwaysAsk.label': {
    'zh-CN': '总是询问',
    en: 'Always ask',
  },
  'chat.toolApproval.alwaysAsk.title': {
    'zh-CN': '运行 shell 命令前先询问',
    en: 'Ask before shell commands',
  },
  'chat.toolApproval.alwaysAsk.description': {
    'zh-CN': '此代理在运行任何 shell 命令前都会暂停并请求你的批准。',
    en: 'This agent will pause and ask for your approval before running any shell command.',
  },
  'chat.toolApproval.smart.label': {
    'zh-CN': '智能审批',
    en: 'Smart approval',
  },
  'chat.toolApproval.smart.title': {
    'zh-CN': '只对有风险的命令询问',
    en: 'Only ask for risky commands',
  },
  'chat.toolApproval.smart.description': {
    'zh-CN': '由快速分类器逐个判断命令。只读、限定在工作区内的命令自动运行；具有破坏性或系统级的命令仍需审批。',
    en: 'A fast classifier decides per command. Read-only and workspace-scoped commands run automatically; destructive or system-level commands still ask for approval.',
  },
  'chat.toolApproval.alwaysAllow.label': {
    'zh-CN': '总是允许',
    en: 'Always allow',
  },
  'chat.toolApproval.alwaysAllow.title': {
    'zh-CN': '跳过后续审批',
    en: 'Skip future approvals',
  },
  'chat.toolApproval.alwaysAllow.description': {
    'zh-CN': '此代理将不再询问、直接运行所有 shell 命令。只有当你信任此代理即将执行的操作时再启用。',
    en: 'This agent will run every shell command without asking. Only enable this if you trust what this agent is about to do.',
  },
  'chat.workspace.disconnect': {
    'zh-CN': '断开工作区',
    en: 'Disconnect workspace',
  },
  'chat.workspace.openInFileView': {
    'zh-CN': '在文件视图中打开',
    en: 'Open in file view',
  },
  'chat.workspace.contextFiles': {
    'zh-CN': '上下文文件',
    en: 'Context files',
  },
  'chat.workspace.openTerminal': {
    'zh-CN': '打开终端',
    en: 'Open terminal',
  },
  'chat.workspace.copyPath': {
    'zh-CN': '复制路径',
    en: 'Copy path',
  },
  'chat.workspace.createWorktree': {
    'zh-CN': '创建 worktree',
    en: 'Create worktree',
  },
  'chat.workspace.useExistingWorktree': {
    'zh-CN': '使用已有 worktree',
    en: 'Use existing worktree',
  },
  'chat.workspace.createBranch': {
    'zh-CN': '创建分支',
    en: 'Create branch',
  },
  'chat.workspace.useExistingBranch': {
    'zh-CN': '使用已有分支',
    en: 'Use existing branch',
  },
  'chat.workspace.summary.createWorktree': {
    'zh-CN': '创建 worktree',
    en: 'create worktree',
  },
  'chat.workspace.summary.createBranch': {
    'zh-CN': '创建分支',
    en: 'create branch',
  },
  'chat.workspace.summary.useExistingBranch': {
    'zh-CN': '使用已有分支',
    en: 'use existing branch',
  },
  'chat.workspace.summary.useExistingWorktree': {
    'zh-CN': '使用已有 worktree',
    en: 'use existing worktree',
  },
  'chat.workspace.summary.from': {
    'zh-CN': '基于',
    en: 'from',
  },
  'chat.workspace.search': {
    'zh-CN': '搜索…',
    en: 'Search…',
  },
  'chat.workspace.actionCreateWorktree': {
    'zh-CN': '创建新 worktree',
    en: 'Create new worktree',
  },
  'chat.workspace.actionUseWorktree': {
    'zh-CN': '使用 worktree',
    en: 'Use worktree',
  },
  'chat.workspace.actionCreateBranch': {
    'zh-CN': '创建新分支',
    en: 'Create new branch',
  },
  'chat.workspace.actionUseBranch': {
    'zh-CN': '使用分支',
    en: 'Use branch',
  },
  'chat.workspace.connect': {
    'zh-CN': '连接工作区',
    en: 'Connect workspace',
  },
  'chat.workspace.connectNew': {
    'zh-CN': '连接新工作区',
    en: 'Connect new workspace',
  },
  'chat.workspace.includedInContext': {
    'zh-CN': '已包含在代理上下文中',
    en: 'Included in agent context',
  },
  'chat.workspace.notIncludedInContext': {
    'zh-CN': '未包含在代理上下文中',
    en: 'Not included in agent context',
  },
  'chat.workspace.setupRunning': {
    'zh-CN': 'Worktree 配置运行中',
    en: 'Worktree setup running',
  },
  'chat.workspace.setupFailed': {
    'zh-CN': 'Worktree 配置失败',
    en: 'Worktree setup failed',
  },
  'chat.workspace.setupDone': {
    'zh-CN': 'Worktree 配置完成',
    en: 'Worktree setup done',
  },
  'chat.workspace.error.worktreeNameRequired': {
    'zh-CN': '必须填写 worktree 名称。',
    en: 'Worktree name is required.',
  },
  'chat.workspace.error.branchNameRequired': {
    'zh-CN': '必须填写分支名称。',
    en: 'Branch name is required.',
  },
  'chat.workspace.error.branchUnavailable': {
    'zh-CN': '分支不可用。',
    en: 'Branch is unavailable.',
  },
  'chat.workspace.error.branchInUse': {
    'zh-CN': '分支已在另一个 worktree 中检出。',
    en: 'Branch is checked out in another worktree.',
  },
  'chat.workspace.error.worktreeUnavailable': {
    'zh-CN': 'Worktree 不可用。',
    en: 'Worktree is unavailable.',
  },
  'chat.workspace.giveAccessTooltip': {
    'zh-CN': '让代理访问你的文件。',
    en: 'Give the agent access to your files.',
  },
  'chat.workspace.error.noActiveAgent': {
    'zh-CN': '没有激活的代理。',
    en: 'No active agent.',
  },
  'chat.workspace.error.alreadyConnected': {
    'zh-CN': '工作区已连接。',
    en: 'Workspace is already connected.',
  },
  'chat.workspace.error.noWorkspaceAction': {
    'zh-CN': '未选择工作区操作。',
    en: 'No workspace action selected.',
  },
  'chat.workspace.error.connectFailed': {
    'zh-CN': '连接工作区失败。',
    en: 'Failed to connect workspace.',
  },
  'chat.search.placeholder': {
    'zh-CN': '在标签页中搜索…',
    en: 'Search in tab...',
  },
  'chat.search.previousMatch': {
    'zh-CN': '上一个匹配',
    en: 'Previous match',
  },
  'chat.search.nextMatch': {
    'zh-CN': '下一个匹配',
    en: 'Next match',
  },
  'chat.search.previousAria': {
    'zh-CN': '上一个搜索结果',
    en: 'Previous search result',
  },
  'chat.search.nextAria': {
    'zh-CN': '下一个搜索结果',
    en: 'Next search result',
  },
  'chat.search.closeAria': {
    'zh-CN': '关闭搜索',
    en: 'Close search',
  },
  'chat.attachments.elementScreenshot': { 'zh-CN': '元素截图', en: 'Element screenshot' },
  'chat.attachments.nodeType': { 'zh-CN': '节点类型', en: 'Node type' },
  'chat.attachments.size': { 'zh-CN': '尺寸', en: 'Size' },
  'chat.attachments.text': { 'zh-CN': '文本', en: 'Text' },
  'chat.attachments.xpath': { 'zh-CN': 'XPath', en: 'XPath' },
  'chat.attachments.page': { 'zh-CN': '页面', en: 'Page' },
  'chat.attachments.frameTitle': { 'zh-CN': '框架标题', en: 'Frame Title' },
  'chat.attachments.pastedText': { 'zh-CN': '粘贴的文本', en: 'Pasted text' },
  'chat.attachments.useRawText': { 'zh-CN': '使用原文本', en: 'Use raw text' },
  'chat.attachments.copyToClipboard': { 'zh-CN': '复制到剪贴板', en: 'Copy to clipboard' },
  'chat.attachments.skills': { 'zh-CN': '技能', en: 'Skills' },
  'chat.attachments.record': { 'zh-CN': '记录', en: 'Record' },
  'chat.queue.removeFromQueue': { 'zh-CN': '从队列中移除', en: 'Remove from queue' },
  'chat.userQuestion.otherPlease': { 'zh-CN': '其他（请填写）...', en: 'Other (please enter)...' },
  'chat.userQuestion.aliasLimit.title': {
    'zh-CN': '别名限制错误详情',
    en: 'Alias Limit Error Details',
  },
  'chat.userQuestion.aliasLimit.description': {
    'zh-CN':
      '父邮箱达到别名创建上限时，日志中会出现哪条确切错误信息？（例如 `user_register_http_400: ...`、`create_account_http_400: ...`，或其他内容）',
    en:
      'What exact error message appears in the logs when the parent email has reached its alias creation limit? ' +
      '(e.g. `user_register_http_400: ...` or `create_account_http_400: ...` or something else)',
  },
  'chat.userQuestion.aliasLimit.errorMessageLabel': {
    'zh-CN': '错误消息文本',
    en: 'Error message text',
  },
  'chat.userQuestion.aliasLimit.errorMessagePlaceholder': {
    'zh-CN': '粘贴日志中的确切错误字符串',
    en: 'Paste the exact error string from logs',
  },
  'chat.runtimeError.notLoggedIn': { 'zh-CN': '未登录', en: 'Not logged in' },
  'chat.runtimeError.error': { 'zh-CN': '错误', en: 'Error' },
  'chat.runtimeError.whatToDo': { 'zh-CN': '如果问题持续怎么办？', en: 'What to do if the issue persists?' },
  'chat.runtimeError.retry': { 'zh-CN': '重试', en: 'Retry' },
  'chat.runtimeError.shortly': { 'zh-CN': '很快', en: 'shortly' },
  'chat.runtimeError.inMinutes': { 'zh-CN': '{count} 分钟后', en: 'in {count} minute{plural}' },
  'chat.runtimeError.inHours': { 'zh-CN': '{count} 小时后', en: 'in {count} hour{plural}' },
  'chat.runtimeError.inDays': { 'zh-CN': '{count} 天后', en: 'in {count} day{plural}' },
  'chat.runtimeError.usageLimitReached': { 'zh-CN': '已达到使用上限', en: 'Usage limit reached' },
  'chat.runtimeError.limitResetSuffix': { 'zh-CN': '你的额度将在 {time} 重置。', en: ' Your limit resets {time}.' },
  'chat.runtimeError.limitUltra': { 'zh-CN': '你已用完包含的额度。{suffix}', en: 'You\'ve used all your included credits.{suffix}' },
  'chat.runtimeError.limitPro': { 'zh-CN': '你已达到 Pro 套餐上限。{suffix}', en: 'You\'ve reached your Pro plan limit.{suffix}' },
  'chat.runtimeError.limitFree': { 'zh-CN': '你已达到免费套餐上限。{suffix}', en: 'You\'ve reached your free plan limit.{suffix}' },
  'chat.runtimeError.modelRestrictedWithModel': { 'zh-CN': '{model} 在 {plan} 套餐中不可用', en: '{model} is not available on the {plan} plan' },
  'chat.runtimeError.modelRestricted': { 'zh-CN': '该模型在 {plan} 套餐中不可用', en: 'Model not available on the {plan} plan' },
  'chat.runtimeError.modelRestrictedDescription': { 'zh-CN': '该模型只能通过自带 API 密钥或 Pro 套餐使用。请升级套餐或配置你自己的 API 密钥。', en: 'This model is only accessible via BYOK or a Pro plan. Get your plan or configure your own API key.' },
  'chat.runtimeError.configureOtherApiKeys': { 'zh-CN': '配置其他 API 密钥', en: 'Configure other API keys' },
  'chat.runtimeError.upgradePlan': { 'zh-CN': '升级套餐', en: 'Upgrade plan' },
  'chat.runtimeError.upstreamOverloadDescription': { 'zh-CN': '上游 AI 服务商暂时繁忙。请切换到其他模型或稍后重试。', en: 'The upstream AI provider is temporarily at capacity. Please switch to another model or try again.' },
  'chat.runtimeError.modelUnavailableWithName': { 'zh-CN': '{model} 暂时不可用', en: '{model} is temporarily unavailable' },
  'chat.runtimeError.modelUnavailable': { 'zh-CN': '模型暂时不可用', en: 'Model is temporarily unavailable' },
  'chat.runtimeError.waitingForConnection': { 'zh-CN': '正在等待连接…', en: 'Waiting for connection...' },
  'chat.runtimeError.offlineDescription': { 'zh-CN': '你的设备似乎处于离线状态。网络恢复后代理会自动重试。', en: 'Your device appears to be offline. The agent will retry automatically once internet access is available again.' },
  'chat.runtimeError.lastNetworkError': { 'zh-CN': '最近的网络错误：{error}', en: 'Last network error: {error}' },
  'chat.runtimeError.notLoggedInDescription': { 'zh-CN': '你尚未登录 PickStar Studio，也没有配置其他 AI 模型访问方式。', en: 'You aren\'t signed in to PickStar Studio, and you haven\'t configured any other method for AI model access.' },
  'chat.runtimeError.logInToStagewise': { 'zh-CN': '登录 PickStar Studio', en: 'Log in to PickStar Studio' },
  'chat.runtimeError.reportPrefix': { 'zh-CN': '如果这个错误持续出现，你可以', en: 'If this error continues to occur, you can ' },
  'chat.runtimeError.reportLink': { 'zh-CN': '在 GitHub 上报告', en: 'report it on GitHub' },
  'chat.runtimeError.reportSuffix': { 'zh-CN': '。请附上错误消息和堆栈跟踪（如果有），帮助我们诊断问题。', en: '. Please include the error message and stack trace (if available) to help us diagnose the issue.' },
  'chat.message.editYourMessage': { 'zh-CN': '编辑您的消息...', en: 'Edit your message...' },
  'chat.history.agentMessageDisplay': { 'zh-CN': '智能体消息展示', en: 'Agent message display' },
  'chat.workspace.stopContextGen': { 'zh-CN': '停止生成上下文', en: 'Stop the context generation' },
  'chat.dropZone.label': { 'zh-CN': '聊天面板拖放区', en: 'Chat panel drop zone' },
  'chat.notif.dismiss': { 'zh-CN': '关闭通知', en: 'Dismiss notification' },
  'chat.usage.dismiss': { 'zh-CN': '忽略额度警告', en: 'Dismiss usage warning' },
  'chat.usage.warning': {
    'zh-CN': '你已使用 {pct}% 的{window}额度。建议切换到更便宜的模型。',
    en: 'You\'ve used {pct}% of your {window} limit. Consider switching to a cheaper model.',
  },
  'chat.usage.window.daily': { 'zh-CN': '每日', en: 'daily' },
  'chat.usage.window.weekly': { 'zh-CN': '每周', en: 'weekly' },
  'chat.usage.window.monthly': { 'zh-CN': '每月', en: 'monthly' },
  'chat.usageSummary.total': { 'zh-CN': '总计', en: 'Total' },
  'chat.usageSummary.input': { 'zh-CN': '输入', en: 'input' },
  'chat.usageSummary.output': { 'zh-CN': '输出', en: 'output' },
  'chat.usageSummary.cacheHit': { 'zh-CN': '缓存命中', en: 'cache hit' },
  'chat.usageSummary.cacheHitRate': {
    'zh-CN': '缓存命中率',
    en: 'cache hit rate',
  },
  'chat.usageSummary.context': { 'zh-CN': '上下文', en: 'context' },
  'chat.usageSummary.preflightLimit': {
    'zh-CN': '预检阈值',
    en: 'preflight threshold',
  },
  'chat.usageSummary.calls': { 'zh-CN': '调用', en: 'calls' },
  'chat.usageSummary.times': { 'zh-CN': '次', en: 'times' },
  'chat.usageSummary.elapsed': { 'zh-CN': '耗时', en: 'elapsed' },
  'chat.mentions.tabPreview': { 'zh-CN': '标签预览', en: 'Tab preview' },
  'chat.mentions.openOriginalUrl': { 'zh-CN': '在新标签中打开原始 URL', en: 'Open original URL in new tab' },
  'chat.agentList.deleteWorktree': { 'zh-CN': '删除工作树', en: 'Delete worktree' },
  'chat.agentList.changeGroupingMode': { 'zh-CN': '更改智能体分组模式', en: 'Change agent grouping mode' },
  'chat.agentList.searchAgents': { 'zh-CN': '搜索智能体', en: 'Search agents' },
  'chat.agentList.searchAgentsPlaceholder': { 'zh-CN': '搜索智能体...', en: 'Search agents…' },
  'chat.agentList.newAgent': { 'zh-CN': '新建智能体', en: 'New Agent' },
  'chat.agentList.defaultChatAgentTitlePrefix': { 'zh-CN': '新建聊天智能体 - ', en: 'New Chat Agent - ' },
  'chat.agentList.agents': { 'zh-CN': '智能体', en: 'Agents' },
  'chat.agentList.pinned': { 'zh-CN': '已固定', en: 'Pinned' },
  'chat.agentList.groupByAge': { 'zh-CN': '按时间分组', en: 'Group by Age' },
  'chat.agentList.groupByWorkspace': { 'zh-CN': '按工作区分组', en: 'Group by Workspace' },
  'chat.agentList.groupOptionAge': { 'zh-CN': '时间', en: 'Age' },
  'chat.agentList.groupOptionWorkspace': { 'zh-CN': '工作区', en: 'Workspace' },
  'chat.agentList.group.today': { 'zh-CN': '今天', en: 'Today' },
  'chat.agentList.group.yesterday': { 'zh-CN': '昨天', en: 'Yesterday' },
  'chat.agentList.group.last7Days': { 'zh-CN': '最近 7 天', en: 'Last 7 days' },
  'chat.agentList.group.last30Days': { 'zh-CN': '最近 30 天', en: 'Last 30 days' },
  'chat.agentList.group.older': { 'zh-CN': '更早', en: 'Older' },
  'chat.sidebar.newChat': { 'zh-CN': '新建对话', en: 'New chat' },
  'chat.sharedMenu.unpin': { 'zh-CN': '取消固定', en: 'Unpin' },
  'chat.sharedMenu.pinGlobally': { 'zh-CN': '全局固定', en: 'Pin globally' },
  'chat.sharedMenu.permanentlyDelete': { 'zh-CN': '永久删除', en: 'Permanently delete' },
  'chat.sharedMenu.copyInstanceId': { 'zh-CN': '复制实例 ID', en: 'Copy instance ID' },
  'chat.sharedMenu.openDataDir': { 'zh-CN': '打开数据目录', en: 'Open data directory' },
  'chat.newTab.openBrowserTab': { 'zh-CN': '打开浏览器标签', en: 'Open browsing tab' },
  'chat.newTab.openTerminalTab': { 'zh-CN': '打开终端标签', en: 'Open terminal tab' },
  'chat.newTab.openNewBrowserTab': { 'zh-CN': '打开新的浏览器标签', en: 'Open new browser tab' },
  'chat.newTab.openNewTerminalTab': { 'zh-CN': '打开新的终端标签', en: 'Open new terminal tab' },
  'chat.preview.previewOfTab': { 'zh-CN': '标签预览图', en: 'Preview of the tab' },
  'chat.preview.copyCurrentUrl': { 'zh-CN': '复制当前 URL', en: 'Copy current URL' },
  'chat.preview.copyUrl': { 'zh-CN': '复制 URL', en: 'Copy URL' },
  'chat.permissions.title': { 'zh-CN': '权限请求', en: 'Permission Requests' },
  'chat.permissions.noPending': { 'zh-CN': '暂无待处理请求', en: 'No pending requests' },
  'chat.permissions.selectDevice': { 'zh-CN': '选择设备...', en: 'Select a device…' },
  'chat.permissions.enterPairingPin': { 'zh-CN': '请输入配对 PIN', en: 'Enter pairing PIN' },
  'chat.codingPlan.enterApiKey': { 'zh-CN': '请输入 API 密钥...', en: 'Enter API key...' },
  'chat.cmdCenter.label': { 'zh-CN': '命令中心', en: 'Command center' },
  'chat.cmdCenter.close': { 'zh-CN': '关闭命令中心', en: 'Close command center' },
  'chat.cmdCenter.modeToggle': { 'zh-CN': '按 Tab 键切换命令中心模式', en: 'Press Tab to cycle command center modes' },
  'chat.worktreeCleanup.dismiss': { 'zh-CN': '忽略工作树清理提示', en: 'Dismiss worktree cleanup' },
  'chat.worktreeCleanup.title': {
    'zh-CN': '清理旧工作树？',
    en: 'Clean old worktrees?',
  },
  'chat.worktreeCleanup.description.one': {
    'zh-CN': '{count} 个干净且不活跃的 worktree 已合并，可以安全移除。',
    en: '{count} clean, inactive worktree is already merged and can be removed safely.',
  },
  'chat.worktreeCleanup.description.other': {
    'zh-CN': '{count} 个干净且不活跃的 worktree 已合并，可以安全移除。',
    en: '{count} clean, inactive worktrees are already merged and can be removed safely.',
  },
  'chat.worktreeCleanup.mergedInto': {
    'zh-CN': '已合并到 {target}',
    en: 'merged into {target}',
  },
  'chat.worktreeCleanup.lastUsedNever': {
    'zh-CN': '从未使用',
    en: 'never',
  },
  'chat.worktreeCleanup.lastUsedDays': {
    'zh-CN': '{count}天',
    en: '{count}d',
  },
  'chat.worktreeCleanup.failed': {
    'zh-CN': '清理失败。',
    en: 'Cleanup failed.',
  },
  'chat.omnibox.placeholder': { 'zh-CN': '搜索或输入 URL', en: 'Search or type a URL' },
  'chat.omnibox.reloadCurrent': { 'zh-CN': '重新加载当前页面', en: 'Reload current page' },
  'chat.modelSelect.switchModel': { 'zh-CN': '切换模型', en: 'Switch model' },
  'chat.modelSelect.changeEffort': { 'zh-CN': '调整推理强度', en: 'Change reasoning effort' },
  'chat.workspaceSelect.disconnect': { 'zh-CN': '断开工作区连接', en: 'Disconnect workspace' },
  'chat.workspaceSelect.connect': { 'zh-CN': '连接工作区', en: 'Connect workspace' },
  'chat.workspaceSelect.skills': { 'zh-CN': '技能', en: 'Skills' },
  'chat.workspaceSelect.worktree': { 'zh-CN': '工作树', en: 'Worktree' },
  'chat.workspaceSelect.branch': { 'zh-CN': '分支', en: 'Branch' },
  'chat.emptySuggestions.connect': {
    'zh-CN': '连接 {workspace}',
    en: 'Connect {workspace}',
  },
  'chat.emptySuggestions.connecting': {
    'zh-CN': '正在连接 {workspace}...',
    en: 'Connecting {workspace}...',
  },
  'chat.emptySuggestions.dismiss': {
    'zh-CN': '关闭建议',
    en: 'Dismiss suggestion',
  },
  'chat.emptySuggestions.workspaceNoMount': {
    'zh-CN': '未能连接工作区：路径可能不存在，或后台挂载没有完成。',
    en: 'Workspace was not connected. The path may be missing, or the mount did not finish.',
  },
  'settings.autoRegister.captcha.2captcha': { 'zh-CN': '2Captcha API', en: '2Captcha API' },
  'settings.autoRegister.captcha.capsolver': { 'zh-CN': 'CapSolver API', en: 'CapSolver API' },
  'settings.autoRegister.captcha.yescaptcha': { 'zh-CN': 'YesCaptcha API', en: 'YesCaptcha API' },
};
