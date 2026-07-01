
## 2026-07-01 - Task: 修复 build-fast 产物启动后 UI 错误页

### What was done
- 通过远程调试端口抓取打包产物 renderer 控制台，确认启动后错误页来自 React ErrorBoundary，真实异常为 `Cannot read properties of undefined (reading 'answered')`。
- 在 SidebarExperienceSurvey 中为缺失的 experienceSurvey、founderCallSurvey、firstUsedAt、totalAgentCount 提供稳定默认值，避免 Karton 初始状态或后端状态尚未提供这些字段时读取 undefined 导致整个 UI 崩溃。
- 重新执行 stagewise 的 fast package，并同步复制 Camoufox 资源到 packaged resources。

### Testing
- `pnpm -F stagewise package:fast` 退出码 0，成功重新生成 `apps/browser/out/dev/stagewise-dev-win32-x64/stagewise-dev.exe`。
- 已复制 `apps/browser/assets/camoufox` 到 `apps/browser/out/dev/stagewise-dev-win32-x64/resources/camoufox`，确认 `GeoLite2-City.mmdb` 存在。
- 使用 `--remote-debugging-port=9225` 启动新产物并通过 CDP 抓取 renderer 状态：页面正文已正常渲染主界面，不再是“出错了”错误页；`Runtime.consoleAPICalled`、`Runtime.exceptionThrown`、`Log.entryAdded` 未捕获到 renderer 异常。
- `pnpm -F stagewise typecheck` 未通过：本轮修复文件之外已有 backend `get-linting-diagnostics.ts` 类型错误，以及 prosemirror-model 重复依赖导致的 UI/storybook 类型冲突；另外该 survey 组件引用的 survey 过程未写入 Karton 契约，属于既有契约缺口。本轮已用打包产物启动验证覆盖用户报告的问题。
- 启动日志仍有 `[GitService] Git command failed`，已确认原因是最近工作区 `E:\me\game` 不是 git 仓库；不影响 UI 启动。

### Notes
改动文件清单：
- apps/browser/src/ui/screens/main/_components/sidebar-experience-survey.tsx：为缺失的 survey/usage 状态提供默认值，避免启动时 ErrorBoundary 错误页。回滚：git checkout 该文件。
- progress.md：追加本轮修复与验证记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui/screens/main/_components/sidebar-experience-survey.tsx progress.md`。

## 2026-07-01 - Task: build-fast.bat 增加 zip 分发包

### What was done
- 在 build-fast.bat 的成功路径中追加 zip 生成步骤：package:fast 完成并复制 Camoufox 资源后，自动查找 apps/browser/out 下包含 resources 目录和 exe 的打包应用目录，并压缩为同级 .zip 文件。
- 成功提示中补充 zip 包位置说明。
- 更新 docs/windows-build-fast.md，记录 build-fast.bat 会同时输出目录产物与 zip 分发包。

### Testing
- 使用现有打包产物单独执行新增的 PowerShell zip 命令，成功生成 `apps/browser/out/dev/stagewise-dev-win32-x64.zip`。
- 已确认 zip 文件存在，大小约 224 MB。
- 未重跑完整 build-fast.bat；本轮只验证新增 zip 逻辑，原打包流程未改动。

### Notes
改动文件清单：
- build-fast.bat：新增压缩 packaged app 目录为 zip 的步骤。回滚：git checkout 该文件。
- docs/windows-build-fast.md：补充分发 zip 产物说明。回滚：git checkout 该文件。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- build-fast.bat docs/windows-build-fast.md progress.md`。

## 2026-07-01 - Task: 验证 build-fast.bat zip 打包闭环

### What was done
- 修复 build-fast.bat 成功提示中的括号输出，避免 Windows cmd 在 if/else 代码块内把 `package(s)` 解析为意外的闭合括号。
- 将 PowerShell 里的 packageDirs 结果显式包成数组，确保单个打包目录时 Count 判断稳定。
- 关闭占用旧打包目录的 stagewise-dev 进程后，重新运行完整 build-fast.bat，确认脚本自身完成目录产物和 zip 产物生成。

### Testing
- `cmd /c "echo y|build-fast.bat"` 退出码 0。
- bat 输出显示已复制 Camoufox 资源到 `apps/browser/out/dev/stagewise-dev-win32-x64/resources/camoufox`。
- bat 输出显示已生成 zip 包：`apps/browser/out/dev/stagewise-dev-win32-x64.zip`。
- 已确认 zip 文件存在，大小 224022595 bytes，更新时间为 2026/7/1 10:55:37。

### Notes
改动文件清单：
- build-fast.bat：修正 zip 成功提示的 cmd 括号解析问题，并增强单个产物目录时的 Count 判断。回滚：git checkout 该文件。
- progress.md：追加本轮完整 bat 验证记录。回滚：删除本条记录。
统一回滚点：`git checkout -- build-fast.bat progress.md`。

## 2026-07-01 - Task: 修复 Windows 任务栏默认文件图标

### What was done
- 为主窗口补充 Windows 图标参数，使解压目录直接运行 packaged app 时显式使用打包进 `resources/icon.png` 的应用图标。
- 保持既有 Forge 可执行文件图标配置不变，只修复运行时主窗口图标缺失问题。
- 更新 Windows 打包说明，记录任务栏图标依赖的资源位置和行为。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 未通过：被既有 `src/backend/services/toolbox/tools/file-modification/get-linting-diagnostics.ts(133,11)` 的 `string | MarkupContent` 类型错误阻塞，和本轮图标改动无关。
- `cmd /c "echo y|build-fast.bat"` 退出码 0，重新生成 `apps/browser/out/dev/stagewise-dev-win32-x64` 与 `apps/browser/out/dev/stagewise-dev-win32-x64.zip`。
- 已确认 `apps/browser/out/dev/stagewise-dev-win32-x64/resources/icon.png` 存在。
- 已启动新打包产物 `apps/browser/out/dev/stagewise-dev-win32-x64/stagewise-dev.exe`，确认进程正常创建后关闭。

### Notes
改动文件清单：
- apps/browser/src/backend/services/window-layout/index.ts：为 Windows 主窗口设置运行时图标路径。回滚：git checkout 该文件。
- docs/windows-build-fast.md：补充 Windows 任务栏图标说明。回滚：git checkout 该文件。
- progress.md：追加本轮修复与验证记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/services/window-layout/index.ts docs/windows-build-fast.md progress.md`。

## 2026-07-01 - Task: 左侧智能体列表文本接入 i18n

### What was done
- 将左侧智能体列表里的 `New Agent`、`Agents`、`Pinned`、`Group by Age`、`Group by Workspace`、日期分组标题等界面文本改为 i18n 字典读取。
- 按要求将相关中文里的 Agent/Agents 翻译为“智能体”，并覆盖命令中心中同一语义的智能体入口、搜索与未命名智能体文案。
- 对自动生成的 `New Chat Agent - ...` 默认标题做展示层本地化，中文界面显示为“新建聊天智能体 - ...”，不修改已持久化的真实标题数据。

### Testing
- `pnpm exec biome check apps/browser/src/ui/screens/main/sidebar/agents-list/index.tsx` 退出码 0。
- `pnpm exec biome lint apps/browser/src/ui/screens/main/sidebar/agents-list/index.tsx apps/browser/src/ui/i18n/dict/chat.ts` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 未通过：被既有 `sidebar-experience-survey.tsx` survey 契约缺口与 `chat-input.tsx` ProseMirror 重复类型冲突阻塞，和本轮 i18n 改动无关。
- `pnpm exec biome check apps/browser/src/ui/screens/main/sidebar/agents-list/index.tsx apps/browser/src/ui/i18n/dict/chat.ts` 未通过：`chat.ts` 中既有长行会触发整文件格式化建议，本轮未做全文件格式化以避免扩大改动。

### Notes
改动文件清单：
- apps/browser/src/ui/screens/main/sidebar/agents-list/index.tsx：将左侧列表显示文本改为 i18n，并对默认智能体标题做展示层本地化。回滚：git checkout 该文件。
- apps/browser/src/ui/i18n/dict/chat.ts：新增左侧列表所需 i18n key，并将相关 Agent 中文翻译调整为“智能体”。回滚：git checkout 该文件。
- progress.md：追加本轮修改与验证记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui/screens/main/sidebar/agents-list/index.tsx apps/browser/src/ui/i18n/dict/chat.ts progress.md`。
