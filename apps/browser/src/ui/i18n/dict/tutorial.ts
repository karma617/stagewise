import type { Dict } from '../types';

export const tutorialDict: Dict = {
  'tutorial.general.chatInput.title': {
    'zh-CN': '聊天输入框',
    en: 'Chat Input',
  },
  'tutorial.general.chatInput.description': {
    'zh-CN':
      '在这里输入消息。你也可以拖入文件，用 `@` 提及标签页或工作区，并使用 `/` 命令。',
    en: 'Type messages here. You can also drag files, mention tabs or workspaces with `@`, and use `/` commands.',
  },
  'tutorial.general.connectWorkspace.title': {
    'zh-CN': '工作区读写权限',
    en: 'Read/Write Access to Workspaces',
  },
  'tutorial.general.connectWorkspace.description': {
    'zh-CN': '将代理连接到一个或多个工作区，包括普通目录和 Git 仓库。',
    en: 'Connect agents to one or more workspaces, both regular directories and Git repositories.',
  },
  'tutorial.general.newTabButtons.title': {
    'zh-CN': '浏览器、终端与文件树',
    en: 'Browser, Terminal & File Tree',
  },
  'tutorial.general.newTabButtons.description': {
    'zh-CN': '在这里打开浏览器或终端标签页，也可以切换文件树浏览工作区文件。',
    en: 'Open browser or terminal tabs here, and toggle the file tree to browse workspace files.',
  },
  'tutorial.general.sidebarPanel.title': {
    'zh-CN': '代理侧边栏',
    en: 'Agent Sidebar',
  },
  'tutorial.general.sidebarPanel.description': {
    'zh-CN':
      '这里会显示你的所有代理。每个代理都有自己独立的聊天、标签页和挂载的工作区。',
    en: 'This sidebar shows all your agents. Each agent keeps its own chat, tabs, and mounted workspaces.',
  },
  'tutorial.general.agentCard.title': {
    'zh-CN': '代理状态',
    en: 'Agent Status',
  },
  'tutorial.general.agentCard.description': {
    'zh-CN':
      '这是一个代理。开始工作后，标题旁可能会显示一个颜色状态点，含义如下：\n\n- **蓝色** - 工作中\n- **绿色** - 已完成\n- **黄色** - 等待你的回复\n- **红色** - 出错',
    en: 'This is one agent. Once you start working with an agent, a colored status dot may appear next to its title with one of these colors:\n\n- **Blue** — Working\n- **Green** — Done\n- **Yellow** — Waiting for your response\n- **Red** — Error',
  },
  'tutorial.workspaceSelection.workspaceBadge.title': {
    'zh-CN': '已连接 Git 仓库',
    en: 'Connected Git Repository',
  },
  'tutorial.workspaceSelection.workspaceBadge.description': {
    'zh-CN':
      '代理可以在此 Git 仓库中**读取**文件、**编辑**代码并**运行**命令。',
    en: 'The agent can **read** files, **edit** code, and **run** commands inside this Git repository.',
  },
  'tutorial.workspaceSelection.actionTrigger.title': {
    'zh-CN': '配置 Worktree / 分支模式',
    en: 'Configure Worktree / Branch Mode',
  },
  'tutorial.workspaceSelection.actionTrigger.description': {
    'zh-CN':
      '点击此下拉菜单，选择在仓库根目录的分支中工作，或使用 worktree 工作。',
    en: 'Click this dropdown to choose whether to work with a branch in the repository root, or with a worktree.',
  },
  'tutorial.workspaceOptions.createWorktree.title': {
    'zh-CN': '创建新 Worktree',
    en: 'Create new Worktree',
  },
  'tutorial.workspaceOptions.createWorktree.description': {
    'zh-CN':
      '创建一个带有独立分支的**新 worktree**，供代理在其中工作。\n\n你可以选择新 worktree 基于哪个源分支创建。',
    en: 'Creates a **new worktree** with its own branch for the agent to work in.\n\nYou can choose which source branch to base the new worktree on.',
  },
  'tutorial.workspaceOptions.switchWorktree.title': {
    'zh-CN': '使用已有 Worktree',
    en: 'Use existing Worktree',
  },
  'tutorial.workspaceOptions.switchWorktree.description': {
    'zh-CN':
      '将代理连接到一个**已有的 worktree**。\n\n这便于让**多个代理在同一个 worktree 上协作**。',
    en: 'Connects the agent to an **already-existing worktree**.\n\nThis makes it easy to let **multiple agents work on the same worktree**.',
  },
  'tutorial.workspaceOptions.createBranch.title': {
    'zh-CN': '创建新分支',
    en: 'Create new Branch',
  },
  'tutorial.workspaceOptions.createBranch.description': {
    'zh-CN':
      '在仓库根目录创建一个**新分支**，比 worktree 更简单。适合你想直接在仓库中工作而不创建 worktree 的场景。',
    en: 'Creates a **new branch in the repository root** — simpler than worktrees. Use this when you want to work directly in the repository without creating a worktree.',
  },
  'tutorial.workspaceOptions.switchBranch.title': {
    'zh-CN': '使用已有分支',
    en: 'Use existing Branch',
  },
  'tutorial.workspaceOptions.switchBranch.description': {
    'zh-CN':
      '将代理切换到仓库根目录中**已有的分支**。这是最简单的选项，只要选一个分支就能开始工作。',
    en: 'Switches the agent to an **already-existing branch** in the repository root. The simplest option — just pick a branch and start working.',
  },
  'tutorial.contentTabs.openedTabs.title': {
    'zh-CN': '已打开的标签页',
    en: 'Opened Tabs',
  },
  'tutorial.contentTabs.openedTabs.description': {
    'zh-CN':
      '标签页会显示在这里。**固定**图标会把标签页设为全局，让它在所有代理中都保持可见；**关闭**图标会将其移除。',
    en: 'Tabs appear here. The **pin** icon makes a tab global so it stays visible across all agents, and the **close** icon removes it.',
  },
  'tutorial.browserElementSelector.referenceElements.title': {
    'zh-CN': '引用网页元素',
    en: 'Reference Elements',
  },
  'tutorial.browserElementSelector.referenceElements.description': {
    'zh-CN': '使用这里在浏览器中选择元素，并将它们作为引用添加到聊天中。',
    en: 'Use this to select elements in the browser and add them to the chat as references.',
  },
  'tutorial.fileTree.panel.title': {
    'zh-CN': '文件树',
    en: 'File Trees',
  },
  'tutorial.fileTree.panel.description': {
    'zh-CN':
      '查看当前代理挂载的所有工作区中的文件。你可以直接在这里浏览、打开和预览文件。',
    en: 'See all files from all workspaces mounted to the current agent. You can browse, open, and preview files right here.',
  },
  'tutorial.fileTree.workspaceTabs.title': {
    'zh-CN': '切换工作区',
    en: 'Switch Workspace',
  },
  'tutorial.fileTree.workspaceTabs.description': {
    'zh-CN': '在这里切换已挂载工作区的文件树。',
    en: 'Switch between file trees of the mounted workspaces here.',
  },
};
