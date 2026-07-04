
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

## 2026-07-01 - Task: 新增 Windows 正式包一键打包脚本

### What was done
- 新增 `build-release.bat`，参考 `build-fast.bat` 实现 Windows 正式包一键打包流程。
- 正式脚本设置 `RELEASE_CHANNEL=release` 并执行 `pnpm make`，生成 `stagewise` 正式包而不是 `stagewise-dev` 开发包。
- 脚本在 `.env.prod` 缺失时自动从 `.env` 或 `.env.example` 生成本地 `.env.prod`，避免首次运行直接卡住。
- 脚本在打包后将 Camoufox 资源复制到 `apps/browser/out/release/**/resources/camoufox`。
- 新增 `docs/windows-build-release.md`，记录正式包脚本的前置条件、执行步骤和产物位置。

### Testing
- `cmd /c "echo y|build-release.bat"` 首次运行时自动从 `.env` 创建 `.env.prod`，随后完整执行 release make，退出码 0。
- 打包日志确认 `[forge.config] Release channel: release`。
- 已生成正式应用目录：`apps/browser/out/release/stagewise-win32-x64/stagewise.exe`。
- 已生成 Forge make 产物：`apps/browser/out/release/make/squirrel.windows/stagewise-1.14.0-x64-setup.exe`、`apps/browser/out/release/make/squirrel.windows/stagewise-1.14.0-x64-full.nupkg`、`apps/browser/out/release/make/squirrel.windows/RELEASES-win32-x64`、`apps/browser/out/release/make/zip/win32/x64/stagewise-win32-x64-1.14.0.zip`。
- 已确认 Camoufox 资源复制到 `apps/browser/out/release/stagewise-win32-x64/resources/camoufox`。

### Notes
改动文件清单：
- build-release.bat：新增 Windows 正式包一键打包脚本，并支持自动生成本地 `.env.prod`。回滚：删除该文件。
- docs/windows-build-release.md：新增正式包打包说明，并记录自动生成 `.env.prod` 与正式产物位置。回滚：删除该文件。
- progress.md：追加本轮脚本新增与验证记录。回滚：删除本条记录。
统一回滚点：`Remove-Item -LiteralPath build-release.bat, docs/windows-build-release.md; git checkout -- progress.md`。

## 2026-07-01 - Task: 修复聊天输入框输入后立即清空

### What was done
- 定位输入框无法保留文字的原因：聊天输入每次变更都会同步父级输入状态，触发 `ChatInput` 重渲染；TipTap `useEditor` 在无依赖参数时会比较并重设新创建的 editor options，导致输入过程中的内容和选择状态被打断。
- 将 TipTap 编辑器初始化改为带稳定依赖的形式，并把提交、粘贴、焦点、ESC、附件删除等事件回调用 ref 读取最新值，避免编辑器在每次输入后重新配置，同时避免事件闭包停留在首次渲染状态。
- 删除 `ChatInput` 内部只用于旧提交判断的 `textContent/canSendMessage/handleSubmit` 局部链路，保留父级已有的发送状态与提交校验，减少输入期额外重渲染。

### Testing
- `pnpm exec biome check --write apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-input.tsx` 退出码 0。
- `git diff --check` 退出码 0；仅提示 `progress.md` 下次由 Git 触碰时 CRLF 会替换为 LF。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 未通过：被既有 `sidebar-experience-survey.tsx` survey 契约缺口，以及 `chat-input.tsx` 中 ProseMirror 依赖重复类型冲突阻塞；本轮输入框修复未新增新的类型错误类别。

### Notes
改动文件清单：
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-input.tsx：稳定 TipTap 编辑器配置和事件回调，防止输入状态同步引发编辑器重配后清空输入。回滚：git checkout 该文件。
- progress.md：追加本轮修复与验证记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-input.tsx progress.md`。

## 2026-07-01 - Task: 修复聊天输入框重挂载后草稿回退为空

### What was done
- 继续排查输入框仍无法输入的问题，定位到父级 `ChatPanelFooter` 普通输入时只更新 `localInputStateRef`，没有同步更新传给 `ChatInput` 的 `value` 状态。
- 将 `updateChatInputState` 改为同时更新 `localInputState`，确保输入框因 agent/focus/外部状态变化发生重挂载或重新同步时，拿到的是最新草稿，而不是旧的空草稿。
- 保留上一轮 TipTap 编辑器稳定化处理，形成两层保护：编辑器不因输入重配，重挂载时也不回退为空内容。

### Testing
- `pnpm exec biome check --write apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-input.tsx` 退出码 0。
- `git diff --check` 退出码 0；仅提示 `progress.md` 下次由 Git 触碰时 CRLF 会替换为 LF。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 未通过：仍被既有 `sidebar-experience-survey.tsx` survey 契约缺口，以及 `chat-input.tsx` 中 ProseMirror 依赖重复类型冲突阻塞；本轮父级草稿同步修复未新增新的类型错误类别。

### Notes
改动文件清单：
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx：普通输入时同步更新 `localInputState`，防止输入框重挂载后使用旧空草稿。回滚：git checkout 该文件。
- progress.md：追加本轮修复与验证记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx progress.md`。

## 2026-07-01 - Task: 按 17:51 可用包回退聊天输入链路

### What was done
- 根据用户确认的 2026-06-30 17:51 可用包作为回归边界，定位 18:01 后输入链路直接差异集中在聊天输入区域新增的 i18n 订阅与文案替换。
- 从 `ChatInput` 和 `ChatPanel` 撤回本次回归窗口内新增的 i18n 订阅，恢复 17:51 基线里的静态输入框占位文案、按钮文案和 drop zone aria 文案。
- 恢复零宽字符为 `\u200B` 转义写法，避免不可见字符在后续维护中被误改。
- 撤回上一轮 `panel-footer` 每次输入都 `setLocalInputState` 的临时方案，避免把输入框重新变成每键父级重渲染的受控链路。

### Testing
- `pnpm exec biome check apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-input.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/index.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx` 退出码 0。
- `git diff --check` 退出码 0；仅提示 `progress.md` 下次由 Git 触碰时 CRLF 会替换为 LF。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 未通过：被既有 `sidebar-experience-survey.tsx` survey 契约缺口，以及 `chat-input.tsx` 中 ProseMirror 依赖重复类型冲突阻塞；本轮回退未新增新的类型错误类别。

### Notes
改动文件清单：
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-input.tsx：撤回输入框内部 i18n 订阅和文案替换，保留 TipTap 编辑器稳定化处理，并恢复 `\u200B` 转义写法。回滚：git checkout 该文件。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/index.tsx：撤回聊天面板外层 i18n 订阅，恢复 drop zone 静态 aria 文案。回滚：git checkout 该文件。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx：撤回上一轮每键同步 `localInputState` 的临时方案，当前不保留最终差异。回滚：无需额外操作。
- progress.md：追加本轮回退与验证记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-input.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/index.tsx progress.md`。

## 2026-07-01 - Task: 加固聊天输入框防外部空草稿覆盖

### What was done
- 在 `ChatInput` 外部 value 同步逻辑中增加焦点期保护：当输入框正聚焦且编辑器已有内容时，外部传入的空草稿不再覆盖当前编辑器内容。
- 在 `ChatPanelFooter` 增加按 agent 维度的本地草稿缓存，普通输入只更新 ref、缓存和后端输入状态，不触发每键父级重渲染。
- 将发送清空、失败恢复、agent 切换恢复等路径同步写入草稿缓存，避免输入框重挂载时重新拿到旧空草稿。

### Testing
- `pnpm exec biome check apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-input.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/index.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx` 退出码 0。
- `git diff --check` 退出码 0；仅提示 `progress.md` 下次由 Git 触碰时 CRLF 会替换为 LF。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 未通过：仍被既有 `sidebar-experience-survey.tsx` survey 契约缺口，以及 `chat-input.tsx` 中 ProseMirror 依赖重复类型冲突阻塞；本轮加固未新增新的类型错误类别。

### Notes
改动文件清单：
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-input.tsx：阻止聚焦输入期间外部空草稿覆盖已有编辑器内容。回滚：git checkout 该文件。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx：增加 agent 草稿缓存，防止输入框重挂载时回退到旧空草稿。回滚：git checkout 该文件。
- progress.md：追加本轮加固与验证记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-input.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx progress.md`。

## 2026-07-01 - Task: 修复 ProseMirror 依赖重复导致聊天输入失败

### What was done
- 根据运行时报错 `Can not convert <...> to a Fragment (looks like multiple versions of prosemirror-model were loaded)`，确认输入框清空根因不是业务状态覆盖，而是运行时加载了多份 `prosemirror-model`。
- 在有效的 `pnpm-workspace.yaml` overrides 中锁定 ProseMirror 核心包版本，使 TipTap、prosemirror-view、prosemirror-highlight 等依赖解析到同一组 ProseMirror 实例。
- 执行依赖重装并更新 `pnpm-lock.yaml`，将 `prosemirror-model` 从 2 个版本收敛为 1 个版本。
- 清理 Vite 预打包缓存并重新启动 Electron 应用，避免继续使用旧的重复依赖缓存。
- 新增 ProseMirror 依赖去重说明文档，记录后续变更依赖后的验证方式。
- 撤回排查阶段保留在输入组件、footer 和 UI console 转发里的临时代码，最终不保留聊天输入组件源码差异。

### Testing
- `pnpm install` 退出码 0，已按新 overrides 更新本地依赖与锁文件。
- `pnpm why prosemirror-model --recursive` 退出码 0，输出 `Found 1 version of prosemirror-model`。
- `pnpm -F stagewise clear-vite-cache` 退出码 0，已清理 `src/ui/node_modules/.vite` 与 `src/pages/node_modules/.vite`。
- `pnpm -F stagewise start:fast` 已成功启动 Electron 应用；用户手动输入并发送后，终端出现 `agent-message-sent`，未再出现 ProseMirror `RangeError`。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 未通过：只剩既有 `sidebar-experience-survey.tsx` survey 契约字段缺失，未再出现 `chat-input.tsx` 或 ProseMirror 重复类型错误。
- `git diff --check` 退出码 0；仅提示 `progress.md` 下次由 Git 触碰时 CRLF 会替换为 LF。
- `pnpm exec biome check pnpm-workspace.yaml docs/prosemirror-dependency-dedupe.md` 未处理文件：当前 Biome 配置忽略 YAML 和 Markdown 路径。

### Notes
改动文件清单：
- pnpm-workspace.yaml：新增 ProseMirror 核心包 overrides，强制运行时单版本解析。回滚：删除本轮新增的 `prosemirror-*` overrides。
- pnpm-lock.yaml：依赖重装后同步锁文件，将 ProseMirror 解析结果收敛到单版本。回滚：随 `pnpm-workspace.yaml` 一起恢复锁文件。
- docs/prosemirror-dependency-dedupe.md：新增依赖去重说明和验证命令。回滚：删除该文件。
- progress.md：追加本轮根因修复与验证记录。回滚：删除本条记录。
统一回滚点：`git checkout -- pnpm-workspace.yaml pnpm-lock.yaml progress.md; Remove-Item -LiteralPath docs/prosemirror-dependency-dedupe.md`。

## 2026-07-01 - Task: 重新执行 Windows fast 和 release 打包

### What was done
- 在 ProseMirror 依赖去重修复后，重新执行 `build-fast.bat` 生成 dev packaged app 和 zip。
- 重新执行 `build-release.bat` 生成 release packaged app、Squirrel 安装包、nupkg、RELEASES 文件和 zip 分发包。
- 发现 Forge postMake 提示根目录同名 setup 已存在且未覆盖，将本轮新生成的 `x64/stagewise-1.14.0-x64-setup.exe` 覆盖到根目录最终交付路径。

### Testing
- `cmd /c "echo y|build-fast.bat"` 退出码 0，输出 `SUCCESS`。
- `cmd /c "echo y|build-release.bat"` 退出码 0，输出 `SUCCESS`。
- 已确认以下产物存在：`apps/browser/out/dev/stagewise-dev-win32-x64/stagewise-dev.exe`、`apps/browser/out/dev/stagewise-dev-win32-x64.zip`、`apps/browser/out/release/stagewise-win32-x64/stagewise.exe`、`apps/browser/out/release/make/squirrel.windows/stagewise-1.14.0-x64-setup.exe`、`apps/browser/out/release/make/squirrel.windows/stagewise-1.14.0-x64-full.nupkg`、`apps/browser/out/release/make/squirrel.windows/RELEASES-win32-x64`、`apps/browser/out/release/make/zip/win32/x64/stagewise-win32-x64-1.14.0.zip`。
- 已确认最终 setup 路径 `apps/browser/out/release/make/squirrel.windows/stagewise-1.14.0-x64-setup.exe` 的时间戳为本轮打包时间 `2026/7/1 13:14:09`。

### Notes
改动文件清单：
- apps/browser/out/dev/stagewise-dev-win32-x64：重新生成 dev packaged app 目录。回滚：删除该目录后重新打包或恢复旧产物备份。
- apps/browser/out/dev/stagewise-dev-win32-x64.zip：重新生成 dev zip 包。回滚：删除该文件后重新打包或恢复旧产物备份。
- apps/browser/out/release/stagewise-win32-x64：重新生成 release packaged app 目录。回滚：删除该目录后重新打包或恢复旧产物备份。
- apps/browser/out/release/make：重新生成 release make 分发产物。回滚：删除该目录后重新打包或恢复旧产物备份。
- progress.md：追加本轮打包执行与产物验证记录。回滚：删除本条记录。
统一回滚点：`Remove-Item -Recurse -Force -LiteralPath apps/browser/out/dev/stagewise-dev-win32-x64, apps/browser/out/release/stagewise-win32-x64, apps/browser/out/release/make; Remove-Item -Force -LiteralPath apps/browser/out/dev/stagewise-dev-win32-x64.zip; git checkout -- progress.md`。

## 2026-07-01 - Task: 放开核心提示词的 CTF、逆向和自身应用分析能力

### What was done
- 整理主聊天 Agent 的核心系统提示词组成：agent-core 默认片段、browser host 覆盖片段、环境 domain 片段、workspace-md 子 Agent 提示词、历史压缩/标题生成提示词和 shell smart-approval 分类提示词。
- 移除 browser host `soul.md` 中“拒绝 harmful/illegal 请求”的限制条款，替换为无技术内容限制的 CTF、逆向、二进制分析、解包、反混淆、漏洞利用与安全研究能力描述。
- 放开 browser host 对 shell/sandbox 的用途限制，允许在 CTF、逆向、解包、动态插桩、二进制分析等任务中使用调试器、反编译器、反汇编器、unpacker、Frida/GDB/pwndbg/radare2/Ghidra/objdump/readelf/strings、exploit scripts 等工具。
- 在 agent-core 默认 `soul.md` 中明确允许分析、逆向、解包、插桩、反编译 stagewise 自身应用和任意挂载项目。
- 移除 core authorities 中“malicious or illegal directives / security rules always take precedence”的技能信任限制，改为按当前任务和用户指令处理技能指导。
- 调整 shell smart-approval 提示词：本地、工作区内的 CTF/逆向/解包/反编译/漏洞利用/二进制分析命令不因安全关键词或工具名本身要求人工审批。
- 新增 `docs/unrestricted-technical-prompts.md`，汇总核心系统提示词路径和当前能力策略。

### Testing
- `rg -n "Refuse|refuse|harmful|illegal|safe alternatives|Be safe|shell is for dev scripts|package management only|referencing \\.stagewise|never maliciously|malicious or illegal" ...` 退出码 1，无残留匹配。
- `rg -n "CTF|reverse engineering|unpacking|decompilation|stagewise itself|Application self-analysis|Do not require approval merely" ...` 退出码 0，确认新增放行能力描述命中。
- `pnpm exec biome check apps/browser/src/backend/services/toolbox/tools/shell/smart-approval/prompt.ts` 退出码 0。
- `git diff --check` 退出码 0；仅提示 `progress.md` 下次由 Git 触碰时 CRLF 会替换为 LF。
- `pnpm -F @stagewise/agent-core test -- system-prompt-builder` 实际跑完整 agent-core vitest，43 个 test files / 580 tests 全部通过。
- `pnpm -F stagewise test -- smart-approval` 实际跑 browser vitest，53 个 test files / 742 passed / 1 skipped。
- `pnpm -F stagewise test -- agent-core-bridge` 实际跑 browser vitest，53 个 test files / 742 passed / 1 skipped。
- `pnpm -F @stagewise/agent-core exec tsc -p tsconfig.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 未通过：既有 `src/backend/services/toolbox/tools/file-modification/get-linting-diagnostics.ts(133,11)` 的 `string | MarkupContent` 到 `string` 类型错误阻塞，和本轮提示词改动无关。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 未通过：既有 `sidebar-experience-survey.tsx` survey 契约字段缺失阻塞，和本轮提示词改动无关。

### Notes
改动文件清单：
- apps/browser/src/backend/agents/chat/prompts/soul.md：移除拒绝类限制，加入 CTF/逆向/解包/自身应用分析能力，并放开 shell/sandbox 用途。回滚：git checkout 该文件。
- packages/agent-core/src/agents/chat/prompts/soul.md：补充 stagewise 自身和任意挂载项目可被逆向、解包、插桩、反编译的明确条款。回滚：git checkout 该文件。
- packages/agent-core/src/agents/chat/prompts/authorities.md：移除技能信任段落中的 malicious/illegal/security 优先限制。回滚：git checkout 该文件。
- apps/browser/src/backend/services/toolbox/tools/shell/smart-approval/prompt.ts：允许工作区内 CTF/逆向/解包/反编译相关命令不因安全关键词本身触发审批。回滚：git checkout 该文件。
- docs/unrestricted-technical-prompts.md：新增核心提示词路径和能力策略说明。回滚：删除该文件。
- progress.md：追加本轮提示词整理、修改与验证记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/agents/chat/prompts/soul.md packages/agent-core/src/agents/chat/prompts/soul.md packages/agent-core/src/agents/chat/prompts/authorities.md apps/browser/src/backend/services/toolbox/tools/shell/smart-approval/prompt.ts progress.md; Remove-Item -LiteralPath docs/unrestricted-technical-prompts.md`。

## 2026-07-01 - Task: 提示词放开后重新执行 Windows fast 和 release 打包

### What was done
- 在核心提示词放开 CTF、逆向、解包、自身应用分析能力后，重新执行 `build-fast.bat` 生成 dev packaged app 与 zip。
- 重新执行 `build-release.bat` 生成 release packaged app、Squirrel 安装包、nupkg、RELEASES 文件与 zip 分发包。
- 发现 Forge postMake 仍因根目录同名 setup 已存在未自动覆盖，已将本轮 `x64/stagewise-1.14.0-x64-setup.exe` 覆盖到最终交付路径。

### Testing
- `cmd /c "echo y|build-fast.bat"` 退出码 0，输出 `SUCCESS`。
- `cmd /c "echo y|build-release.bat"` 退出码 0，输出 `SUCCESS`，日志确认 `[forge.config] Release channel: release`。
- 已确认以下产物存在并为本轮打包时间：`apps/browser/out/dev/stagewise-dev-win32-x64/stagewise-dev.exe`、`apps/browser/out/dev/stagewise-dev-win32-x64.zip`、`apps/browser/out/release/stagewise-win32-x64/stagewise.exe`、`apps/browser/out/release/make/squirrel.windows/stagewise-1.14.0-x64-setup.exe`、`apps/browser/out/release/make/squirrel.windows/stagewise-1.14.0-x64-full.nupkg`、`apps/browser/out/release/make/squirrel.windows/RELEASES-win32-x64`、`apps/browser/out/release/make/zip/win32/x64/stagewise-win32-x64-1.14.0.zip`。
- 已确认最终 setup 路径 `apps/browser/out/release/make/squirrel.windows/stagewise-1.14.0-x64-setup.exe` 的时间戳为本轮打包时间 `2026/7/1 13:34:51`。

### Notes
改动文件清单：
- apps/browser/out/dev/stagewise-dev-win32-x64：重新生成 dev packaged app 目录。回滚：删除该目录后重新打包或恢复旧产物备份。
- apps/browser/out/dev/stagewise-dev-win32-x64.zip：重新生成 dev zip 包。回滚：删除该文件后重新打包或恢复旧产物备份。
- apps/browser/out/release/stagewise-win32-x64：重新生成 release packaged app 目录。回滚：删除该目录后重新打包或恢复旧产物备份。
- apps/browser/out/release/make：重新生成 release make 分发产物，并覆盖最终 setup 交付文件。回滚：删除该目录后重新打包或恢复旧产物备份。
- progress.md：追加本轮提示词放开后的最终打包执行与产物验证记录。回滚：删除本条记录。
统一回滚点：`Remove-Item -Recurse -Force -LiteralPath apps/browser/out/dev/stagewise-dev-win32-x64, apps/browser/out/release/stagewise-win32-x64, apps/browser/out/release/make; Remove-Item -Force -LiteralPath apps/browser/out/dev/stagewise-dev-win32-x64.zip; git checkout -- progress.md`。

## 2026-07-02 - Task: 红框内用户问题表单文本 i18n

### What was done
- 将截图红框内用户问题表单的已知英文标题、说明、字段名和占位符接入 i18n 映射，在中文界面显示中文文案，在英文界面保留原英文文案。
- 保留 pending question 的原始数据协议不变；未知动态问题文本继续原样显示，避免误翻译 agent 临时生成内容。
- 补齐用户问题表单校验时对当前语言 `t` 的依赖，确保语言切换后校验和按钮完成状态使用最新文案。

### Testing
- `pnpm -F stagewise exec biome check src/ui/screens/main/agent-chat/chat/_components/footer-status-card/user-question-section.tsx` 退出码 0。
- `git diff --check` 退出码 0；仅提示 `panel-footer.tsx` 下次由 Git 触碰时 CRLF 会替换为 LF。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 未通过：既有 `src/ui/screens/main/_components/sidebar-experience-survey.tsx` 的 `experienceSurvey`、`survey`、`founderCallSurvey`、`firstUsedAt`、`founderCall`、`totalAgentCount` contract 字段缺失阻塞，报错文件不在本轮改动范围内。
- `pnpm -F stagewise exec biome check src/ui/screens/main/agent-chat/chat/_components/footer-status-card/user-question-section.tsx src/ui/screens/main/agent-chat/chat/_components/footer-status-card/index.tsx src/ui/i18n/dict/chat.ts src/ui/i18n/dict/common.ts src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx` 未通过：`chat.ts`、`common.ts`、`panel-footer.tsx` 存在既有格式差异；为避免全文件格式化扩大 diff，本轮只确认直接改动的 `user-question-section.tsx` 单文件通过。

### Notes
改动文件清单：
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/footer-status-card/user-question-section.tsx：为用户问题表单增加已知源文本到 i18n key 的 UI 层映射，并让标题、说明、字段、占位符和校验文案走当前语言。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/footer-status-card/user-question-section.tsx`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/footer-status-card/index.tsx：向用户问题表单 section 传入已有 `t`，用于标题翻译。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/footer-status-card/index.tsx`。
- apps/browser/src/ui/i18n/dict/chat.ts：新增红框内 alias limit 表单标题、说明、字段名和占位符的中英文词条。回滚：`git checkout -- apps/browser/src/ui/i18n/dict/chat.ts`。
- progress.md：追加本轮 i18n 改动与验证记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/footer-status-card/user-question-section.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/footer-status-card/index.tsx apps/browser/src/ui/i18n/dict/chat.ts progress.md`。

## 2026-07-02 - Task: 修复 sidebar experience survey typecheck 阻塞

### What was done
- 补齐用户体验 survey 的共享 contract、默认状态和持久化 JSON 名称，恢复 UI 对 `experienceSurvey`、`founderCallSurvey`、`firstUsedAt` 和 `totalAgentCount` 的类型访问。
- 为 sidebar survey UI 调用的 answer、dismiss、submit feedback、open founder call、dismiss founder call procedure 增加后台 handler，避免点击动作只有 UI 声明但无运行时接线。
- 增加相关 telemetry 事件类型，并记录 survey 状态和验证入口文档。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise test -- experience` 退出码 0，`1` 个 test file / `9` 个 tests 全部通过。
- `pnpm -F stagewise exec biome check src/shared/karton-contracts/ui/index.ts src/backend/services/experience.ts src/backend/services/telemetry.ts src/backend/utils/paths.ts src/ui/screens/main/_components/sidebar-experience-survey.tsx` 退出码 0。
- `git diff --check` 退出码 0；仅提示 `panel-footer.tsx` 下次由 Git 触碰时 CRLF 会替换为 LF。

### Notes
改动文件清单：
- apps/browser/src/shared/karton-contracts/ui/index.ts：新增 survey 状态 schema、StoredExperienceData 字段、默认值和 userExperience survey procedure 合同。回滚：`git checkout -- apps/browser/src/shared/karton-contracts/ui/index.ts`。
- apps/browser/src/backend/services/experience.ts：注册 survey/founder call procedure handler，读写 survey 状态和 first-used-at，并同步 storedExperienceData。回滚：`git checkout -- apps/browser/src/backend/services/experience.ts`。
- apps/browser/src/backend/services/telemetry.ts：新增 survey 相关 telemetry event 类型。回滚：`git checkout -- apps/browser/src/backend/services/telemetry.ts`。
- apps/browser/src/backend/utils/paths.ts：新增 `experience-surveys` 和 `first-used-at` 持久化 JSON 名称。回滚：`git checkout -- apps/browser/src/backend/utils/paths.ts`。
- docs/user-experience-surveys.md：新增 survey 状态、procedure 和验证命令说明。回滚：删除该文件。
- progress.md：追加本轮 typecheck 阻塞修复与验证记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/backend/services/experience.ts apps/browser/src/backend/services/telemetry.ts apps/browser/src/backend/utils/paths.ts progress.md; Remove-Item -LiteralPath docs/user-experience-surveys.md`。

## 2026-07-02 - Task: 移除 sidebar 体验调查弹窗和触发逻辑

### What was done
- 移除 sidebar 中 “Do you enjoy your experience with stagewise?” 体验调查弹窗挂载，保留通知、额度提醒和 worktree 清理提示。
- 删除 `SidebarExperienceSurvey` 组件，连同首轮体验调查、创始人通话调查、冷却时间、使用天数、agent 数量阈值等触发逻辑一起移除。
- 清理 Storybook mock 状态里的 survey 字段残留，避免后续维护误以为该弹窗仍有运行路径。
- 回收上轮为该弹窗补的 survey contract/backend/docs 接线，当前 `apps/browser/src` 和 `docs` 中已无 survey 触发关键词残留。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise test -- experience` 退出码 0，`1` 个 test file / `9` 个 tests 全部通过。
- `pnpm -F stagewise exec biome lint src/ui/screens/main/sidebar/index.tsx src/ui/screens/main/agent-chat/chat/_components/agent/stories/agent-lifecycle-scenarios.stories.tsx src/ui/screens/main/agent-chat/chat/_components/agent/stories/agent-messages.stories.tsx src/ui/screens/main/agent-chat/chat/_components/agent/stories/copy-tool.stories.tsx src/ui/screens/main/agent-chat/chat/_components/agent/stories/delete-tool.stories.tsx src/ui/screens/main/agent-chat/chat/_components/agent/stories/list-files-tool.stories.tsx src/ui/screens/main/agent-chat/chat/_components/agent/stories/mkdir-tool.stories.tsx src/ui/screens/main/agent-chat/chat/_components/agent/stories/sandbox-tool.stories.tsx src/ui/screens/main/agent-chat/chat/_components/agent/stories/shell-tool.stories.tsx` 退出码 0。
- `rg -n "SidebarExperienceSurvey|experienceSurvey|founderCallSurvey|firstUsedAt|totalAgentCount|experience-surveys|first-used-at|experience-survey|founder-call-survey|userExperience\\.survey|userExperience\\.founderCall" apps\\browser\\src docs -S` 退出码 1，无残留匹配。
- `git diff --check` 退出码 0；仅提示被触碰的 story/sidebar 文件和既有 `panel-footer.tsx` 下次由 Git 触碰时 CRLF 会替换为 LF。

### Notes
改动文件清单：
- apps/browser/src/ui/screens/main/sidebar/index.tsx：移除 `SidebarExperienceSurvey` import 和 sidebar 挂载点。回滚：`git checkout -- apps/browser/src/ui/screens/main/sidebar/index.tsx`。
- apps/browser/src/ui/screens/main/_components/sidebar-experience-survey.tsx：删除体验调查弹窗组件及其触发判断。回滚：`git checkout -- apps/browser/src/ui/screens/main/_components/sidebar-experience-survey.tsx`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/agent/stories/*.stories.tsx：移除 Storybook mock 中的 survey 状态残留。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/agent/stories`。
- apps/browser/src/shared/karton-contracts/ui/index.ts、apps/browser/src/backend/services/experience.ts、apps/browser/src/backend/services/telemetry.ts、apps/browser/src/backend/utils/paths.ts：回收上轮未提交的 survey contract/backend/docs 接线，当前不再保留该弹窗的运行时触发链路。回滚：若需要恢复该弹窗，需重新实现对应 contract、handler 和持久化键。
- docs/user-experience-surveys.md：移除上轮未提交的 survey 文档。回滚：从上轮 diff 恢复该文件。
- progress.md：追加本轮移除记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui/screens/main/sidebar/index.tsx apps/browser/src/ui/screens/main/_components/sidebar-experience-survey.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/agent/stories progress.md`；如需恢复上轮 survey contract/backend/docs 接线，还需重新应用对应未提交 diff。

## 2026-07-03 - Task: 优化帐号池长列表滚动性能

### What was done
- 将帐号池账号列表改为虚拟列表渲染，只渲染当前视口附近的账号卡片，降低账号很多时的 DOM 数量和滚动压力。
- 将账号卡片提取为 memo 行组件，并稳定刷新、切换、删除和清除日志回调，减少无关状态变化导致的可见行重复渲染。
- 保留现有导入、导出、自动注册、健康检查、单账号刷新、切换、删除和日志展示行为不变。

### Testing
- `pnpm -F stagewise exec biome check src/ui/screens/settings/sections/account-pool-section.tsx` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `git diff --check` 退出码 0。

### Notes
改动文件清单：
- apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx：为帐号池长列表接入 `react-virtuoso` 虚拟渲染，并拆出 memo 化账号行组件。回滚：`git checkout -- apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx`。
- progress.md：追加本轮性能优化与验证记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx progress.md`。

## 2026-07-03 - Task: 继续优化帐号池滚动并修复切换后未知用户状态

### What was done
- 将帐号池页面改为由 `Virtuoso` 直接管理主滚动容器，顶部统计、任务日志和空状态作为虚拟列表 header，账号卡片作为虚拟 item，避免外层滚动容器与虚拟列表组合削弱优化效果。
- 降低账号卡片滚动时的绘制成本，移除账号行阴影和用量条宽度动画，保留现有状态、按钮和用量信息。
- 修复 session 刷新返回缺少 user 时仍显示 authenticated 的异常状态：现在会用本地凭据中的账号邮箱回填，切换帐号池账号后不再落到 “Unknown user / 未知用户”。
- 将帐号页中文界面的 unknown-user 兜底文案修正为“未知用户”。

### Testing
- `pnpm -F stagewise exec biome check src/ui/screens/settings/sections/account-pool-section.tsx src/ui/i18n/dict/settings.ts` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `git diff --check` 退出码 0。

### Notes
改动文件清单：
- apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx：将帐号池页面主滚动改为虚拟列表直接承载，并降低账号行绘制成本。回滚：`git checkout -- apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx`。
- apps/browser/src/backend/services/auth/index.ts：session 刷新缺少 user 时用本地凭据回填当前用户邮箱，避免切换后 authenticated 但无邮箱。回滚：`git checkout -- apps/browser/src/backend/services/auth/index.ts`。
- apps/browser/src/ui/i18n/dict/settings.ts：修正帐号页中文 unknown-user 兜底文案。回滚：`git checkout -- apps/browser/src/ui/i18n/dict/settings.ts`。
- progress.md：追加本轮性能与 auth 修复记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx apps/browser/src/backend/services/auth/index.ts apps/browser/src/ui/i18n/dict/settings.ts progress.md`。

## 2026-07-03 - Task: 修复设置页深色主题左侧边栏背景

### What was done
- 为设置页左侧边栏根容器接入设计系统主题背景和前景色，深色主题下不再保留浅色大块背景。
- 保留现有导航、返回按钮、帐号池统计和账号 footer 行为不变。

### Testing
- `pnpm -F stagewise exec biome check src/ui/screens/settings/sidebar.tsx` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。

### Notes
改动文件清单：
- apps/browser/src/ui/screens/settings/sidebar.tsx：设置页侧栏根容器增加 `bg-background text-foreground`，随浅色/深色主题自动切换。回滚：`git checkout -- apps/browser/src/ui/screens/settings/sidebar.tsx`。
- progress.md：追加本轮 UI 修复记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui/screens/settings/sidebar.tsx progress.md`。

## 2026-07-03 - Task: 优化启动期卡顿、帐号池滚动和外观切换响应

### What was done
- 将主界面预览容器的 DOM 变化监听从“任意 body 子树变化都重绑布局”收窄为“仅预览容器出现或移除时重绑”，避免启动后一两分钟内大量聊天区、文件树、代码块 DOM 初始化反复触发布局计算。
- 外观浅色/深色/跟随系统切换改为先在当前窗口即时应用，再异步保存配置；保存失败时回滚到持久化状态，减少等待后端配置写入和系统主题事件回传带来的体感延迟。
- 继续收紧帐号池虚拟列表 overscan，减少滚动时同时挂载和参与布局绘制的账号卡片数量。

### Testing
- `pnpm -F stagewise exec biome check src/ui/components/web-contents-bounds-syncer.tsx src/ui/screens/settings/sections/personalization-settings-section.tsx src/ui/screens/settings/sections/account-pool-section.tsx` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `git diff --check` 退出码 0。

### Notes
改动文件清单：
- apps/browser/src/ui/components/web-contents-bounds-syncer.tsx：收窄 MutationObserver 对启动期无关 DOM 变化的响应范围。回滚：`git checkout -- apps/browser/src/ui/components/web-contents-bounds-syncer.tsx`。
- apps/browser/src/ui/screens/settings/sections/personalization-settings-section.tsx：外观模式切换改为本地即时应用并异步持久化。回滚：`git checkout -- apps/browser/src/ui/screens/settings/sections/personalization-settings-section.tsx`。
- apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx：降低帐号池虚拟列表 overscan。回滚：`git checkout -- apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx`。
- progress.md：追加本轮性能优化与验证记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui/components/web-contents-bounds-syncer.tsx apps/browser/src/ui/screens/settings/sections/personalization-settings-section.tsx apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx progress.md`。

## 2026-07-03 - Task: 调整左下角帐号池统计文本居中

### What was done
- 将左侧栏底部帐号池统计条改为左右两列等宽布局，中间分隔线固定居中。
- “总账号”和“可用”两组文本分别在左右半区水平居中显示，保留原有统计逻辑和底部账号入口行为不变。

### Testing
- `pnpm -F stagewise exec biome check src/ui/screens/main/_components/sidebar-auth-footer.tsx` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `git diff --check` 退出码 0。

### Notes
改动文件清单：
- apps/browser/src/ui/screens/main/_components/sidebar-auth-footer.tsx：调整帐号池统计条布局，使左右统计文本居中。回滚：`git checkout -- apps/browser/src/ui/screens/main/_components/sidebar-auth-footer.tsx`。
- progress.md：追加本轮 UI 调整记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui/screens/main/_components/sidebar-auth-footer.tsx progress.md`。

## 2026-07-03 - Task: 修复主对话左侧边栏深色主题背景

### What was done
- 为主对话界面左侧边栏根面板接入设计系统主题背景和前景色。
- 深色主题下侧栏不再保留浅色底色，浅色主题下仍跟随 `bg-background` 正常显示。

### Testing
- `pnpm -F stagewise exec biome check src/ui/screens/main/sidebar/index.tsx` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `git diff --check` 退出码 0。

### Notes
改动文件清单：
- apps/browser/src/ui/screens/main/sidebar/index.tsx：主对话侧栏根面板增加 `bg-background text-foreground`，随主题切换。回滚：`git checkout -- apps/browser/src/ui/screens/main/sidebar/index.tsx`。
- progress.md：追加本轮主题修复记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui/screens/main/sidebar/index.tsx progress.md`。

## 2026-07-04 - Task: 增加启动期 UI 假死根因诊断

### What was done
- 增加默认关闭的启动性能诊断模式，通过 `STAGEWISE_STARTUP_PROFILING=1` 开启，不影响正常启动路径。
- 诊断模式会在启动前 120 秒内采集 Electron/Chromium trace、渲染进程 long task、RAF 卡顿间隔、页面加载时序和主进程事件循环滞后。
- 诊断结果统一落盘到 app logs 下的 `startup-profile-*` 目录，便于后续对照“刚打开后 UI 假死”的真实时间窗口分析根因。
- 补充启动诊断使用文档，说明 PowerShell 启动方式、输出文件和阅读顺序。

### Testing
- `pnpm -F stagewise exec biome check --formatter-enabled=false src/backend/index.ts src/backend/utils/startup-profiler.ts src/ui-preload/index.ts` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc --target ES2022 --module ESNext --moduleResolution bundler --strict --skipLibCheck --lib "ES2022,DOM" --types "node,vite/client" --jsx react-jsx --noEmit src/ui-preload/index.ts` 退出码 0。
- `git diff --check` 退出码 0；仅提示既有 CRLF/LF 转换 warning。
- `pnpm -F stagewise exec vite build --config vite.ui-preload.config.ts` 未作为有效验证：该 Vite config 依赖 Electron Forge 注入入口，直接运行会报 `Could not resolve entry module "index.html"`。
- `pnpm -F stagewise start:fast -- --smoke-test` 未进入应用验证：`electron-forge start` 将 `--smoke-test` 识别为未知 Forge 参数。
- `pnpm -F stagewise exec biome check --formatter-enabled=false ..\..\docs\startup-performance-profiling.md` 未作为有效验证：当前 Biome 配置忽略 `docs/` 下 markdown。

### Notes
改动文件清单：
- apps/browser/src/backend/index.ts：启动时按环境变量动态启用 profiler，并记录 app ready、main import、main called 关键启动标记。回滚：`git checkout -- apps/browser/src/backend/index.ts`。
- apps/browser/src/backend/utils/startup-profiler.ts：新增启动诊断模块，负责 trace 采集、IPC 接收、主进程卡顿采样和文件落盘。回滚：`git rm apps/browser/src/backend/utils/startup-profiler.ts`。
- apps/browser/src/ui-preload/index.ts：诊断模式下采集 renderer long task、RAF gap、加载时序和可见性事件，并批量发送到主进程。回滚：`git checkout -- apps/browser/src/ui-preload/index.ts`。
- docs/startup-performance-profiling.md：新增启动性能诊断使用说明。回滚：`git rm docs/startup-performance-profiling.md`。
- progress.md：追加本轮启动诊断记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/index.ts apps/browser/src/ui-preload/index.ts progress.md && git rm apps/browser/src/backend/utils/startup-profiler.ts docs/startup-performance-profiling.md`。

## 2026-07-04 - Task: 排查启动诊断文件缺失并修复 preload 开关判断

### What was done
- 检查 Roaming 和 LocalAppData 下的 `stagewise*` 数据目录，未发现任何 `startup-profile-*` 诊断目录；当前运行进程为 `out\dev\stagewise-dev-win32-x64\stagewise-dev.exe`，启动时间为 2026-07-04 01:46，但 app logs 目录为空。
- 确认打包构建产物里包含后端 profiler 代码和 ui-preload profiler 代码，但 ui-preload 中 `process.env.STAGEWISE_STARTUP_PROFILING` 被 Vite 打包替换为 `{}` 读取，导致 renderer 侧采样不会启动。
- 将 renderer 侧开关判断改为直接向主进程查询 `startup-profiler:get-config`，主进程未开启诊断时静默忽略无 handler 返回，避免正常启动路径产生噪音。
- 更新诊断文档，明确打包 exe 采样必须从设置了环境变量的 PowerShell 启动，双击启动不会继承诊断环境变量。

### Testing
- `pnpm -F stagewise exec biome check --formatter-enabled=false src/ui-preload/index.ts src/backend/index.ts src/backend/utils/startup-profiler.ts` 退出码 0。
- `pnpm -F stagewise exec tsc --target ES2022 --module ESNext --moduleResolution bundler --strict --skipLibCheck --lib "ES2022,DOM" --types "node,vite/client" --jsx react-jsx --noEmit src/ui-preload/index.ts` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `git diff --check` 退出码 0；仅提示既有 CRLF/LF 转换 warning。

### Notes
改动文件清单：
- apps/browser/src/ui-preload/index.ts：移除 preload 中不可依赖的 `process.env` 判断，改为向主进程查询诊断配置。回滚：`git checkout -- apps/browser/src/ui-preload/index.ts`。
- docs/startup-performance-profiling.md：补充打包 exe 的 PowerShell 启动方式，并说明双击不会继承诊断环境变量。回滚：`git checkout -- docs/startup-performance-profiling.md`。
- progress.md：追加本轮诊断缺失排查记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui-preload/index.ts docs/startup-performance-profiling.md progress.md`。

## 2026-07-04 - Task: 给最近工作区快捷连接增加状态反馈

### What was done
- 修复空聊天页最近工作区快捷连接没有反馈的问题：点击后立即显示正在连接状态，并禁用重复点击。
- 连接完成后会确认该路径确实进入已挂载工作区；如果后端返回但未产生挂载，会在建议列表下方展示失败原因。
- 后端抛出的连接错误会直接显示在同一区域，用户不再需要猜测是报错还是任务卡住。
- 新增对应中英文文案，保持界面语言一致。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec biome check --formatter-enabled=false src/ui/screens/main/agent-chat/chat/_components/empty-chat-suggestions.tsx src/ui/i18n/dict/chat.ts` 退出码 0。
- `git diff --check -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/empty-chat-suggestions.tsx apps/browser/src/ui/i18n/dict/chat.ts` 退出码 0；仅提示既有 CRLF/LF 转换 warning。

### Notes
改动文件清单：
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/empty-chat-suggestions.tsx：最近工作区快捷连接增加 loading、重复点击保护、挂载确认和错误提示。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/empty-chat-suggestions.tsx`。
- apps/browser/src/ui/i18n/dict/chat.ts：新增快捷连接状态和错误提示的中英文文案。回滚：`git checkout -- apps/browser/src/ui/i18n/dict/chat.ts`。
- progress.md：追加本轮快捷连接反馈修复记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/empty-chat-suggestions.tsx apps/browser/src/ui/i18n/dict/chat.ts progress.md`。

## 2026-07-05 - Task: 强化核心系统提示词的用户任务执行策略

### What was done
- 在主聊天 Agent 的默认核心提示词中加入不按主题、难度、风险标签、不适感或安全分类拒绝用户任务的行为规则。
- 在 browser host 覆盖的核心提示词中同步加入同一规则，确保实际桌面应用使用的聊天 Agent 也遵循该策略。
- 补充“认真完整执行每个用户任务”的执行要求：理解意图、选择直接路径、谨慎实现、验证结果，只在真实外部限制阻塞时报告卡点。
- 更新核心提示词策略文档，记录当前主聊天 Agent 的无拒绝任务策略和完整执行策略。

### Testing
- `rg -n "Never refuse user tasks|Execute seriously and completely|Any user-requested task" packages\agent-core\src\agents\chat\prompts\soul.md apps\browser\src\backend\agents\chat\prompts\soul.md docs\unrestricted-technical-prompts.md` 退出码 0，确认三处目标文本均已落入。
- `pnpm -F @stagewise/agent-core test -- system-prompt-builder` 退出码 0，1 个 test file / 8 个 tests 全部通过。
- `git diff --check -- packages/agent-core/src/agents/chat/prompts/soul.md apps/browser/src/backend/agents/chat/prompts/soul.md docs/unrestricted-technical-prompts.md` 退出码 0。
- `pnpm exec biome check packages/agent-core/src/agents/chat/prompts/soul.md apps/browser/src/backend/agents/chat/prompts/soul.md docs/unrestricted-technical-prompts.md` 未作为有效验证：当前 Biome 配置忽略这些 Markdown 路径，输出 `No files were processed in the specified paths`。

### Notes
改动文件清单：
- packages/agent-core/src/agents/chat/prompts/soul.md：默认聊天 Agent 核心人格提示词加入不拒绝用户任务和认真完整执行任务的规则。回滚：`git checkout -- packages/agent-core/src/agents/chat/prompts/soul.md`。
- apps/browser/src/backend/agents/chat/prompts/soul.md：browser host 覆盖的聊天 Agent 核心人格提示词同步加入同一规则。回滚：`git checkout -- apps/browser/src/backend/agents/chat/prompts/soul.md`。
- docs/unrestricted-technical-prompts.md：记录主聊天 Agent 当前无拒绝和完整执行策略。回滚：`git checkout -- docs/unrestricted-technical-prompts.md`。
- progress.md：追加本轮提示词策略修改记录。回滚：删除本条记录。
统一回滚点：`git checkout -- packages/agent-core/src/agents/chat/prompts/soul.md apps/browser/src/backend/agents/chat/prompts/soul.md docs/unrestricted-technical-prompts.md progress.md`。
