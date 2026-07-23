
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

## 2026-07-05 - Task: 选择性合并 main 正向代码改动到 local

### What was done
- 从 `main` 选择性合入文件树新建文件能力及其并发、分页和工作区切换修复，不合入会回退本地注册、帐号池、i18n、风控或提示词策略的差异。
- 合入启动期 worktree 清理扫描性能优化，复用已有 git summary/worktrees，减少重复 git 调用，并保留本地候选检查失败原因。
- 合入附件 metadata 空 provider 兜底修复，避免无 provider 场景渲染包含 attachment 链接的内容时崩溃。
- 合入 agent-shell 环境 diff 精简修复，避免把 raw terminal tail 内容重复注入 env-changes diff。
- 已识别但未合入 `main` 对 `soul.md` 的提示词改动，以及 `main` 对 `progress.md` 的删除；这些需要用户单独决定。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F @stagewise/agent-shell test -- shells-domain-adapter` 退出码 0，1 个 test file / 8 个 tests 全部通过。
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/backend/main.ts apps/browser/src/backend/services/file-tree/index.ts apps/browser/src/backend/services/git/index.ts apps/browser/src/backend/services/toolbox/services/mount-manager/index.ts apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/ui/hooks/use-attachment-metadata.tsx apps/browser/src/ui/screens/main/file-tree/file-tree-utils.ts apps/browser/src/ui/screens/main/file-tree/file-tree-workspace-view.tsx packages/agent-shell/src/env/shells-domain-adapter.test.ts packages/agent-shell/src/env/shells-domain-adapter.ts` 退出码 0。
- `git diff --check` 退出码 0。

### Notes
改动文件清单：
- apps/browser/src/backend/main.ts：注册 `fileTree.createFile` 后端过程。回滚：`git checkout -- apps/browser/src/backend/main.ts`。
- apps/browser/src/backend/services/file-tree/index.ts：新增 race-free 的新建文件服务逻辑。回滚：`git checkout -- apps/browser/src/backend/services/file-tree/index.ts`。
- apps/browser/src/backend/services/git/index.ts：允许复用已有 summary/worktrees，并标注只读 git 查询日志类型。回滚：`git checkout -- apps/browser/src/backend/services/git/index.ts`。
- apps/browser/src/backend/services/toolbox/services/mount-manager/index.ts：worktree 清理扫描复用已有 git 状态，同时保留本地失败原因返回。回滚：`git checkout -- apps/browser/src/backend/services/toolbox/services/mount-manager/index.ts`。
- apps/browser/src/shared/karton-contracts/ui/index.ts：暴露 `fileTree.createFile` UI contract。回滚：`git checkout -- apps/browser/src/shared/karton-contracts/ui/index.ts`。
- apps/browser/src/ui/hooks/use-attachment-metadata.tsx：无 provider 时返回空 metadata，避免渲染崩溃。回滚：`git checkout -- apps/browser/src/ui/hooks/use-attachment-metadata.tsx`。
- apps/browser/src/ui/screens/main/file-tree/file-tree-utils.ts：新增只读 workspace 判断工具。回滚：`git checkout -- apps/browser/src/ui/screens/main/file-tree/file-tree-utils.ts`。
- apps/browser/src/ui/screens/main/file-tree/file-tree-workspace-view.tsx：文件树右键菜单新增新建文件入口，并处理滚动、重命名、取消和工作区切换状态。回滚：`git checkout -- apps/browser/src/ui/screens/main/file-tree/file-tree-workspace-view.tsx`。
- packages/agent-shell/src/env/shells-domain-adapter.ts：env diff 不再携带 tailContent，并忽略 volatile shell fields 的等价比较。回滚：`git checkout -- packages/agent-shell/src/env/shells-domain-adapter.ts`。
- packages/agent-shell/src/env/shells-domain-adapter.test.ts：补充 env diff 不包含 tailContent 和 equals 忽略 volatile fields 的测试。回滚：`git checkout -- packages/agent-shell/src/env/shells-domain-adapter.test.ts`。
- progress.md：追加本轮选择性合并与验证记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/main.ts apps/browser/src/backend/services/file-tree/index.ts apps/browser/src/backend/services/git/index.ts apps/browser/src/backend/services/toolbox/services/mount-manager/index.ts apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/ui/hooks/use-attachment-metadata.tsx apps/browser/src/ui/screens/main/file-tree/file-tree-utils.ts apps/browser/src/ui/screens/main/file-tree/file-tree-workspace-view.tsx packages/agent-shell/src/env/shells-domain-adapter.ts packages/agent-shell/src/env/shells-domain-adapter.test.ts progress.md`。

## 2026-07-05 - Task: 将 slash 命令说明文本接入 i18n

### What was done
- 将聊天输入 `/` 命令建议列表中的内置命令和内置插件说明文本接入中英文 i18n。
- 保留 workspace/global 外部 skill 的原始说明作为兜底，不改变外部技能发现和筛选行为。
- 同步本地化 slash 建议弹层里的技能/插件分组标题和空状态文本。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec biome check --formatter-enabled=false src/ui/screens/main/agent-chat/chat/_components/rich-text/slash/types.ts src/ui/screens/main/agent-chat/chat/_components/rich-text/slash/provider.ts src/ui/screens/main/agent-chat/chat/_components/rich-text/slash/suggestion-popup.tsx src/ui/i18n/dict/chat.ts` 退出码 0。
- `git diff --check` 退出码 0；仅提示本轮触碰的三个 slash 文件存在 CRLF/LF 转换 warning。

### Notes
改动文件清单：
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/rich-text/slash/types.ts：给 slash item 增加可选 `descriptionKey`。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/rich-text/slash/types.ts`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/rich-text/slash/provider.ts：为内置命令和内置插件绑定说明文案 i18n key。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/rich-text/slash/provider.ts`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/rich-text/slash/suggestion-popup.tsx：渲染说明、分组标题和空状态时读取 i18n，并保留原始说明兜底。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/rich-text/slash/suggestion-popup.tsx`。
- apps/browser/src/ui/i18n/dict/chat.ts：新增 slash 命令说明和弹层基础文案的中英文词条。回滚：`git checkout -- apps/browser/src/ui/i18n/dict/chat.ts`。
- progress.md：追加本轮 slash 说明文本 i18n 记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/rich-text/slash/types.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/rich-text/slash/provider.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/rich-text/slash/suggestion-popup.tsx apps/browser/src/ui/i18n/dict/chat.ts progress.md`。

## 2026-07-06 - Task: 对话请求接入本地代理和 Clash 节点重试

### What was done
- 将 LLM 对话请求统一接入可配置的本地 HTTP 代理，默认代理地址为 `http://127.0.0.1:7897`。
- 新增 Clash Controller、Secret、代理组配置；当 LLM 请求返回 `403`/`Forbidden` 时自动读取 Clash selector 节点、切换节点并重试。
- 代理组留空时自动优先使用 `GLOBAL`，否则使用第一个可切换的 `Selector` 组；所有候选节点都失败时返回“当前订阅无可用节点，请更换订阅重试”。
- 将配置入口加入设置页通用设置，并补充使用文档和回归测试。

### Testing
- `pnpm -F stagewise test -- src/backend/agents/llm-network.test.ts src/shared/karton-contracts/ui/shared-types.test.ts` 退出码 0，2 个 test files / 21 个 tests 全部通过。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts apps/browser/src/backend/agents/model-provider.ts apps/browser/src/backend/agents/stagewise-provider.ts apps/browser/src/shared/karton-contracts/ui/shared-types.ts apps/browser/src/shared/karton-contracts/ui/shared-types.test.ts apps/browser/src/ui/screens/settings/sections/general-settings-section.tsx apps/browser/src/ui/i18n/dict/settings.ts docs/llm-network-proxy-clash.md` 退出码 0。
- `git diff --check -- apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts apps/browser/src/backend/agents/model-provider.ts apps/browser/src/backend/agents/stagewise-provider.ts apps/browser/src/shared/karton-contracts/ui/shared-types.ts apps/browser/src/shared/karton-contracts/ui/shared-types.test.ts apps/browser/src/ui/screens/settings/sections/general-settings-section.tsx apps/browser/src/ui/i18n/dict/settings.ts docs/llm-network-proxy-clash.md` 退出码 0；仅提示 `stagewise-provider.ts` 和 `shared-types.test.ts` 存在 CRLF/LF 转换 warning。
- 使用本机 Clash Controller `http://127.0.0.1:9097` 和用户提供的 Secret 验证真实接口：成功读取 2 个 Selector 组；`GLOBAL` 从 `🇸🇬 新加坡1|BGP优化` 临时切到 `官网: www.雨燕云.com` 后成功切回原节点。

### Notes
改动文件清单：
- apps/browser/src/backend/agents/llm-network.ts：新增 LLM fetch 代理、Forbidden 检测、Clash selector 自动发现和节点轮换重试逻辑。回滚：`git checkout -- apps/browser/src/backend/agents/llm-network.ts`。
- apps/browser/src/backend/agents/llm-network.test.ts：覆盖节点切换重试、全部失败提示和代理组自动发现。回滚：`git checkout -- apps/browser/src/backend/agents/llm-network.test.ts`。
- apps/browser/src/backend/agents/model-provider.ts：给 stagewise、官方 provider 和自定义 endpoint provider 注入统一 LLM fetch。回滚：`git checkout -- apps/browser/src/backend/agents/model-provider.ts`。
- apps/browser/src/backend/agents/stagewise-provider.ts：允许 stagewise provider 使用外部传入的 fetch，同时保留客户端标识请求头。回滚：`git checkout -- apps/browser/src/backend/agents/stagewise-provider.ts`。
- apps/browser/src/shared/karton-contracts/ui/shared-types.ts：为 agent preferences 增加对话代理和 Clash 配置字段。回滚：`git checkout -- apps/browser/src/shared/karton-contracts/ui/shared-types.ts`。
- apps/browser/src/shared/karton-contracts/ui/shared-types.test.ts：补充旧偏好配置迁移时的 LLM 网络默认值测试。回滚：`git checkout -- apps/browser/src/shared/karton-contracts/ui/shared-types.test.ts`。
- apps/browser/src/ui/screens/settings/sections/general-settings-section.tsx：在通用设置中新增对话请求网络配置表单。回滚：`git checkout -- apps/browser/src/ui/screens/settings/sections/general-settings-section.tsx`。
- apps/browser/src/ui/i18n/dict/settings.ts：新增对话请求网络设置的中英文文案。回滚：`git checkout -- apps/browser/src/ui/i18n/dict/settings.ts`。
- docs/llm-network-proxy-clash.md：记录代理、Clash 配置和 Forbidden 重试行为。回滚：`git checkout -- docs/llm-network-proxy-clash.md`。
- progress.md：追加本轮实现与验证记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/agents/model-provider.ts apps/browser/src/backend/agents/stagewise-provider.ts apps/browser/src/shared/karton-contracts/ui/shared-types.ts apps/browser/src/shared/karton-contracts/ui/shared-types.test.ts apps/browser/src/ui/screens/settings/sections/general-settings-section.tsx apps/browser/src/ui/i18n/dict/settings.ts progress.md; Remove-Item -LiteralPath apps/browser/src/backend/agents/llm-network.ts, apps/browser/src/backend/agents/llm-network.test.ts, docs/llm-network-proxy-clash.md`。

## 2026-07-06 - Task: 伪装 LLM 对话请求客户端识别信息

### What was done
- 检查 LLM 请求链路，确认 `X-Stagewise-Client: electron/<版本>` 和 AI SDK 生成的运行时 `User-Agent` 会随对话请求发出。
- 在 LLM 网络层移除 `X-Stagewise-Client`，并将 `User-Agent`、`Accept-Language`、`Sec-CH-UA`、`Sec-CH-UA-Mobile`、`Sec-CH-UA-Platform` 伪装为稳定浏览器请求头。
- 确认 telemetry 包装代码虽包含 app version/platform/arch，但当前 telemetry level 被强制为 `off`，不会参与 LLM 请求 tracing。
- 补充测试覆盖客户端识别请求头伪装行为，并同步更新代理/Clash 文档说明。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise test -- src/backend/agents/llm-network.test.ts src/shared/karton-contracts/ui/shared-types.test.ts` 退出码 0，2 个 test files / 22 个 tests 全部通过。
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts docs/llm-network-proxy-clash.md` 退出码 0。
- `git diff --check -- apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts docs/llm-network-proxy-clash.md` 退出码 0。

### Notes
改动文件清单：
- apps/browser/src/backend/agents/llm-network.ts：在所有 LLM 请求发出前统一移除 Stagewise 客户端头并伪装浏览器请求头。回滚：`git checkout -- apps/browser/src/backend/agents/llm-network.ts`。
- apps/browser/src/backend/agents/llm-network.test.ts：新增客户端识别头伪装断言。回滚：`git checkout -- apps/browser/src/backend/agents/llm-network.test.ts`。
- docs/llm-network-proxy-clash.md：补充 LLM 请求会伪装客户端身份头的说明。回滚：`git checkout -- docs/llm-network-proxy-clash.md`。
- progress.md：追加本轮检查、伪装改动与验证记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts docs/llm-network-proxy-clash.md progress.md`。

## 2026-07-06 - Task: 代理池增加 LLM 对话代理开关

### What was done
- 在代理池设置页新增“LLM 对话优先使用代理池”开关，默认关闭。
- 开关关闭时，LLM 对话继续使用通用设置里的本地代理配置，默认 `http://127.0.0.1:7897`。
- 开关打开时，LLM 对话请求会优先从代理池启用项随机选择一个代理；代理池无启用项时自动回落到本地代理。
- LLM 请求代理选择改为每次请求时解析，确保能读取最新代理池配置，并保持 Clash Forbidden 重试逻辑不变。
- 同步补充偏好默认值、i18n 文案、文档说明和回归测试。

### Testing
- `pnpm -F stagewise test -- src/backend/agents/llm-network.test.ts src/shared/karton-contracts/ui/shared-types.test.ts` 退出码 0，2 个 test files / 24 个 tests 全部通过。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts apps/browser/src/backend/agents/model-provider.ts apps/browser/src/shared/karton-contracts/ui/shared-types.ts apps/browser/src/shared/karton-contracts/ui/shared-types.test.ts apps/browser/src/ui/screens/settings/sections/proxy-pool-section.tsx apps/browser/src/ui/i18n/dict/settings.ts docs/llm-network-proxy-clash.md` 退出码 0。
- `git diff --check -- apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts apps/browser/src/backend/agents/model-provider.ts apps/browser/src/shared/karton-contracts/ui/shared-types.ts apps/browser/src/shared/karton-contracts/ui/shared-types.test.ts apps/browser/src/ui/screens/settings/sections/proxy-pool-section.tsx apps/browser/src/ui/i18n/dict/settings.ts docs/llm-network-proxy-clash.md` 退出码 0；仅提示 `shared-types.test.ts` 存在 CRLF/LF 转换 warning。

### Notes
改动文件清单：
- apps/browser/src/backend/agents/llm-network.ts：新增代理池解析和按请求选择 LLM 代理的逻辑，代理池不可用时回落到本地代理。回滚：`git checkout -- apps/browser/src/backend/agents/llm-network.ts`。
- apps/browser/src/backend/agents/llm-network.test.ts：补充代理池启用项选择和开关开启后加载代理池的测试。回滚：`git checkout -- apps/browser/src/backend/agents/llm-network.test.ts`。
- apps/browser/src/backend/agents/model-provider.ts：将 `llmUseProxyPool` 和代理池加载器传入 LLM fetch。回滚：`git checkout -- apps/browser/src/backend/agents/model-provider.ts`。
- apps/browser/src/shared/karton-contracts/ui/shared-types.ts：为 agent preferences 增加默认关闭的 `llmUseProxyPool`。回滚：`git checkout -- apps/browser/src/shared/karton-contracts/ui/shared-types.ts`。
- apps/browser/src/shared/karton-contracts/ui/shared-types.test.ts：补充 LLM 代理池开关默认值断言。回滚：`git checkout -- apps/browser/src/shared/karton-contracts/ui/shared-types.test.ts`。
- apps/browser/src/ui/screens/settings/sections/proxy-pool-section.tsx：在代理池页面新增 LLM 对话代理池开关，并用最小 preferences patch 保存。回滚：`git checkout -- apps/browser/src/ui/screens/settings/sections/proxy-pool-section.tsx`。
- apps/browser/src/ui/i18n/dict/settings.ts：新增代理池开关的中英文文案。回滚：`git checkout -- apps/browser/src/ui/i18n/dict/settings.ts`。
- docs/llm-network-proxy-clash.md：补充代理池开关使用方式、默认关闭和回落规则。回滚：`git checkout -- docs/llm-network-proxy-clash.md`。
- progress.md：追加本轮代理池 LLM 对话开关记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts apps/browser/src/backend/agents/model-provider.ts apps/browser/src/shared/karton-contracts/ui/shared-types.ts apps/browser/src/shared/karton-contracts/ui/shared-types.test.ts apps/browser/src/ui/screens/settings/sections/proxy-pool-section.tsx apps/browser/src/ui/i18n/dict/settings.ts docs/llm-network-proxy-clash.md progress.md`。

## 2026-07-06 - Task: 侧边栏帐号统计同步帐号池数量

### What was done
- 将侧边栏底部帐号统计改为订阅后端同步到 Karton 的 `accountPoolStats`，不再只在组件挂载时读取一次帐号池。
- 后端在启动、帐号池读取、导入、删除、刷新额度、健康检测、清理异常帐号、注册入池和切换帐号后同步统计，统计口径与帐号池 overview 保持一致。
- 自动切换帐号时先刷新帐号池内帐号额度，再选择未达到额度上限的帐号，并同步刷新后的统计。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/backend/services/auth/index.ts apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/ui/screens/main/_components/sidebar-auth-footer.tsx` 退出码 0；仅输出 `auth/index.ts` 既有字符串拼接 style 提示。

### Notes
改动文件清单：
- apps/browser/src/backend/services/auth/index.ts：新增帐号池统计同步，并在自动切换前刷新帐号池额度。回滚：`git checkout -- apps/browser/src/backend/services/auth/index.ts`。
- apps/browser/src/shared/karton-contracts/ui/index.ts：给 `userAccount` 状态增加 `accountPoolStats` 字段和默认值。回滚：`git checkout -- apps/browser/src/shared/karton-contracts/ui/index.ts`。
- apps/browser/src/ui/screens/main/_components/sidebar-auth-footer.tsx：侧边栏帐号统计改为读取 Karton 状态里的帐号池统计。回滚：`git checkout -- apps/browser/src/ui/screens/main/_components/sidebar-auth-footer.tsx`。
- progress.md：追加本轮帐号统计同步记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/services/auth/index.ts apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/ui/screens/main/_components/sidebar-auth-footer.tsx progress.md`。

## 2026-07-06 - Task: 修复账号池健康检测未走代理导致全部 fetch failed

### What was done
- 排查截图中的账号池健康检测失败，确认失败路径是 `/v1/usage/current` 用量接口请求，不属于 LLM 对话请求链路。
- 修复 `AuthServerInterop` 的 Stagewise API client，使订阅、当前用量、历史用量请求统一通过注册网络 fallback fetch 发出。
- 健康检测和账号池用量刷新现在会读取自动注册配置中的代理池，优先使用启用代理；没有代理池可用时再使用 Electron 系统代理解析，最后才直连。
- 批量健康检测日志新增本轮网络入口提示，会显示 `使用代理：...` 或 `未使用代理，直连请求`，方便后续判断是否命中代理。
- 扩展注册网络 fallback 入参类型，支持 API client 传入 `Request` 对象。
- 新增账号池健康检测网络说明文档。

### Testing
- `node -e "fetch('https://api.stagewise.io/v1/health').then(r=>console.log('direct',r.status)).catch(e=>console.error('direct error',e.name,e.message))"` 退出码 0，输出 `direct 200`。
- `node -e "const {ProxyAgent}=require('undici'); fetch('https://api.stagewise.io/v1/health',{dispatcher:new ProxyAgent('http://127.0.0.1:7897')}).then(r=>console.log('proxy',r.status)).catch(e=>console.error('proxy error',e.name,e.message))"` 退出码 0，输出 `proxy 200`。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `git diff --check -- apps/browser/src/backend/services/auth/index.ts apps/browser/src/backend/services/auth/server-interop.ts apps/browser/src/backend/services/auth/registration-network.ts docs/account-pool-health-network.md` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/backend/services/auth/index.ts apps/browser/src/backend/services/auth/server-interop.ts apps/browser/src/backend/services/auth/registration-network.ts` 退出码 0；仅输出这些文件里既有的字符串拼接 style info。

### Notes
改动文件清单：
- apps/browser/src/backend/services/auth/server-interop.ts：让 Stagewise API client 使用代理 fallback fetch，并支持为用量请求传入代理。回滚：`git checkout -- apps/browser/src/backend/services/auth/server-interop.ts`。
- apps/browser/src/backend/services/auth/index.ts：健康检测和账号池用量刷新读取代理池/系统代理，并把选中的网络入口写入健康检测日志。回滚：`git checkout -- apps/browser/src/backend/services/auth/index.ts`。
- apps/browser/src/backend/services/auth/registration-network.ts：注册网络 fetch/fallback 支持 `Request` 入参，适配 API client 的 fetcher。回滚：`git checkout -- apps/browser/src/backend/services/auth/registration-network.ts`。
- docs/account-pool-health-network.md：记录账号池健康检测代理选择和排查口径。回滚：`git checkout -- docs/account-pool-health-network.md` 或删除该文件。
- progress.md：追加本轮健康检测代理修复记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/services/auth/index.ts apps/browser/src/backend/services/auth/server-interop.ts apps/browser/src/backend/services/auth/registration-network.ts docs/account-pool-health-network.md progress.md`。

## 2026-07-07 - Task: 帐号池自动切换失败重试次数可配置

### What was done
- 将额度上限错误卡片里的自动切换帐号失败重试默认上限从 3 次改为 30 次。
- 在设置里的帐号池页面新增“自动切换失败重试次数”配置，保存到用户偏好并实时影响自动切换逻辑。
- 新增帐号池自动切换重试说明文档，明确默认值、设置入口和作用范围。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `git diff --check -- apps/browser/src/shared/karton-contracts/ui/shared-types.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx apps/browser/src/ui/i18n/dict/settings.ts docs/account-pool-auto-switch-retry.md` 退出码 0。
- `pnpm exec biome check apps/browser/src/shared/karton-contracts/ui/shared-types.ts apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx apps/browser/src/ui/i18n/dict/settings.ts docs/account-pool-auto-switch-retry.md` 退出码 0。
- `pnpm exec biome check apps/browser/src/shared/karton-contracts/ui/shared-types.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx apps/browser/src/ui/i18n/dict/settings.ts docs/account-pool-auto-switch-retry.md` 未作为通过项使用；`message-runtime-error.tsx` 存在本轮前已有的通用连接失败自动重试 lint 问题：未使用变量 `autoRetryCount` 和不可达循环。

### Notes
改动文件清单：
- apps/browser/src/shared/karton-contracts/ui/shared-types.ts：为用户偏好新增 `agent.accountPoolAutoSwitchMaxAttempts`，默认 30，最小值 1。回滚：`git checkout -- apps/browser/src/shared/karton-contracts/ui/shared-types.ts`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx：自动切换帐号失败重试次数改为读取用户偏好，默认 30。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx`。
- apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx：在帐号池设置页新增重试次数数字输入并写入用户偏好。回滚：`git checkout -- apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx`。
- apps/browser/src/ui/i18n/dict/settings.ts：新增帐号池重试次数设置的中英文文案。回滚：`git checkout -- apps/browser/src/ui/i18n/dict/settings.ts`。
- docs/account-pool-auto-switch-retry.md：新增帐号池自动切换重试配置说明。回滚：`git checkout -- docs/account-pool-auto-switch-retry.md` 或删除该文件。
- progress.md：追加本轮帐号池自动切换重试配置记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/shared/karton-contracts/ui/shared-types.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx apps/browser/src/ui/i18n/dict/settings.ts docs/account-pool-auto-switch-retry.md progress.md`。

## 2026-07-07 - Task: 打印帐号池自动切换异常详情

### What was done
- 排查“自动切换异常，正在重试”只显示泛化状态的问题，确认失败详情在前端 catch 分支被吞掉，后端无可用帐号结果也没有带最后一次候选帐号校验失败原因。
- 自动切换失败重试时，页面提示会显示本次异常详情，并在控制台打印每次切换调用失败的具体错误。
- 后端在帐号池没有可用帐号时，会把最后一次候选帐号用量校验失败的邮箱和错误信息附加到返回错误里，便于继续定位是代理、额度、认证还是接口异常。
- 修复同文件里既有的通用网络自动重试 lint 问题，避免本轮校验被无关问题阻断。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `git diff --check -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx apps/browser/src/backend/services/auth/index.ts` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx apps/browser/src/backend/services/auth/index.ts` 退出码 0；仅输出 `auth/index.ts` 既有字符串拼接 style 提示。

### Notes
改动文件清单：
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx：自动切换失败时展示并 console 打印具体异常详情，同时修复同文件既有通用网络自动重试 lint 问题。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx`。
- apps/browser/src/backend/services/auth/index.ts：无可用候选帐号时追加最后一次候选帐号校验失败原因。回滚：`git checkout -- apps/browser/src/backend/services/auth/index.ts`。
- progress.md：追加本轮异常详情打印记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx apps/browser/src/backend/services/auth/index.ts progress.md`。

## 2026-07-07 - Task: 增加 LLM 本地代理和 Clash 默认配置

### What was done
- 确认设置页已存在“对话请求网络”配置入口，可手动配置本地 HTTP 代理、Clash Controller 地址、Clash Secret 和 Clash 代理组。
- 将 LLM 对话网络默认配置统一为本地代理 `http://127.0.0.1:7897`、Clash Controller `http://127.0.0.1:9097`、已设置的 Clash Secret、代理组 `GLOBAL`。
- LLM 网络层增加运行时默认兜底，旧偏好里 Clash 地址、Secret 或代理组保存为空时，也会使用默认值执行节点切换。
- 更新设置页说明文案，明确默认端口、Secret 默认已设置，以及留空时使用默认值。
- 更新 LLM 代理和 Clash 重试文档，记录默认值和代理组选择规则。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise test -- src/backend/agents/llm-network.test.ts src/shared/karton-contracts/ui/shared-types.test.ts` 退出码 0，2 个 test files / 25 个 tests 全部通过。
- `git diff --check -- apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts apps/browser/src/shared/karton-contracts/ui/shared-types.ts apps/browser/src/shared/karton-contracts/ui/shared-types.test.ts apps/browser/src/ui/i18n/dict/settings.ts docs/llm-network-proxy-clash.md progress.md` 退出码 0；仅提示 `shared-types.test.ts` 工作区 CRLF 会被 Git 转为 LF。
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts apps/browser/src/shared/karton-contracts/ui/shared-types.ts apps/browser/src/shared/karton-contracts/ui/shared-types.test.ts apps/browser/src/ui/i18n/dict/settings.ts docs/llm-network-proxy-clash.md` 退出码 0。

### Notes
改动文件清单：
- apps/browser/src/backend/agents/llm-network.ts：为空的 Clash 设置增加运行时默认兜底。回滚：`git checkout -- apps/browser/src/backend/agents/llm-network.ts`。
- apps/browser/src/backend/agents/llm-network.test.ts：补充空配置使用默认 Clash 地址、Secret 和 GLOBAL 代理组的测试。回滚：`git checkout -- apps/browser/src/backend/agents/llm-network.test.ts`。
- apps/browser/src/shared/karton-contracts/ui/shared-types.ts：调整 LLM 对话网络偏好默认值。回滚：`git checkout -- apps/browser/src/shared/karton-contracts/ui/shared-types.ts`。
- apps/browser/src/shared/karton-contracts/ui/shared-types.test.ts：同步默认值测试断言。回滚：`git checkout -- apps/browser/src/shared/karton-contracts/ui/shared-types.test.ts`。
- apps/browser/src/ui/i18n/dict/settings.ts：更新设置页网络配置说明、Secret 和代理组占位文案。回滚：`git checkout -- apps/browser/src/ui/i18n/dict/settings.ts`。
- docs/llm-network-proxy-clash.md：记录本地代理、Clash Controller、Secret 和 GLOBAL 代理组默认行为。回滚：`git checkout -- docs/llm-network-proxy-clash.md`。
- progress.md：追加本轮默认配置记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts apps/browser/src/shared/karton-contracts/ui/shared-types.ts apps/browser/src/shared/karton-contracts/ui/shared-types.test.ts apps/browser/src/ui/i18n/dict/settings.ts docs/llm-network-proxy-clash.md progress.md`。

## 2026-07-07 - Task: 自动切号使用后台可用帐号池

### What was done
- 后端新增帐号池额度后台刷新任务，启动后立即刷新一次，之后每 3 分钟全量刷新帐号池额度。
- 每次刷新后重建内存可用帐号池，把有可用额度或额度重置窗口已过的帐号放入可用池。
- 自动切号改为直接从可用池取帐号，不再在切号路径从头全量刷新帐号池额度，避免等待时间随帐号池规模增长。
- 可用池按 FIFO 轮转，候选帐号切换失败会在本轮跳过并继续尝试下一个；可用池为空时会触发一次后台刷新供后续重试使用。
- 同步更新帐号池自动切换说明文档，记录 3 分钟后台刷新和缓存切号语义。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `git diff --check -- apps/browser/src/backend/services/auth/index.ts docs/account-pool-auto-switch-retry.md` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/backend/services/auth/index.ts docs/account-pool-auto-switch-retry.md` 退出码 0；仅输出 `auth/index.ts` 既有字符串拼接 style 提示。

### Notes
改动文件清单：
- apps/browser/src/backend/services/auth/index.ts：新增 3 分钟帐号池额度后台刷新、内存可用帐号池和自动切号缓存取号逻辑。回滚：`git checkout -- apps/browser/src/backend/services/auth/index.ts`。
- docs/account-pool-auto-switch-retry.md：补充后台刷新可用帐号池和自动切号缓存语义。回滚：`git checkout -- docs/account-pool-auto-switch-retry.md` 或删除该文件。
- progress.md：追加本轮自动切号优化记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/services/auth/index.ts docs/account-pool-auto-switch-retry.md progress.md`。

## 2026-07-07 - Task: 帐号池冷却帐号定向刷新

### What was done
- 将帐号池后台刷新策略从“每 3 分钟全量刷新所有帐号”改为“启动时全量刷新一次，之后每 3 分钟只刷新无额度冷却帐号列表”。
- 后端维护内存冷却池，记录暂无额度帐号及其预计恢复时间，并按恢复时间从小到大排序。
- 已有额度的帐号保留在可用池里，不再被定时刷新；当自动切号因当前帐号额度耗尽触发时，当前帐号会从可用池移除并加入冷却池。
- 可用池同步时保留已有 FIFO 顺序，只追加新增可用帐号，避免每次同步又退回数据库加入顺序。
- 更新帐号池自动切换文档，说明首次全量刷新、冷却池定向刷新和额度耗尽事件入池规则。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `git diff --check -- apps/browser/src/backend/services/auth/index.ts docs/account-pool-auto-switch-retry.md` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/backend/services/auth/index.ts docs/account-pool-auto-switch-retry.md` 退出码 0；仅输出 `auth/index.ts` 既有字符串拼接 style 提示。

### Notes
改动文件清单：
- apps/browser/src/backend/services/auth/index.ts：新增冷却帐号池、预计恢复时间排序和定时定向刷新逻辑，自动切号额度耗尽时把当前帐号加入冷却池。回滚：`git checkout -- apps/browser/src/backend/services/auth/index.ts`。
- docs/account-pool-auto-switch-retry.md：更新帐号池自动切换缓存和冷却池刷新说明。回滚：`git checkout -- docs/account-pool-auto-switch-retry.md` 或删除该文件。
- progress.md：追加本轮冷却帐号定向刷新记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/services/auth/index.ts docs/account-pool-auto-switch-retry.md progress.md`。

## 2026-07-07 - Task: LLM 切换节点等待状态提示

### What was done
- 新增 LLM 网络 fallback 状态，后端在读取 Clash 节点、切换候选节点、切换后重试对话请求时同步状态到 UI。
- 聊天历史 loading 区域会在 LLM 切节点期间显示明确提示，不再只显示空白等待区域。
- 状态文案支持中英文 i18n，并在节点候选变化时刷新显示当前节点、代理组和进度。
- LLM 网络状态在成功、无候选节点、全部失败或异常退出后都会清空，避免 UI 残留“正在切换”。
- 更新 LLM 代理和 Clash 文档，说明切节点期间会显示对话框内等待状态。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm -F stagewise test -- src/backend/agents/llm-network.test.ts` 退出码 0，8 个测试通过。
- `git diff --check -- apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts apps/browser/src/backend/agents/model-provider.ts apps/browser/src/backend/main.ts apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx apps/browser/src/ui/i18n/dict/chat.ts` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts apps/browser/src/backend/agents/model-provider.ts apps/browser/src/backend/main.ts apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx apps/browser/src/ui/i18n/dict/chat.ts` 退出码 0。

### Notes
改动文件清单：
- apps/browser/src/backend/agents/llm-network.ts：在 Clash 节点读取、切换和重试阶段上报 LLM 网络状态，并确保结束后清空。回滚：`git checkout -- apps/browser/src/backend/agents/llm-network.ts`。
- apps/browser/src/backend/agents/llm-network.test.ts：补充 LLM 网络状态上报和清空测试。回滚：`git checkout -- apps/browser/src/backend/agents/llm-network.test.ts`。
- apps/browser/src/backend/agents/model-provider.ts：接收并传递 LLM 网络状态回调。回滚：`git checkout -- apps/browser/src/backend/agents/model-provider.ts`。
- apps/browser/src/backend/main.ts：将 LLM 网络状态写入 Karton 全局状态。回滚：`git checkout -- apps/browser/src/backend/main.ts`。
- apps/browser/src/shared/karton-contracts/ui/index.ts：新增 `llmNetworkStatus` 状态类型和默认值。回滚：`git checkout -- apps/browser/src/shared/karton-contracts/ui/index.ts`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx：在聊天 loading 区域显示 LLM 网络切节点状态，并让状态文字变化触发缓存刷新。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx`。
- apps/browser/src/ui/i18n/dict/chat.ts：新增 LLM 网络等待状态中英文文案。回滚：`git checkout -- apps/browser/src/ui/i18n/dict/chat.ts`。
- docs/llm-network-proxy-clash.md：补充切节点期间对话框内状态提示说明。回滚：`git checkout -- docs/llm-network-proxy-clash.md`。
- progress.md：追加本轮状态提示优化记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts apps/browser/src/backend/agents/model-provider.ts apps/browser/src/backend/main.ts apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx apps/browser/src/ui/i18n/dict/chat.ts docs/llm-network-proxy-clash.md progress.md`。

## 2026-07-08 - Task: LLM Clash 节点切换诊断日志

### What was done
- LLM 对话请求在触发 Clash 节点切换时输出后端诊断日志，统一使用 `[llm-network]` 前缀。
- 日志覆盖候选 Clash 分组、候选节点名、节点 ping/delay、Clash 切换接口响应状态，以及切换后 LLM 重试请求的 HTTP 状态和 `Forbidden` 判断结果。
- `ModelProviderService` 将 LLM 网络日志接入主进程 logger，方便在运行日志中按前缀过滤排查。
- 单测补充切换日志断言，覆盖直接 delay 和 history 最新 delay 两种 Clash 返回形态。
- 文档补充 LLM Clash 切换期间可观察的后端日志字段。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise test -- src/backend/agents/llm-network.test.ts` 退出码 0，9 个测试通过。
- `git diff --check -- apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts apps/browser/src/backend/agents/model-provider.ts apps/browser/src/backend/agents/model-provider.test.ts apps/browser/src/backend/main.ts docs/llm-network-proxy-clash.md` 退出码 0；仅提示 `model-provider.test.ts` 工作区 CRLF/LF 提醒。
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts apps/browser/src/backend/agents/model-provider.ts apps/browser/src/backend/agents/model-provider.test.ts apps/browser/src/backend/main.ts docs/llm-network-proxy-clash.md` 退出码 0。

### Notes
改动文件清单：
- apps/browser/src/backend/agents/llm-network.ts：增加 Clash 节点候选、ping、切换接口结果和切换后 LLM 重试结果日志。回滚：`git checkout -- apps/browser/src/backend/agents/llm-network.ts`；若文件仍为未跟踪状态，则删除该文件恢复。
- apps/browser/src/backend/agents/llm-network.test.ts：补充 LLM Clash 切换诊断日志和 history delay 读取测试。回滚：`git checkout -- apps/browser/src/backend/agents/llm-network.test.ts`；若文件仍为未跟踪状态，则删除该文件恢复。
- apps/browser/src/backend/agents/model-provider.ts：注入 logger 并把 LLM 网络日志接入后端日志。回滚：`git checkout -- apps/browser/src/backend/agents/model-provider.ts`。
- apps/browser/src/backend/agents/model-provider.test.ts：为测试构造器补充 logger mock。回滚：`git checkout -- apps/browser/src/backend/agents/model-provider.test.ts`。
- apps/browser/src/backend/main.ts：创建 `ModelProviderService` 时传入主进程 logger。回滚：`git checkout -- apps/browser/src/backend/main.ts`。
- docs/llm-network-proxy-clash.md：补充切换节点期间后端日志字段说明。回滚：`git checkout -- docs/llm-network-proxy-clash.md`；若文件仍为未跟踪状态，则删除该文件恢复。
- progress.md：追加本轮诊断日志记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/agents/model-provider.ts apps/browser/src/backend/agents/model-provider.test.ts apps/browser/src/backend/main.ts progress.md`，并按需删除仍为未跟踪状态的 `apps/browser/src/backend/agents/llm-network.ts`、`apps/browser/src/backend/agents/llm-network.test.ts`、`docs/llm-network-proxy-clash.md`。

## 2026-07-08 - Task: 帐号池全量额度刷新并发与 UI 防假死

### What was done
- 明确帐号池额度刷新并发上限为 16，后台刷新按受控并发 worker 同时请求多个账号额度。
- 每个账号额度请求完成后主动让出事件循环，避免大账号池刷新长时间占用主进程。
- UI 触发全量额度刷新时不再同步等待全部账号请求结束；后端后台启动刷新后立即返回当前账号池快照。
- 设置页使用 `startTransition` 更新账号池大列表，并在后台刷新开始后短轮询拉取最新额度快照，保持界面可交互。
- 更新帐号池自动切换文档，记录全量额度刷新并发和 UI 非阻塞行为。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `git diff --check -- apps/browser/src/backend/services/auth/index.ts apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx docs/account-pool-auto-switch-retry.md` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/backend/services/auth/index.ts apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx docs/account-pool-auto-switch-retry.md` 退出码 0；仅输出 `auth/index.ts` 既有字符串拼接 style 提示。

### Notes
改动文件清单：
- apps/browser/src/backend/services/auth/index.ts：将全量额度刷新改为后台受控并发任务，刷新过程让出事件循环，并让 UI 调用快速返回当前快照。回滚：`git checkout -- apps/browser/src/backend/services/auth/index.ts`。
- apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx：账号池大列表更新使用 `startTransition`，全量额度刷新后短轮询同步最新快照。回滚：`git checkout -- apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx`。
- docs/account-pool-auto-switch-retry.md：补充全量额度刷新并发和 UI 非阻塞说明。回滚：`git checkout -- docs/account-pool-auto-switch-retry.md` 或删除该文件。
- progress.md：追加本轮全量额度刷新优化记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/services/auth/index.ts apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx docs/account-pool-auto-switch-retry.md progress.md`。

## 2026-07-08 - Task: LLM 连续 403 后帐号待观察切换

### What was done
- LLM Clash 节点切换逻辑新增账号疑似异常判断：超过 10 个节点切换成功后重试仍全部为 `403`/`Forbidden` 时，返回带内部标记的账号疑似 403 错误。
- 聊天错误卡片识别该内部标记后，会把当前帐号移入待观察状态，然后自动切换到其他可用帐号并重试当前请求。
- 帐号池新增 `observing` 状态；待观察帐号保留在列表中可见，但不会进入可用帐号池、冷却池、自动切换候选或健康检测刷新。
- 设置页新增待观察状态徽标和待观察数量统计，避免用户误以为帐号还在自动切换候选里。
- 文档补充连续节点 403 的账号待观察处理规则。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm -F stagewise test -- src/backend/agents/llm-network.test.ts` 退出码 0，10 个测试通过。
- `git diff --check -- apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts apps/browser/src/backend/services/auth/account-pool.ts apps/browser/src/backend/services/auth/index.ts apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx apps/browser/src/ui/i18n/dict/settings.ts docs/llm-network-proxy-clash.md docs/account-pool-auto-switch-retry.md` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts apps/browser/src/backend/services/auth/account-pool.ts apps/browser/src/backend/services/auth/index.ts apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx apps/browser/src/ui/i18n/dict/settings.ts docs/llm-network-proxy-clash.md docs/account-pool-auto-switch-retry.md` 退出码 0；仅输出 `auth/index.ts` 既有字符串拼接 style 提示。

### Notes
改动文件清单：
- apps/browser/src/backend/agents/llm-network.ts：超过 10 个切换节点仍 403 时返回账号疑似 403 内部标记。回滚：`git checkout -- apps/browser/src/backend/agents/llm-network.ts`；若文件仍为未跟踪状态，则删除该文件恢复。
- apps/browser/src/backend/agents/llm-network.test.ts：补充 10+ 节点 403 标记测试。回滚：`git checkout -- apps/browser/src/backend/agents/llm-network.test.ts`；若文件仍为未跟踪状态，则删除该文件恢复。
- apps/browser/src/backend/services/auth/account-pool.ts：新增 `observing` 帐号状态，并确保待观察帐号不会被用量刷新恢复为 normal。回滚：`git checkout -- apps/browser/src/backend/services/auth/account-pool.ts`。
- apps/browser/src/backend/services/auth/index.ts：新增待观察并切换帐号接口，自动切换可用池排除待观察帐号，健康检测跳过待观察帐号。回滚：`git checkout -- apps/browser/src/backend/services/auth/index.ts`。
- apps/browser/src/shared/karton-contracts/ui/index.ts：同步帐号池 `observing` 状态和新切换接口契约。回滚：`git checkout -- apps/browser/src/shared/karton-contracts/ui/index.ts`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx：识别账号疑似 403 错误，自动标记待观察、切换帐号并重试。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx`。
- apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx：显示待观察状态和统计，并禁止待观察帐号作为切换候选。回滚：`git checkout -- apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx`。
- apps/browser/src/ui/i18n/dict/settings.ts：新增待观察状态和统计文案。回滚：`git checkout -- apps/browser/src/ui/i18n/dict/settings.ts`。
- docs/llm-network-proxy-clash.md：补充连续节点 403 触发帐号待观察切换规则。回滚：`git checkout -- docs/llm-network-proxy-clash.md`；若文件仍为未跟踪状态，则删除该文件恢复。
- docs/account-pool-auto-switch-retry.md：补充待观察帐号不进入自动切换候选规则。回滚：`git checkout -- docs/account-pool-auto-switch-retry.md`；若文件仍为未跟踪状态，则删除该文件恢复。
- progress.md：追加本轮帐号待观察切换记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/services/auth/account-pool.ts apps/browser/src/backend/services/auth/index.ts apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx apps/browser/src/ui/i18n/dict/settings.ts progress.md`，并按需删除仍为未跟踪状态的 `apps/browser/src/backend/agents/llm-network.ts`、`apps/browser/src/backend/agents/llm-network.test.ts`、`docs/llm-network-proxy-clash.md`、`docs/account-pool-auto-switch-retry.md`。

## 2026-07-08 - Task: LLM Clash 切节点串行化与 403 快速切号

### What was done
- LLM 对话请求触发 Clash 切节点时改为全局串行：同一时间只允许一个切节点任务读取 Clash 节点并调用切换接口，其他并发请求等待共享结果，不再重复启动多个切节点任务。
- 连续超过 10 个成功切换的 Clash 节点重试后仍全部返回 `403`/`Forbidden` 时，立即停止继续切换剩余节点，并返回帐号疑似异常内部标记。
- 复用既有聊天错误处理链路：该内部标记会让当前帐号进入待观察状态，自动切换到其他可用帐号，并继续重试当前未完成对话。
- 单测补充并发 403 只触发一次 Clash 切换任务，以及 10+ 节点全 403 后不继续切换后续节点的断言。
- 文档补充切节点串行化和 10+ 节点全 403 后立即切号重试的行为说明。

### Testing
- `pnpm -F stagewise test -- src/backend/agents/llm-network.test.ts` 退出码 0，11 个测试通过。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `git diff --check -- apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts docs/llm-network-proxy-clash.md` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts docs/llm-network-proxy-clash.md` 退出码 0；Biome 实际检查 2 个源码测试文件，文档文件未纳入该规则。

### Notes
改动文件清单：
- apps/browser/src/backend/agents/llm-network.ts：增加 Clash 切节点任务单实例锁，等待方复用共享切换结果，并在超过 10 个节点全 403 时立即返回帐号异常标记。回滚：`git checkout -- apps/browser/src/backend/agents/llm-network.ts`；若文件仍为未跟踪状态，则删除该文件恢复。
- apps/browser/src/backend/agents/llm-network.test.ts：补充并发切节点串行化和 10+ 节点全 403 快速终止测试。回滚：`git checkout -- apps/browser/src/backend/agents/llm-network.test.ts`；若文件仍为未跟踪状态，则删除该文件恢复。
- docs/llm-network-proxy-clash.md：补充切节点串行化和帐号异常快速切号说明。回滚：`git checkout -- docs/llm-network-proxy-clash.md`；若文件仍为未跟踪状态，则删除该文件恢复。
- progress.md：追加本轮切节点串行化与快速切号记录。回滚：删除本条记录。
统一回滚点：`git checkout -- progress.md`，并按需删除仍为未跟踪状态的 `apps/browser/src/backend/agents/llm-network.ts`、`apps/browser/src/backend/agents/llm-network.test.ts`、`docs/llm-network-proxy-clash.md`。


## 2026-07-08 - Task: LLM 对话目标模式

### What was done
- 为 AgentState 增加 Codex 风格的目标状态，包含目标内容、active/complete/blocked 状态、时间戳、token 用量和阻塞原因。
- LLM 对话新增目标模式开关；用户开启后发送消息会把该消息文本作为当前 agent 的可跟踪目标。
- Agent 运行自然结束时自动把目标标记为 complete；运行错误或用户停止时自动标记为 blocked；重试时自动把 blocked 目标恢复为 active。
- 每一步 prompt 会附带当前目标上下文，模型可通过 `getGoal`、`createGoal`、`updateGoal` 三个工具查询、创建或更新目标状态。
- 聊天历史顶部新增目标状态卡片，展示目标、状态和阻塞原因。
- 同步 Karton 契约、i18n 文案和目标模式维护文档。

### Testing
- `pnpm -F @stagewise/agent-core build` 退出码 0。
- `pnpm -F @stagewise/agent-core test -- state-mutations` 退出码 0，27 个测试通过。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `git diff --check` 和 `pnpm exec biome check --formatter-enabled=false` 对本轮改动文件退出码 0；仅提示部分既有 CRLF/LF 提醒。

### Notes
改动文件清单：
- packages/agent-core/src/types/agent.ts：新增 AgentGoalState 和 AgentState.goal。回滚：`git checkout -- packages/agent-core/src/types/agent.ts`。
- packages/agent-core/src/agents/base-agent.ts：注入目标上下文，并新增 getGoal、createGoal、updateGoal 工具。回滚：`git checkout -- packages/agent-core/src/agents/base-agent.ts`。
- packages/agent-core/src/services/agent-manager/agent-manager.ts：发送消息支持 goalMode 参数，并在开启目标模式时创建当前目标。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/agent-manager.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts：新增目标创建、完成、阻塞、清空状态变更，并在停止工作时阻塞目标。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/bind.ts：把目标状态变更接入 bound mutation bundle。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/bind.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.ts：运行成功自动完成目标，运行错误自动阻塞目标，重试时自动恢复为 active。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts：补充目标创建 mutation 测试。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.test.ts：补充目标完成/阻塞/恢复生命周期测试。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.test.ts`。
- apps/browser/src/shared/karton-contracts/ui/index.ts：同步发送消息目标模式参数契约。回滚：`git checkout -- apps/browser/src/shared/karton-contracts/ui/index.ts`。
- apps/browser/src/shared/karton-contracts/ui/agent/index.ts：导出 AgentGoalState 给 UI 使用。回滚：`git checkout -- apps/browser/src/shared/karton-contracts/ui/agent/index.ts`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-input.tsx：在输入操作区新增目标模式切换按钮。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-input.tsx`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx：维护目标模式开关状态，并随发送消息传给后端。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx：新增目标状态卡片。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx`。
- apps/browser/src/ui/i18n/dict/chat.ts：新增目标模式中英文文案。回滚：`git checkout -- apps/browser/src/ui/i18n/dict/chat.ts`。
- docs/agent-goal-mode.md：新增目标模式行为和维护说明。回滚：删除该文件。
- progress.md：追加本轮目标模式实现记录。回滚：删除本条记录。
统一回滚点：`git checkout -- packages/agent-core/src/types/agent.ts packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/services/agent-manager/agent-manager.ts packages/agent-core/src/services/agent-manager/state-mutations/simple.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.ts packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.test.ts apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/shared/karton-contracts/ui/agent/index.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-input.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx apps/browser/src/ui/i18n/dict/chat.ts progress.md`，并删除 `docs/agent-goal-mode.md`。

## 2026-07-08 - Task: Clash 节点更换改为随机起选

### What was done
- 修复 Clash 节点重试每次都从候选池第 0 个节点开始的偏差：在 `selectClashProxyGroup` 构建完候选节点后做一次 Fisher-Yates 随机打乱，保留遍历全部候选的容错能力，同时让每轮起始节点随机。
- 同步更新 Clash 节点切换说明文档。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `git diff --check -- apps/browser/src/backend/agents/llm-network.ts docs/llm-network-proxy-clash.md` 退出码 0。
- `pnpm exec biome check apps/browser/src/backend/agents/llm-network.ts` 仅报文件既有格式问题（均不位于本轮新增的 shuffle 块），未作为通过项使用。

### Notes
改动文件清单：
- apps/browser/src/backend/agents/llm-network.ts：`selectClashProxyGroup` 返回前对 `nodeCandidates` 做 Fisher-Yates 随机打乱，节点重试不再固定从第 0 个开始。回滚：`git checkout -- apps/browser/src/backend/agents/llm-network.ts`。
- docs/llm-network-proxy-clash.md：补充候选节点随机打乱说明。回滚：`git checkout -- docs/llm-network-proxy-clash.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/agents/llm-network.ts docs/llm-network-proxy-clash.md progress.md`。

## 2026-07-08 - Task: 403 自动切换 Clash 节点开关可配置

### What was done
- 在用户偏好新增 `agent.clashAutoSwitchOnForbidden` 开关，默认开启，保留原有 403 自动切换节点行为。
- 开关关闭后，LLM 请求返回 403/Forbidden 时不再轮换 Clash 节点，直接返回原响应，只走帐号池切换逻辑。
- 在设置 -> 通用 -> 对话请求网络区域新增「403 自动切换节点」开关，保存到用户偏好并实时生效。
- 同步更新 Clash 节点切换说明文档。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `git diff --check -- apps/browser/src/shared/karton-contracts/ui/shared-types.ts apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/model-provider.ts apps/browser/src/ui/screens/settings/sections/general-settings-section.tsx apps/browser/src/ui/i18n/dict/settings.ts docs/llm-network-proxy-clash.md` 退出码 0。
- `pnpm exec biome check apps/browser/src/ui/i18n/dict/settings.ts` 通过；`general-settings-section.tsx` 仅报既有格式问题（powerSave、notifications 等区域），不位于本轮新增的 Switch 块。

### Notes
改动文件清单：
- apps/browser/src/shared/karton-contracts/ui/shared-types.ts：新增 `clashAutoSwitchOnForbidden` 偏好字段，默认 true。回滚：`git checkout -- apps/browser/src/shared/karton-contracts/ui/shared-types.ts`。
- apps/browser/src/backend/agents/llm-network.ts：`LlmNetworkSettings` 增加 `clashAutoSwitchOnForbidden`，`createLlmFetch` 在为 false 时直接返回 403 响应不轮换节点。回滚：`git checkout -- apps/browser/src/backend/agents/llm-network.ts`。
- apps/browser/src/backend/agents/model-provider.ts：把 `clashAutoSwitchOnForbidden` 传入 createLlmFetch。回滚：`git checkout -- apps/browser/src/backend/agents/model-provider.ts`。
- apps/browser/src/ui/screens/settings/sections/general-settings-section.tsx：LLM 网络设置区新增「403 自动切换节点」Switch。回滚：`git checkout -- apps/browser/src/ui/screens/settings/sections/general-settings-section.tsx`。
- apps/browser/src/ui/i18n/dict/settings.ts：新增开关中英文文案。回滚：`git checkout -- apps/browser/src/ui/i18n/dict/settings.ts`。
- docs/llm-network-proxy-clash.md：补充开关说明。回滚：`git checkout -- docs/llm-network-proxy-clash.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/shared/karton-contracts/ui/shared-types.ts apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/model-provider.ts apps/browser/src/ui/screens/settings/sections/general-settings-section.tsx apps/browser/src/ui/i18n/dict/settings.ts docs/llm-network-proxy-clash.md progress.md`。

## 2026-07-08 - Task: 403 关闭节点切换时也触发帐号池切换

### What was done
- 修复「403 自动切换节点」开关关闭后 403 不触发帐号池切换的问题：关闭时命中 403 不再直接返回原响应，改为返回带 `LLM_ACCOUNT_FORBIDDEN_MARKER` 的响应，复用现有 `LlmAccountForbiddenError` 组件触发 `observeCurrentAndSwitchPoolAccount`。
- 更新 `LlmAccountForbiddenError` 提示文案，覆盖节点轮换失败和节点切换关闭两种场景，不再硬编码「超过 10 个节点」。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `git diff --check -- apps/browser/src/backend/agents/llm-network.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx` 退出码 0。

### Notes
改动文件清单：
- apps/browser/src/backend/agents/llm-network.ts：开关关闭时命中 403 返回 `unavailableResponse(true)` 以触发帐号池切换，而非直接返回 firstResponse。回滚：`git checkout -- apps/browser/src/backend/agents/llm-network.ts`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx：更新 `LlmAccountForbiddenError` 提示文案，去掉「超过 10 个节点」硬编码描述。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/agents/llm-network.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx progress.md`。


## 2026-07-08 - Task: 帐号池统计卡片点击筛选帐号列表

### What was done
为帐号池概览区域的 7 个统计卡片（总数、可用、日限额、周限额、月限额、待观察、已封禁）增加点击筛选功能。点击任一卡片后，下方帐号列表只展示对应分类的帐号；再次点击同一卡片或点击清除按钮取消筛选。筛选状态下卡片高亮显示，并在卡片下方显示当前筛选类别名称与匹配数量。

### Testing
- `pnpm -F stagewise typecheck` 全部通过（preload/backend/ui/storybook 四个 tsconfig 均退出码 0）。
- `npx @biomejs/biome check` 对修改的两个文件检查通过，无错误。

### Notes
改动文件清单：
- apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx：新增 `OverviewFilter` 类型与 `matchesOverviewFilter` 函数；添加 `overviewFilter` state 与 `filteredPool` memo；统计卡片从 `div` 改为 `button`，加 onClick 切换筛选、选中高亮；卡片下方新增筛选状态条（显示类别名+数量+清除按钮）；空列表新增筛选无结果提示。
- apps/browser/src/ui/i18n/dict/settings.ts：新增 `overview.filterPrefix`、`overview.clearFilter`、`overview.filterEmpty` 三个 i18n 键（zh-CN / en）。
- progress.md：追加本轮记录。
回滚方式：`git checkout -- apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx apps/browser/src/ui/i18n/dict/settings.ts progress.md`。


## 2026-07-08 - Task: 帐号池待观察号调度与侧栏统计增强

### What was done
1. 侧栏左下角帐号统计条从「总数 | 可用」两列扩展为「总数 | 可用 | 待观察」三列，待观察数用 warning 色显示。
2. 后端 accountPoolStats 类型与 getAccountPoolStats 新增 observing 字段，实时反映待观察账号数量，切换帐号后自动刷新。
3. 可用账号池耗尽后，自动从待观察池中取出仍有额度的账号进行切换尝试。
4. 取到待观察账号时，即使用户关闭了「自动切换节点」开关，也强制走 Clash 节点切换逻辑，因为待观察号的 403 可能是节点 IP 问题而非账号问题。
5. 待观察号切节点后如果 LLM 请求成功（非 403），自动将该账号从待观察移回正常状态，后续可被当作可用账号使用。

### Testing
- `pnpm -F stagewise typecheck` 全部通过（preload/backend/ui/storybook 四个 tsconfig 均退出码 0）。
- `npx @biomejs/biome check` 对修改文件检查通过，无 error（仅 pre-existing infos）。
- `pnpm -F stagewise test -- --run llm-network` 11 个测试全部通过。

### Notes
改动文件清单：
- apps/browser/src/shared/karton-contracts/ui/index.ts：accountPoolStats 类型加 observing 字段，默认值同步更新。回滚：`git checkout -- apps/browser/src/shared/karton-contracts/ui/index.ts`。
- apps/browser/src/backend/services/auth/index.ts：getAccountPoolStats 返回 observing 计数；新增 observingPoolEmails 缓存与 syncPoolAvailabilityCaches 中的同步；新增 takeObservingPoolAccount 方法；switchToNextAvailablePoolAccount 在可用池空了后从待观察池取号并标记 fromObserving；新增 getCurrentEmail/isPoolEmailObserving/markObservingAccountNormal 方法；switchToAvailablePoolAccount/observeCurrentAndSwitchPoolAccount/autoSwitchOnQuotaExceeded 返回类型加 fromObserving。回滚：`git checkout -- apps/browser/src/backend/services/auth/index.ts`。
- apps/browser/src/backend/agents/llm-network.ts：LlmNetworkSettings 加 forceClashSwitchOnForbidden 和 onAccountSuccess 回调；forbidden 检查处加 forceSwitch 判断，待观察号即使关闭自动切节点也走切节点逻辑；所有成功响应路径调用 onAccountSuccess。回滚：`git checkout -- apps/browser/src/backend/agents/llm-network.ts`。
- apps/browser/src/backend/agents/model-provider.ts：createLlmFetch 传入 forceClashSwitchOnForbidden 和 onAccountSuccess 回调，通过 authService 同步检查当前账号是否 observing，成功时触发移回正常。回滚：`git checkout -- apps/browser/src/backend/agents/model-provider.ts`。
- apps/browser/src/ui/screens/main/_components/sidebar-auth-footer.tsx：统计条从两列扩展为三列，新增待观察数量显示。回滚：`git checkout -- apps/browser/src/ui/screens/main/_components/sidebar-auth-footer.tsx`。
- apps/browser/src/ui/i18n/dict/common.ts：新增 sidebarAuth.poolStats.observing 翻译键。回滚：`git checkout -- apps/browser/src/ui/i18n/dict/common.ts`。
- progress.md：追加本轮记录。
统一回滚点：`git checkout -- apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/backend/services/auth/index.ts apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/model-provider.ts apps/browser/src/ui/screens/main/_components/sidebar-auth-footer.tsx apps/browser/src/ui/i18n/dict/common.ts progress.md`。

## 2026-07-08 - Task: 订阅类 LLM provider error 触发帐号池切换

### What was done
- 修复 `LLM provider error: Stagewise subscription required...` 不触发帐号池自动切换的问题。
- 在 LLM 网络层新增响应分类，把 `Stagewise subscription required`、`subscription required`、`upgrade your plan`、`configure your own API keys`、`connect a coding plan` 这类账号套餐/权限错误识别为 `account-required`。
- `account-required` 响应会直接返回带 `LLM_ACCOUNT_FORBIDDEN_MARKER` 的 403 响应，复用现有 `LlmAccountForbiddenError` 自动把当前帐号移入待观察并切换帐号，不再把原始 provider error 直接展示到输入框。
- 如果节点切换重试过程中遇到 `account-required`，立即停止节点切换并转入帐号池切换，避免把套餐问题误当作节点问题继续轮换。

### Testing
- `pnpm -F stagewise test -- --run llm-network` 通过，`llm-network` 12 个测试全部通过。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `npx @biomejs/biome check --formatter-enabled=false apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts` 退出码 0。
- `git diff --check -- apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts` 退出码 0。

### Notes
改动文件清单：
- apps/browser/src/backend/agents/llm-network.ts：新增 `LlmFailureKind`、`isAccountRequiredBody`、`getLlmFailureKind`，把订阅/套餐类响应映射到帐号池切换 marker；节点切换重试阶段遇到账号套餐类响应时立即停止并触发帐号切换。回滚：`git checkout -- apps/browser/src/backend/agents/llm-network.ts`。
- apps/browser/src/backend/agents/llm-network.test.ts：新增订阅类响应触发 `LLM_ACCOUNT_FORBIDDEN` 的测试，并更新重试日志断言字段。回滚：`git checkout -- apps/browser/src/backend/agents/llm-network.test.ts`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts progress.md`。

## 2026-07-08 - Task: 订阅类 provider error 展示中文提示

### What was done
- 修复截图中的 `LLM provider error: Stagewise subscription required...` 在错误卡片里直接显示英文的问题。
- 在运行时错误展示层新增 provider 错误中文兜底映射：订阅/套餐类错误显示为「当前 Stagewise 帐号没有可用订阅或编程套餐，正在尝试自动切换其他帐号。」。
- 同步覆盖 `Missing or invalid session` / `invalid session` 的展示文案，显示为「当前帐号会话已失效，正在尝试自动切换其他帐号。」。
- 映射同时作用于通用错误卡片和帐号自动切换专用卡片，不改变后端自动切换帐号逻辑。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `npx @biomejs/biome check --formatter-enabled=false apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx` 退出码 0。
- `git diff --check -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx` 退出码 0。

### Notes
改动文件清单：
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx：新增 `localizeProviderErrorMessage`，将订阅/套餐类 provider error 和会话失效类 provider error 转为中文展示。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx progress.md`。

## 2026-07-08 - Task: Missing or invalid session 自动切换帐号

### What was done
- 修复 `LLM provider error: Missing or invalid session` 不触发帐号池自动切换的问题。
- 将 `Missing or invalid session` / `invalid session` 归入 LLM 网络层的 `account-required` 分类。
- 命中该错误时直接返回带 `LLM_ACCOUNT_FORBIDDEN_MARKER` 的 403 响应，复用现有 `LlmAccountForbiddenError` 自动把当前帐号移入待观察并切换帐号，不再把原始 provider error 直接展示到输入框。

### Testing
- `pnpm -F stagewise test -- --run llm-network` 通过，`llm-network` 13 个测试全部通过。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `npx @biomejs/biome check --formatter-enabled=false apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts` 退出码 0。
- `git diff --check -- apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts` 退出码 0。

### Notes
改动文件清单：
- apps/browser/src/backend/agents/llm-network.ts：`isAccountRequiredBody` 新增 `missing or invalid session` / `invalid session` 匹配，映射到帐号池切换 marker。回滚：`git checkout -- apps/browser/src/backend/agents/llm-network.ts`。
- apps/browser/src/backend/agents/llm-network.test.ts：新增 `Missing or invalid session` 触发 `LLM_ACCOUNT_FORBIDDEN` 的测试。回滚：`git checkout -- apps/browser/src/backend/agents/llm-network.test.ts`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/agents/llm-network.ts apps/browser/src/backend/agents/llm-network.test.ts progress.md`。

## 2026-07-11 - Task: 目标模式提示窗移动到输入框上方

### What was done
- 将目标模式状态提示窗从聊天历史顶部移到输入框容器上方，显示位置跟随底部对话框。
- 保留原有目标状态、目标内容和阻塞原因展示，不改目标模式开关、发送参数或后端状态逻辑。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `git diff --check` 退出码 0。

### Notes
改动文件清单：
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx：移除聊天历史顶部的目标状态卡渲染与相关状态订阅。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx：在输入框容器内渲染目标状态卡，并用输入框上方的绝对定位展示。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx progress.md`。

## 2026-07-11 - Task: 目标模式只保留初始目标

### What was done
- 修复目标模式开启后，后续用户输入会覆盖最初目标指令的问题。
- 目标状态写入改为只在当前 agent 没有目标时创建；一旦目标存在，后续开启目标模式发送的新消息也只作为补充指令进入对话，不替换原目标。
- 同步更新模型工具说明和目标模式维护文档，明确 `createGoal` 不再替换已有目标。

### Testing
- `pnpm -F @stagewise/agent-core test -- state-mutations` 通过，6 个测试文件、28 个测试全部通过。
- `pnpm -F @stagewise/agent-core build` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `git diff --check` 退出码 0。

### Notes
改动文件清单：
- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts：`startGoal` 在已有目标时直接保留原目标，不再覆盖。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts：新增重复创建目标时保留第一个目标的测试。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts`。
- packages/agent-core/src/agents/base-agent.ts：更新 `createGoal` 工具描述，说明后续用户消息只是补充，不应替换原目标。回滚：`git checkout -- packages/agent-core/src/agents/base-agent.ts`。
- docs/agent-goal-mode.md：同步目标模式行为文档，明确只用第一条开启目标模式的用户消息创建目标。回滚：`git checkout -- docs/agent-goal-mode.md`。
- progress.md：追加本轮记录并修正上一轮记录位置。回滚：删除本条记录，并按需恢复上一轮记录位置。
统一回滚点：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts packages/agent-core/src/agents/base-agent.ts docs/agent-goal-mode.md progress.md`。

## 2026-07-11 - Task: 目标模式避免 clean idle 提前终止

### What was done
- 修复目标模式偶发提前停住，需要用户重新发送对话才能继续的问题。
- 移除 clean idle 自动把 active goal 标记为 complete 的逻辑；目标只有在模型明确调用 `updateGoal(status: complete)` 后才完成。
- 保留真实错误和用户停止时将目标标记为 blocked 的行为，避免把普通 step 暂停误判成目标完成。
- 同步目标模式维护文档，明确 clean idle 不再自动完成目标。

### Testing
- `pnpm -F @stagewise/agent-core test -- state-mutations` 通过，6 个测试文件、28 个测试全部通过。
- `pnpm -F @stagewise/agent-core build` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `npx @biomejs/biome check --formatter-enabled=false packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.ts packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.test.ts packages/agent-core/src/services/agent-manager/state-mutations/simple.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts packages/agent-core/src/agents/base-agent.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx` 退出码 0。
- `git diff --check` 退出码 0。

### Notes
改动文件清单：
- packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.ts：移除 clean idle 自动 complete 目标的分支。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.test.ts：把 clean idle 测试预期改为目标保持 active。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.test.ts`。
- docs/agent-goal-mode.md：同步说明目标完成必须由 `updateGoal` 明确触发。回滚：`git checkout -- docs/agent-goal-mode.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.ts packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.test.ts docs/agent-goal-mode.md progress.md`。

## 2026-07-11 - Task: 目标模式 updateGoal 容错与重新打包

### What was done
- 修复目标模式里 `updateGoal` 参数校验失败导致的 `Error repairing tool call` 红色错误。
- 将 `updateGoal.status` schema 放宽为字符串，在执行阶段自行归一化；`complete/completed` 正常完成目标，`blocked/block` 正常阻塞目标。
- 对 `active/running/in_progress/continue` 这类“仍在执行”的状态做 no-op 返回，不再让 schema validation 打断任务。
- 重新构建 `@stagewise/agent-core`，重新执行 `stagewise package:fast`，并启动新的打包版本。

### Testing
- `pnpm -F @stagewise/agent-core test -- state-mutations` 通过，6 个测试文件、28 个测试全部通过。
- `pnpm -F @stagewise/agent-core build` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `npx @biomejs/biome check --formatter-enabled=false packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.ts packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.test.ts packages/agent-core/src/services/agent-manager/state-mutations/simple.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx` 退出码 0。
- `git diff --check` 退出码 0。
- `pnpm -F stagewise package:fast` 首次因旧 `stagewise-dev.exe` 占用输出目录失败；结束旧输出目录下的 `stagewise-dev.exe` 进程后重跑成功，产物为 `apps/browser/out/dev/stagewise-dev-win32-x64/stagewise-dev.exe`。

### Notes
改动文件清单：
- packages/agent-core/src/agents/base-agent.ts：放宽 `updateGoal` 输入 schema，并对执行中状态做 no-op 容错。回滚：`git checkout -- packages/agent-core/src/agents/base-agent.ts`。
- docs/agent-goal-mode.md：补充 `updateGoal` 进行中状态容错说明。回滚：`git checkout -- docs/agent-goal-mode.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- packages/agent-core/src/agents/base-agent.ts docs/agent-goal-mode.md progress.md`。

## 2026-07-11 - Task: 目标模式悬浮窗避让队列指令

### What was done
- 将目标模式悬浮窗保留在 chat footer 的独立浮层中，不放入 chat history，避免随流式输出重排抖动。
- 悬浮窗定位增加 `--status-card-height` 偏移；当用户继续发送新指令导致 footer 状态卡或队列指令区域增高时，目标悬浮窗会同步上移，不遮挡新指令。
- 未重新打包，按本轮要求只完成源码修改和验证。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `npx @biomejs/biome check --formatter-enabled=false apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx` 退出码 0。
- `git diff --check` 退出码 0。

### Notes
改动文件清单：
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx：移除本轮尝试加入 chat history 的目标卡逻辑，避免进入消息流。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx：恢复目标模式独立浮层，并让 bottom 偏移包含 `--status-card-height`。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx`。
- docs/agent-goal-mode.md：同步说明目标卡在 footer 中避让状态卡和队列指令。回滚：`git checkout -- docs/agent-goal-mode.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx docs/agent-goal-mode.md progress.md`。

## 2026-07-11 - Task: 目标模式悬浮窗增加编辑和删除

### What was done
- 在目标模式悬浮窗右侧增加编辑和删除入口；编辑会在卡片内切换为目标文本输入，保存后只更新当前目标内容。
- 新增目标删除链路：当目标仍为 active 时先停止当前 agent，再清除目标，避免隐藏状态下继续执行；已完成或阻塞的目标直接清除。
- 补齐 agent-core 状态 mutation、Karton RPC contract、browser 后端转发和 UI i18n 文案。
- 同步目标模式维护文档；本轮未重新打包。

### Testing
- `pnpm -F @stagewise/agent-core test -- state-mutations` 通过，6 个测试文件、29 个测试全部通过。
- `pnpm -F @stagewise/agent-core build` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `npx @biomejs/biome check --formatter-enabled=false packages/agent-core/src/services/agent-manager/state-mutations/simple.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts packages/agent-core/src/services/agent-manager/agent-manager.ts apps/browser/src/backend/services/agent-manager/agent-manager.ts apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx apps/browser/src/ui/i18n/dict/chat.ts docs/agent-goal-mode.md` 退出码 0。
- `git diff --check` 退出码 0。

### Notes
改动文件清单：
- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts：新增目标内容更新 mutation。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/bind.ts：把目标内容更新 mutation 暴露到绑定 bundle。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/bind.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts：新增目标内容编辑不会替换目标实体的测试。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts`。
- packages/agent-core/src/services/agent-manager/agent-manager.ts：新增 `updateGoalObjective` 和 `deleteGoal` RPC 处理，删除 active 目标前先停止 agent。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/agent-manager.ts`。
- apps/browser/src/backend/services/agent-manager/agent-manager.ts：补充目标编辑和删除 RPC 的 Karton 转发。回滚：`git checkout -- apps/browser/src/backend/services/agent-manager/agent-manager.ts`。
- apps/browser/src/shared/karton-contracts/ui/index.ts：补充目标编辑和删除的 server procedure 类型。回滚：`git checkout -- apps/browser/src/shared/karton-contracts/ui/index.ts`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx：在目标悬浮窗右侧加入编辑、删除、保存和取消图标按钮，并接入新 RPC。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx`。
- apps/browser/src/ui/i18n/dict/chat.ts：新增目标编辑、删除、保存、取消文案。回滚：`git checkout -- apps/browser/src/ui/i18n/dict/chat.ts`。
- docs/agent-goal-mode.md：同步说明目标卡编辑与删除行为。回滚：`git checkout -- docs/agent-goal-mode.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts packages/agent-core/src/services/agent-manager/agent-manager.ts apps/browser/src/backend/services/agent-manager/agent-manager.ts apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx apps/browser/src/ui/i18n/dict/chat.ts docs/agent-goal-mode.md progress.md`。

## 2026-07-11 - Task: 修复 executeShellCommand repair 校验红错

### What was done
- 修复 `executeShellCommand` 在模型 repair 阶段因同时携带 `stdin` 和 `command` 被 schema 拒绝，导致界面连续出现 `Error repairing tool call` 的问题。
- 将 action-mode 互斥冲突从 schema 校验移到运行时处理，让工具可以返回可读修正提示，而不是在 schema repair 阶段直接失败。
- 对 `stdin` 与非空 `command` 同传的情况增加运行时保护：不向 PTY 写入任何内容，不执行 command，并提示模型拆成两次调用。
- 增加回归测试，覆盖 `command + stdin` 能通过 schema、但运行时不会发送 shell 输入。

### Testing
- `pnpm -F @stagewise/agent-shell test -- execute-shell-command` 通过，1 个测试文件、3 个测试全部通过。
- `pnpm -F @stagewise/agent-shell typecheck` 退出码 0。
- `pnpm -F @stagewise/agent-shell build` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `npx @biomejs/biome check --formatter-enabled=false packages/agent-shell/src/schemas/index.ts packages/agent-shell/src/tools/execute-shell-command.ts packages/agent-shell/src/tools/execute-shell-command.test.ts` 退出码 0。
- `git diff --check` 退出码 0；Git 仅提示 3 个 agent-shell 文件 CRLF/LF 工作区换行提醒。
- `pnpm -F stagewise package:fast` 首次因 Windows 本地文件占用导致 `.vite/build/web-content-preload` 删除失败；重新执行后退出码 0，成功完成 Vite main/preload、renderer、x64 win32 package 和 postPackage hook，`apps/browser/out/dev/stagewise-dev-win32-x64` 更新时间为 2026-07-13 22:39:58。

### Notes
改动文件清单：
- packages/agent-shell/src/schemas/index.ts：移除 `command`、`stdin`、`kill` action-mode 互斥 schema 校验，避免 repair 阶段红错。回滚：`git checkout -- packages/agent-shell/src/schemas/index.ts`。
- packages/agent-shell/src/tools/execute-shell-command.ts：增加运行时冲突保护，非空 `command + stdin` 同传时不发送任何 shell 输入并返回修正提示。回滚：`git checkout -- packages/agent-shell/src/tools/execute-shell-command.ts`。
- packages/agent-shell/src/tools/execute-shell-command.test.ts：新增 schema 与 runtime 回归测试。回滚：`git checkout -- packages/agent-shell/src/tools/execute-shell-command.test.ts`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- packages/agent-shell/src/schemas/index.ts packages/agent-shell/src/tools/execute-shell-command.ts packages/agent-shell/src/tools/execute-shell-command.test.ts progress.md`。

## 2026-07-13 - Task: 修复目标模式 shell 工具空 stdin 重试循环

### What was done
- 修复目标模式下 shell 工具把普通命令附带的空 `stdin` 误判为 `command + stdin` 冲突的问题，避免模型持续收到可重试的 abort 提示后反复调用同一测试命令。
- 保留非空 `stdin` 与非空 `command` 同传时的安全阻断：不会向 PTY 写入输入，也不会执行 command，并继续提示模型拆成两次调用。
- 增加回归测试，覆盖空 `stdin` 会按普通 command 执行，且不会走 `rawInput` shell 输入路径。

### Testing
- `pnpm -F @stagewise/agent-shell test -- execute-shell-command` 通过，1 个测试文件、4 个测试全部通过。
- `pnpm -F @stagewise/agent-shell typecheck` 退出码 0。
- `pnpm -F @stagewise/agent-shell build` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `npx @biomejs/biome check --formatter-enabled=false packages/agent-shell/src/tools/execute-shell-command.ts packages/agent-shell/src/tools/execute-shell-command.test.ts` 退出码 0。
- `git diff --check` 退出码 0；Git 仅提示 3 个 agent-shell 文件 CRLF/LF 工作区换行提醒。

### Notes
改动文件清单：
- packages/agent-shell/src/tools/execute-shell-command.ts：将空 `stdin` 视为未传，只在 `stdin` 非空时进入 shell 输入模式和互斥校验。回滚：`git checkout -- packages/agent-shell/src/tools/execute-shell-command.ts`。
- packages/agent-shell/src/tools/execute-shell-command.test.ts：新增空 `stdin` 的命令执行回归测试，并保留非空 `command + stdin` 不发送输入的保护测试。回滚：`git checkout -- packages/agent-shell/src/tools/execute-shell-command.test.ts`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- packages/agent-shell/src/tools/execute-shell-command.ts packages/agent-shell/src/tools/execute-shell-command.test.ts progress.md`。

## 2026-07-13 - Task: 目标模式增加暂停继续并收敛循环隐患

### What was done
- 给目标模式增加 `paused` 状态，并补齐暂停、继续的状态 mutation、AgentManager RPC、Karton contract、browser 后端转发和 UI 控制。
- 在目标模式卡片右侧增加暂停和继续图标；暂停会先停止当前 agent 再把目标落到 `paused`，继续会恢复为 `active` 并发送一条补充消息启动原目标。
- 收敛目标模式工具调用循环隐患：`createGoal` 不再替换已有目标，`updateGoal` 对仍在执行类状态做 no-op，clean idle 不再自动完成目标。
- 收敛 shell 工具 repair 循环隐患：schema 不再在 repair 阶段拒绝 `command/stdin/kill` 互斥冲突，运行时处理真实冲突，空 `stdin` 按未传处理。
- 同步目标模式维护文档和 chat i18n 文案。

### Testing
- `pnpm -F @stagewise/agent-core test -- state-mutations` 通过，6 个测试文件、31 个测试全部通过。
- `pnpm -F @stagewise/agent-shell test -- execute-shell-command` 通过，1 个测试文件、4 个测试全部通过。
- `pnpm -F @stagewise/agent-shell typecheck` 退出码 0。
- `pnpm -F @stagewise/agent-core build` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm -F @stagewise/agent-shell build` 首次与 `@stagewise/agent-core build` 并行执行时失败，原因是 core build 清理 `dist` 导致 shell build 读取 core 子路径声明竞态；串行重跑后退出码 0。
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/backend/services/agent-manager/agent-manager.ts apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/ui/i18n/dict/chat.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx docs/agent-goal-mode.md packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/services/agent-manager/agent-manager.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.ts packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.test.ts packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.ts packages/agent-core/src/services/agent-manager/state-mutations/simple.ts packages/agent-core/src/types/agent.ts packages/agent-shell/src/schemas/index.ts packages/agent-shell/src/tools/execute-shell-command.test.ts packages/agent-shell/src/tools/execute-shell-command.ts` 退出码 0，检查 15 个文件通过。
- `pnpm exec biome check <target files>` 未采用自动修复；未关闭 formatter 时会要求对已改文件做全文件格式化，为避免扩大无关格式化，本轮只执行 formatter disabled 的语法和 lint 检查。
- `git diff --check` 退出码 0；Git 仅提示 3 个 agent-shell 文件 CRLF/LF 工作区换行提醒。

### Notes
改动文件清单：
- apps/browser/src/backend/services/agent-manager/agent-manager.ts：补充暂停和继续目标的 Karton RPC 转发。回滚：`git checkout -- apps/browser/src/backend/services/agent-manager/agent-manager.ts`。
- apps/browser/src/shared/karton-contracts/ui/index.ts：补充暂停和继续目标的 server procedure 类型。回滚：`git checkout -- apps/browser/src/shared/karton-contracts/ui/index.ts`。
- apps/browser/src/ui/i18n/dict/chat.ts：新增目标暂停、继续和相关操作文案。回滚：`git checkout -- apps/browser/src/ui/i18n/dict/chat.ts`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx：配合目标状态卡从聊天历史中移出，避免目标卡随消息流重复参与渲染。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx：在目标卡中接入暂停和继续图标按钮，继续时发送补充消息启动原目标。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx`。
- docs/agent-goal-mode.md：同步目标暂停、继续、clean idle 和工具容错行为说明。回滚：`git checkout -- docs/agent-goal-mode.md`。
- packages/agent-core/src/agents/base-agent.ts：收敛目标工具说明和 `updateGoal` 状态容错，避免进行中状态触发 repair 循环。回滚：`git checkout -- packages/agent-core/src/agents/base-agent.ts`。
- packages/agent-core/src/services/agent-manager/agent-manager.ts：新增暂停和继续目标 RPC，并在暂停 active 目标时先停止 agent。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/agent-manager.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts：新增目标暂停、继续和重复创建目标的回归测试。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/bind.ts：把暂停和继续目标 mutation 暴露到绑定 bundle。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/bind.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.test.ts：补充 paused 目标重新开始 step 会恢复 active，以及 clean idle 不自动完成目标的测试。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.test.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.ts：step 开始时恢复 paused/blocked 目标，clean idle 不再自动 complete。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts：新增暂停和继续目标 mutation，并让目标完成/阻塞清理 `pausedAt`。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts`。
- packages/agent-core/src/types/agent.ts：目标状态类型新增 `paused` 和 `pausedAt`。回滚：`git checkout -- packages/agent-core/src/types/agent.ts`。
- packages/agent-shell/src/schemas/index.ts：移除 repair 阶段的 action-mode 互斥 schema 校验。回滚：`git checkout -- packages/agent-shell/src/schemas/index.ts`。
- packages/agent-shell/src/tools/execute-shell-command.test.ts：新增 shell 工具互斥和空 `stdin` 回归测试。回滚：`git checkout -- packages/agent-shell/src/tools/execute-shell-command.test.ts`。
- packages/agent-shell/src/tools/execute-shell-command.ts：将空 `stdin` 视为未传，并把非空 `command + stdin` 冲突留到运行时安全阻断。回滚：`git checkout -- packages/agent-shell/src/tools/execute-shell-command.ts`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/services/agent-manager/agent-manager.ts apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/ui/i18n/dict/chat.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx docs/agent-goal-mode.md packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/services/agent-manager/agent-manager.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.ts packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.test.ts packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.ts packages/agent-core/src/services/agent-manager/state-mutations/simple.ts packages/agent-core/src/types/agent.ts packages/agent-shell/src/schemas/index.ts packages/agent-shell/src/tools/execute-shell-command.test.ts packages/agent-shell/src/tools/execute-shell-command.ts progress.md`。

## 2026-07-13 - Task: 补强目标暂停停止顺序回归测试

### What was done
- 补充目标暂停的边界回归测试：覆盖通用停止路径先把 active 目标标记为 blocked 后，暂停操作仍会最终落到 paused，并清理阻塞原因。
- 未改运行时业务逻辑，只锁定暂停按钮当前依赖的状态顺序，防止后续重构重新引入暂停后显示阻塞的隐患。

### Testing
- `pnpm -F @stagewise/agent-core test -- state-mutations` 通过，6 个测试文件、32 个测试全部通过。
- `pnpm exec biome check --formatter-enabled=false packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts` 退出码 0。
- `git diff --check` 退出码 0；Git 仅提示 3 个 agent-shell 文件 CRLF/LF 工作区换行提醒。

### Notes
改动文件清单：
- packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts：新增停止路径后再暂停目标的回归测试。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts progress.md`。

## 2026-07-13 - Task: 目标模式修复交付验证补齐

### What was done
- 补跑目标模式暂停继续和工具循环修复的可靠验证，覆盖 agent-core 状态测试、agent-shell 工具测试、browser backend/UI typecheck、Biome 和 diff 检查。
- 尝试执行 `pnpm -F stagewise package:fast` 验证 Electron 产物；运行过程中 Codex 工具层重复触发长命令，造成多棵 Electron Forge 打包进程并发写同一输出目录，已清理本仓库相关残留打包进程。
- 确认 dev 产物 `apps/browser/out/dev/stagewise-dev-win32-x64/stagewise-dev.exe` 已更新到 2026/7/13 23:03:50，但本轮不能把 `package:fast` 作为可靠通过证据，因为未获得单实例完整退出输出。

### Testing
- `pnpm -F @stagewise/agent-core test -- state-mutations` 通过，6 个测试文件、32 个测试全部通过。
- `pnpm -F @stagewise/agent-shell test -- execute-shell-command` 通过，1 个测试文件、4 个测试全部通过。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/backend/services/agent-manager/agent-manager.ts apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/ui/i18n/dict/chat.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx docs/agent-goal-mode.md packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/services/agent-manager/agent-manager.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.ts packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.test.ts packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.ts packages/agent-core/src/services/agent-manager/state-mutations/simple.ts packages/agent-core/src/types/agent.ts packages/agent-shell/src/schemas/index.ts packages/agent-shell/src/tools/execute-shell-command.test.ts packages/agent-shell/src/tools/execute-shell-command.ts` 退出码 0，检查 16 个文件通过。
- `git diff --check` 退出码 0；Git 仅提示 3 个 agent-shell 文件 CRLF/LF 工作区换行提醒。
- `Get-Item apps/browser/out/dev/stagewise-dev-win32-x64/stagewise-dev.exe` 显示产物大小 214031872 字节，更新时间 2026/7/13 23:03:50。
- `pnpm -F stagewise package:fast` 未作为通过项记录：命令在 Codex 工具层被重复触发，后续用互斥包装能阻止第二个实例，但残留 Electron Forge 子进程导致本轮未拿到单实例完整退出输出。

### Notes
改动文件清单：
- progress.md：追加本轮验证记录和 `package:fast` 验证限制说明。回滚：删除本条记录。
统一回滚点：删除本条 `progress.md` 记录。

## 2026-07-14 - Task: 模型对话静默卡住可恢复诊断

### What was done
- 给 agent-core 单步执行增加活动 watchdog，流式消息、finish、error、abort 和 UI stream 合并都会刷新活动时间，避免“无输出但一直 working”长期静默。
- 普通对话超过 watchdog 阈值仍无进展时，会清理当前卡住的 step 并写入可见 runtime error，便于用户和日志定位。
- 目标模式 active goal 超过 watchdog 阈值仍无进展时，不把目标标记为 blocked；运行时会清理卡住的 step，注入不可见 goal continuation，并自动进入下一轮。
- 新增保留目标状态的 working 清理 mutation，避免复用通用 stop 分支导致 active goal 被误标 blocked。
- 更新目标模式文档，明确 watchdog 在普通对话和 active goal 下的不同语义。

### Testing
- `pnpm -F @stagewise/agent-core test -- goal-continuation state-mutations` 通过，7 个测试文件、41 个测试全部通过。
- `pnpm -F @stagewise/agent-core build` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/agents/chat/goal-continuation.test.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.ts packages/agent-core/src/services/agent-manager/state-mutations/simple.ts docs/agent-goal-mode.md` 通过。
- `git diff --check` 退出码 0；Git 仅提示若干已有 CRLF/LF 工作区换行提醒。

### Notes
改动文件清单：
- packages/agent-core/src/agents/base-agent.ts：增加单步活动 watchdog，并在 active goal 卡住时自动续跑而非阻塞目标。回滚：`git checkout -- packages/agent-core/src/agents/base-agent.ts`。
- packages/agent-core/src/agents/chat/goal-continuation.test.ts：补充普通对话静默卡住转可见错误、active goal 静默卡住自动恢复的测试。回滚：`git checkout -- packages/agent-core/src/agents/chat/goal-continuation.test.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts：新增保留目标状态的 working 清理 mutation。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/bind.ts：暴露保留目标状态的 working 清理 mutation。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/bind.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts：补充 active goal 清理 working 状态不阻塞目标的测试。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts`。
- docs/agent-goal-mode.md：同步目标模式 watchdog 自动恢复语义。回滚：`git checkout -- docs/agent-goal-mode.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/agents/chat/goal-continuation.test.ts packages/agent-core/src/services/agent-manager/state-mutations/simple.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts docs/agent-goal-mode.md progress.md`。

## 2026-07-14 - Task: 上下文超窗压缩恢复

### What was done
- 复核现有历史压缩逻辑，确认项目已有 post-step 异步压缩，但缺少发请求前的同步超窗兜底，导致 provider 仍可能返回 `context_too_large`。
- 在 agent-core 单步执行中增加请求前上下文估算：最终 model messages 接近当前模型 context window 时，先同步压缩历史并重建上下文，再发起 LLM 请求。
- 增加 `context_too_large` provider 错误恢复：如果 provider 仍返回上下文超窗错误，运行时会压缩历史并自动重试当前 step 一次；压缩无效时才把原始错误展示给用户。
- 让 preflight 和 context-error 恢复等待正在进行的后台压缩，避免后台压缩未结束时继续发送 oversized 请求。
- 目标模式和普通对话共用同一套上下文压缩逻辑；active goal 超窗恢复时会保留目标状态，并在需要时恢复不可见 goal continuation。
- 新增 `docs/agent-context-compression.md`，并在目标模式文档中补充共享上下文压缩语义。

### Testing
- `pnpm -F @stagewise/agent-core test -- goal-continuation state-mutations` 通过，7 个测试文件、41 个测试全部通过。
- `pnpm -F @stagewise/agent-core build` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/agents/chat/goal-continuation.test.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.ts packages/agent-core/src/services/agent-manager/state-mutations/simple.ts docs/agent-goal-mode.md docs/agent-context-compression.md` 通过。
- `git diff --check` 退出码 0；Git 仅提示若干已有 CRLF/LF 工作区换行提醒。

### Notes
改动文件清单：
- packages/agent-core/src/agents/base-agent.ts：增加请求前上下文估算压缩、context-too-large 压缩重试、并发压缩等待和目标模式续跑保留。回滚：`git checkout -- packages/agent-core/src/agents/base-agent.ts`。
- docs/agent-context-compression.md：新增 agent 上下文压缩与超窗恢复维护说明。回滚：`git clean -f docs/agent-context-compression.md`。
- docs/agent-goal-mode.md：补充目标模式共享上下文压缩和超窗恢复语义。回滚：`git checkout -- docs/agent-goal-mode.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- packages/agent-core/src/agents/base-agent.ts docs/agent-goal-mode.md progress.md && git clean -f docs/agent-context-compression.md`。

## 2026-07-14 - Task: 恢复目标编辑删除按钮

### What was done
- 恢复目标状态卡右侧的编辑和删除图标，并保留已有暂停、继续按钮。
- 编辑目标改为卡片内原位输入，保存后更新当前目标 objective；空目标不会保存。
- 删除目标重新接入后端状态变更链路，避免只做前端隐藏。
- 补齐 Karton procedure、browser 后端转发、agent-core manager 方法、状态 mutation 测试和中英文文案。
- 更新目标模式文档，明确目标卡右侧包含编辑、删除、暂停/继续控制。

### Testing
- `pnpm -F @stagewise/agent-core test -- state-mutations` 通过，6 个测试文件、32 个测试全部通过。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/backend/services/agent-manager/agent-manager.ts apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/ui/i18n/dict/chat.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx docs/agent-goal-mode.md packages/agent-core/src/services/agent-manager/agent-manager.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.ts packages/agent-core/src/services/agent-manager/state-mutations/simple.ts` 退出码 0，检查 8 个文件通过。
- `git diff --check` 退出码 0；Git 仅提示 3 个已有 agent-shell 文件 CRLF/LF 工作区换行提醒。

### Notes
改动文件清单：
- apps/browser/src/backend/services/agent-manager/agent-manager.ts：恢复目标编辑和删除 RPC 的 browser 转发注册。回滚：`git checkout -- apps/browser/src/backend/services/agent-manager/agent-manager.ts`。
- apps/browser/src/shared/karton-contracts/ui/index.ts：恢复目标编辑和删除 server procedure 类型。回滚：`git checkout -- apps/browser/src/shared/karton-contracts/ui/index.ts`。
- apps/browser/src/ui/i18n/dict/chat.ts：补回目标编辑、删除、保存、取消文案。回滚：`git checkout -- apps/browser/src/ui/i18n/dict/chat.ts`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx：恢复目标卡右侧编辑、删除图标和原位编辑 UI，并接入真实目标更新/删除调用。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx`。
- docs/agent-goal-mode.md：同步目标卡编辑、删除、暂停/继续控制说明。回滚：`git checkout -- docs/agent-goal-mode.md`。
- packages/agent-core/src/services/agent-manager/agent-manager.ts：恢复目标 objective 更新和目标删除方法及 RPC 注册。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/agent-manager.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts：补充目标更新和删除状态 mutation 回归测试。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/bind.ts：将目标更新和删除 mutation 暴露到绑定 bundle。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/bind.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts：恢复目标 objective 更新和目标删除 mutation。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts`。
- progress.md：追加本轮恢复记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/services/agent-manager/agent-manager.ts apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/ui/i18n/dict/chat.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx docs/agent-goal-mode.md packages/agent-core/src/services/agent-manager/agent-manager.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.ts packages/agent-core/src/services/agent-manager/state-mutations/simple.ts progress.md`。

## 2026-07-13 - Task: 目标模式循环修复最终校准

### What was done
- 复核目标模式循环修复的最终范围：保留暂停、继续状态和 UI 图标，确认未残留编辑目标或删除目标的超范围入口。
- 重新验证目标模式状态机、shell 工具参数容错、browser 后端/UI 类型声明消费和触及文件 lint。
- 清理本轮遗留的未跟踪 `tmp-package-fast.*` 临时文件。

### Testing
- `pnpm -F @stagewise/agent-core test -- state-mutations` 通过，6 个测试文件、31 个测试全部通过。
- `pnpm -F @stagewise/agent-shell test -- execute-shell-command` 通过，1 个测试文件、4 个测试全部通过。
- `pnpm -F @stagewise/agent-core build` 过程中出现一次 `dist` 删除 `EPERM` 输出；随后确认 `packages/agent-core/dist/index.d.ts` 已更新，且 browser 后续类型检查通过，说明共享声明产物可用。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/backend/services/agent-manager/agent-manager.ts apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/ui/i18n/dict/chat.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx docs/agent-goal-mode.md packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/services/agent-manager/agent-manager.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.ts packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.test.ts packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.ts packages/agent-core/src/services/agent-manager/state-mutations/simple.ts packages/agent-core/src/types/agent.ts packages/agent-shell/src/schemas/index.ts packages/agent-shell/src/tools/execute-shell-command.test.ts packages/agent-shell/src/tools/execute-shell-command.ts` 退出码 0，检查 16 个文件通过。
- `git diff --check` 退出码 0；Git 仅提示 3 个 agent-shell 文件 CRLF/LF 工作区换行提醒。
- `rg -n "updateGoalObjective|deleteGoal|chat\\.goalStatus\\.(edit|delete|save|cancel|editAria)|CheckIcon|PencilIcon|Trash2Icon|XIcon|onUpdateObjective|onDelete" ...` 只命中无关的 `diff-history/schema.ts` 数据库 cascade 字段。
- `git status --short` 确认未跟踪 `tmp-package-fast.*` 已清理，只剩本轮源码、文档和 `progress.md` 改动。

### Notes
改动文件清单：
- progress.md：追加最终校准验证记录。回滚：删除本条记录。
统一回滚点：删除本条 `progress.md` 记录。

## 2026-07-14 - Task: 补齐目标模式自动续跑

### What was done
- 将目标模式的 `active` 状态从展示状态补齐为运行时状态：模型正常停止输出但目标仍未完成时，agent-core 会注入不可见续跑指令并自动开启下一轮。
- 续跑只在 clean idle 且目标仍为 `active` 时触发；遇到暂停、完成、阻塞、运行错误或等待用户队列消息时不会自动续跑。
- 调整目标工具语义：`createGoal` 不再鼓励替换现有目标，`updateGoal` 只用于真正完成或阻塞；模型误传 active/running/continue 类状态时作为继续执行处理，避免再次进入工具参数校验循环。
- 补充目标续跑回归测试和目标模式维护文档，说明 active 不是终态，运行时会持续推进到 complete、blocked、暂停、删除、停止或错误。

### Testing
- `pnpm -F @stagewise/agent-core test -- goal-continuation` 通过，1 个测试文件、4 个测试全部通过。
- `pnpm -F @stagewise/agent-core test -- state-mutations` 通过，6 个测试文件、32 个测试全部通过。
- `pnpm -F @stagewise/agent-core build` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/agents/chat/goal-continuation.test.ts docs/agent-goal-mode.md` 退出码 0，检查 2 个文件通过。
- `git diff --check` 退出码 0；Git 仅提示 3 个已有 agent-shell 文件 CRLF/LF 工作区换行提醒。

### Notes
改动文件清单：
- packages/agent-core/src/agents/base-agent.ts：在 clean idle 尾部加入 active goal 自动续跑，并更新目标上下文和目标工具语义。回滚：`git checkout -- packages/agent-core/src/agents/base-agent.ts`。
- packages/agent-core/src/agents/chat/goal-continuation.test.ts：新增目标续跑、防误触发和不可见续跑消息的回归测试。回滚：`git clean -f packages/agent-core/src/agents/chat/goal-continuation.test.ts`。
- docs/agent-goal-mode.md：同步目标模式自动续跑、暂停/继续、编辑/删除和终态规则。回滚：`git checkout -- docs/agent-goal-mode.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- packages/agent-core/src/agents/base-agent.ts docs/agent-goal-mode.md progress.md && git clean -f packages/agent-core/src/agents/chat/goal-continuation.test.ts`。

## 2026-07-14 - Task: 目标模式无人值守推进

### What was done
- 补齐目标模式无人值守语义：active goal 在模型正常停止但目标未完成时自动注入不可见续跑指令并开启下一轮，不再等待用户继续。
- 目标模式下禁止交互卡死：browser chat active goal 不暴露 `askUserQuestions`，host 侧兜底也返回无人值守提示而不是弹出待答问题。
- 目标模式下 shell 审批自动放行，暂停或结束目标后恢复用户原本审批设置。
- 修复续跑隐患：目标 token budget 达到后标记为 blocked 并停止自动续跑，paused goal 不会被普通 beginStep 隐式恢复。
- 保留并接入目标卡右侧编辑、删除、暂停、继续图标；目标卡位于输入框上方，避免遮挡聊天历史。
- 修复 shell 工具参数循环隐患：schema 不再提前拒绝 command+stdin，运行时对空 stdin 视为未传，对非空 command+stdin 返回可修复提示。
- 更新目标模式维护文档，明确 active 不是终态、无人值守、自动续跑、预算停止、交互禁用和 UI 控制规则。

### Testing
- `pnpm -F @stagewise/agent-core test -- goal-continuation state-mutations` 通过，7 个测试文件、37 个测试全部通过。
- `pnpm -F stagewise test -- chat.test.ts tool-approval-mode.test.ts` 通过，2 个测试文件、7 个测试全部通过。
- `pnpm -F @stagewise/agent-shell test -- execute-shell-command.test.ts` 通过，1 个测试文件、4 个测试全部通过。
- `pnpm -F @stagewise/agent-core build` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false ...` 对本轮触及的 agent-core、browser、agent-shell、docs 文件检查通过。
- `git diff --check` 退出码 0；Git 仅提示若干已有 CRLF/LF 工作区换行提醒。
- `pnpm -F @stagewise/agent-shell build` 未通过；失败集中在 `@stagewise/agent-core/env`、`@stagewise/agent-core/toolbox`、`@stagewise/agent-core/types/tool-approval` 子路径声明解析，属于包导出/声明消费链路问题，非本轮 shell 参数容错逻辑的测试失败。

### Notes
改动文件清单：
- apps/browser/src/backend/agents/chat/chat.ts：active goal 时不向模型暴露 `askUserQuestions` 工具。回滚：`git checkout -- apps/browser/src/backend/agents/chat/chat.ts`。
- apps/browser/src/backend/agents/chat/chat.test.ts：补充目标模式隐藏用户交互工具的回归测试。回滚：`git checkout -- apps/browser/src/backend/agents/chat/chat.test.ts`。
- apps/browser/src/backend/services/agent-manager/agent-manager.ts：注册目标暂停、继续、编辑、删除 RPC 转发。回滚：`git checkout -- apps/browser/src/backend/services/agent-manager/agent-manager.ts`。
- apps/browser/src/backend/services/toolbox/index.ts：按目标状态解析工具审批模式。回滚：`git checkout -- apps/browser/src/backend/services/toolbox/index.ts`。
- apps/browser/src/backend/services/toolbox/tool-approval-mode.ts：新增 active goal 强制 shell 自动审批的解析函数。回滚：`git clean -f apps/browser/src/backend/services/toolbox/tool-approval-mode.ts`。
- apps/browser/src/backend/services/toolbox/tool-approval-mode.test.ts：补充审批模式在 active/paused goal 下的回归测试。回滚：`git clean -f apps/browser/src/backend/services/toolbox/tool-approval-mode.test.ts`。
- apps/browser/src/backend/services/toolbox/tools/user-interaction/ask-user-questions.ts：active goal 下兜底返回无人值守提示，不创建待用户回答弹窗。回滚：`git checkout -- apps/browser/src/backend/services/toolbox/tools/user-interaction/ask-user-questions.ts`。
- apps/browser/src/shared/karton-contracts/ui/index.ts：补齐目标控制 procedure 类型。回滚：`git checkout -- apps/browser/src/shared/karton-contracts/ui/index.ts`。
- apps/browser/src/ui/i18n/dict/chat.ts：补齐目标 paused、暂停、继续、编辑、删除、保存、取消文案。回滚：`git checkout -- apps/browser/src/ui/i18n/dict/chat.ts`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx：移除历史顶部目标卡，避免遮挡聊天内容并交给 footer 展示。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx：在输入框上方展示目标卡，并接入编辑、删除、暂停、继续逻辑。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx`。
- docs/agent-goal-mode.md：同步目标模式完整运行规则和维护说明。回滚：`git checkout -- docs/agent-goal-mode.md`。
- packages/agent-core/src/agents/base-agent.ts：实现 active goal clean idle 自动续跑、预算停止、无人值守提示和目标工具语义收紧。回滚：`git checkout -- packages/agent-core/src/agents/base-agent.ts`。
- packages/agent-core/src/agents/chat/goal-continuation.test.ts：新增目标自动续跑、防误触发、预算停止和不可见续跑消息测试。回滚：`git clean -f packages/agent-core/src/agents/chat/goal-continuation.test.ts`。
- packages/agent-core/src/services/agent-manager/agent-manager.ts：新增目标暂停、继续、编辑、删除 manager 方法和 RPC 注册。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/agent-manager.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts：补充目标暂停、继续、编辑、删除 mutation 测试。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/bind.ts：暴露目标控制 mutation 到绑定 bundle。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/bind.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.ts：clean idle 不再自动 complete goal，普通 beginStep 不再隐式恢复 paused goal。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.test.ts：补充 clean idle 保持 active、paused 不被隐式恢复的测试。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.test.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts：新增目标暂停、继续、编辑、删除 mutation。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts`。
- packages/agent-core/src/types/agent.ts：新增 `paused` 目标状态和 `pausedAt` 字段。回滚：`git checkout -- packages/agent-core/src/types/agent.ts`。
- packages/agent-shell/src/schemas/index.ts：把 command/stdin 冲突从 schema 校验下沉到运行时提示。回滚：`git checkout -- packages/agent-shell/src/schemas/index.ts`。
- packages/agent-shell/src/tools/execute-shell-command.ts：空 stdin 不再阻断 command，非空 command+stdin 返回可修复提示。回滚：`git checkout -- packages/agent-shell/src/tools/execute-shell-command.ts`。
- packages/agent-shell/src/tools/execute-shell-command.test.ts：补充 shell 参数容错回归测试。回滚：`git checkout -- packages/agent-shell/src/tools/execute-shell-command.test.ts`。
- progress.md：追加本轮无人值守目标模式记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/agents/chat/chat.test.ts apps/browser/src/backend/agents/chat/chat.ts apps/browser/src/backend/services/agent-manager/agent-manager.ts apps/browser/src/backend/services/toolbox/index.ts apps/browser/src/backend/services/toolbox/tools/user-interaction/ask-user-questions.ts apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/ui/i18n/dict/chat.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx docs/agent-goal-mode.md packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/services/agent-manager/agent-manager.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.ts packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.test.ts packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.ts packages/agent-core/src/services/agent-manager/state-mutations/simple.ts packages/agent-core/src/types/agent.ts packages/agent-shell/src/schemas/index.ts packages/agent-shell/src/tools/execute-shell-command.test.ts packages/agent-shell/src/tools/execute-shell-command.ts progress.md && git clean -f apps/browser/src/backend/services/toolbox/tool-approval-mode.ts apps/browser/src/backend/services/toolbox/tool-approval-mode.test.ts packages/agent-core/src/agents/chat/goal-continuation.test.ts`。

## 2026-07-14 - Task: 目标模式无人值守最终复核

### What was done
- 复核目标模式无人值守链路，确认 active goal 正常停止输出后会自动续跑，不会把“对话结束”误当成目标完成。
- 复核交互卡死风险，确认 active goal 下模型侧不暴露 `askUserQuestions`，host 工具侧也不会创建 pending question。
- 复核目标控制入口，确认目标卡保留编辑、删除按钮，并新增暂停、继续按钮，暂停不会被普通 begin step 隐式恢复。
- 复核工具调用循环隐患，确认 shell 参数冲突下沉到运行时可恢复提示，避免 schema 参数修复循环。

### Testing
- `pnpm -F @stagewise/agent-core test -- goal-continuation state-mutations` 通过，7 个测试文件、37 个测试全部通过。
- `pnpm -F stagewise test -- chat.test.ts tool-approval-mode.test.ts` 通过，2 个测试文件、7 个测试全部通过。
- `pnpm -F @stagewise/agent-shell test -- execute-shell-command.test.ts` 通过，1 个测试文件、4 个测试全部通过。
- `pnpm -F @stagewise/agent-core build` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false ...` 对 23 个触及文件检查通过。
- `git diff --check` 退出码 0；Git 仅提示若干已有 CRLF/LF 工作区换行提醒。

### Notes
改动文件清单：
- progress.md：追加本轮最终复核记录。回滚：删除本条记录。
统一回滚点：删除本条 `progress.md` 记录。

## 2026-07-14 - Task: 目标模式无人值守最终复核

### What was done
- 复核目标模式无人值守链路，确认 active goal 正常停止输出后会自动续跑，不会把“对话结束”误当成目标完成。
- 复核交互卡死风险，确认 active goal 下模型侧不暴露 `askUserQuestions`，host 工具侧也不会创建 pending question。
- 复核目标控制入口，确认目标卡保留编辑、删除按钮，并新增暂停、继续按钮，暂停不会被普通 begin step 隐式恢复。
- 复核工具调用循环隐患，确认 shell 参数冲突下沉到运行时可恢复提示，避免 schema 参数修复循环。

### Testing
- `pnpm -F @stagewise/agent-core test -- goal-continuation state-mutations` 通过，7 个测试文件、37 个测试全部通过。
- `pnpm -F stagewise test -- chat.test.ts tool-approval-mode.test.ts` 通过，2 个测试文件、7 个测试全部通过。
- `pnpm -F @stagewise/agent-shell test -- execute-shell-command.test.ts` 通过，1 个测试文件、4 个测试全部通过。
- `pnpm -F @stagewise/agent-core build` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false ...` 对 23 个触及文件检查通过。
- `git diff --check` 退出码 0；Git 仅提示若干已有 CRLF/LF 工作区换行提醒。

### Notes
改动文件清单：
- progress.md：追加本轮最终复核记录。回滚：删除本条记录。
统一回滚点：删除本条 `progress.md` 记录。

## 2026-07-14 - Task: 压缩上下文可见状态提示

### What was done
- 为 agent 运行状态新增临时 `runtimePhase`，在历史压缩开始时标记为 `compressing-context`，压缩结束、步骤开始、步骤错误或停止工作时清理，避免 UI 残留假状态。
- 聊天历史加载提示读取 `runtimePhase`，压缩期间把泛化 `Working...` 替换为 `正在压缩上下文…`，让长时间等待能看出当前还活着并且在压缩。
- 同步步骤间的小型加载提示，长回答后继续压缩时也显示同一压缩文案，不只在用户消息后的主加载位显示。
- 更新压缩上下文维护文档，说明压缩期间的可见状态来源和 UI 行为。

### Testing
- `pnpm -F @stagewise/agent-core test -- goal-continuation state-mutations` 通过，7 个测试文件、42 个测试全部通过。
- `pnpm -F @stagewise/agent-core build` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false ...` 对本轮触及的 12 个代码/文档文件检查通过。
- `git diff --check` 退出码 0；Git 仅提示若干已有 CRLF/LF 工作区换行提醒。

### Notes
改动文件清单：
- apps/browser/src/ui/i18n/dict/chat.ts：新增压缩上下文运行阶段的中英文提示。回滚：`git checkout -- apps/browser/src/ui/i18n/dict/chat.ts`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx：读取 agent `runtimePhase` 并在主加载提示、步骤间提示中显示压缩状态。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-assistant.tsx：把步骤间提示文案传给 `MessageBetweenSteps` 并纳入 memo 比较。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-assistant.tsx`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-between-steps.tsx：允许步骤间加载提示接收自定义文案。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-between-steps.tsx`。
- docs/agent-context-compression.md：记录压缩期间 UI 可见状态。回滚：`git checkout -- docs/agent-context-compression.md`。
- packages/agent-core/src/agents/base-agent.ts：在历史压缩开始和结束时设置/清理 `runtimePhase`。回滚：`git checkout -- packages/agent-core/src/agents/base-agent.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts：补充运行阶段 mutation 和停止清理测试。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/bind.ts：把运行阶段 mutation 暴露给 agent 命令 bundle。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/bind.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.test.ts：补充 begin step 和 step error 清理运行阶段断言。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.test.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.ts：步骤开始和错误结束时清理运行阶段。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts：停止工作时清理运行阶段。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/streaming.ts：新增 `setRuntimePhase` mutation。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/streaming.ts`。
- packages/agent-core/src/store/state-annotation.md：标注 `runtimePhase` 为 ephemeral 状态。回滚：`git checkout -- packages/agent-core/src/store/state-annotation.md`。
- packages/agent-core/src/types/agent.ts：新增 `AgentRuntimePhase` 和 `runtimePhase` 状态字段。回滚：`git checkout -- packages/agent-core/src/types/agent.ts`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui/i18n/dict/chat.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-assistant.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-between-steps.tsx docs/agent-context-compression.md packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.ts packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.test.ts packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.ts packages/agent-core/src/services/agent-manager/state-mutations/simple.ts packages/agent-core/src/services/agent-manager/state-mutations/streaming.ts packages/agent-core/src/store/state-annotation.md packages/agent-core/src/types/agent.ts progress.md`。

## 2026-07-14 - Task: 目标模式卡住阶段可见化与产物更新

### What was done
- 将 agent 运行阶段从单一压缩提示扩展到准备上下文、准备工具、等待模型响应和压缩上下文，避免 UI 长时间只显示泛化 `Working...`。
- 将步骤活动 watchdog 提前到 `beginStep` 后启动，使模型解析、上下文生成和工具准备阶段的静默卡住也能被发现；目标模式下超过阈值后继续安排下一轮，而不是直接 abort。
- 在 UI 主加载位和步骤间加载位显示当前运行阶段文案，用户能区分是在准备上下文、准备工具、等待模型还是压缩上下文。
- 停止占用旧开发包目录的 `stagewise-dev.exe` 进程，重新执行 `package:fast`，并确认新的 `app.asar` 已包含运行阶段状态字段和中文提示文案。

### Testing
- `pnpm -F @stagewise/agent-core test -- goal-continuation state-mutations` 通过，7 个测试文件、43 个测试全部通过。
- `pnpm -F @stagewise/agent-core build` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false ...` 对本轮运行阶段可见化相关文件检查通过。
- `git diff --check` 退出码 0；Git 仅提示若干 CRLF/LF 工作区换行提醒。
- `pnpm -F stagewise package:fast` 打包通过，生成 `apps/browser/out/dev/stagewise-dev-win32-x64/resources/app.asar`。
- 产物检查确认 `app.asar` 主进程 bundle 包含 `preparing-context`、`preparing-tools`、`waiting-for-model`、`compressing-context`，渲染端 bundle 包含 `正在等待模型响应` 和 `正在压缩上下文`。

### Notes
改动文件清单：
- apps/browser/src/ui/i18n/dict/chat.ts：新增目标暂停/继续按钮文案和运行阶段提示文案。回滚：`git checkout -- apps/browser/src/ui/i18n/dict/chat.ts`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx：读取 `runtimePhase` 并显示阶段化加载提示。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-assistant.tsx：向步骤间加载提示传递运行阶段文案。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-assistant.tsx`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-between-steps.tsx：允许步骤间加载提示显示自定义文案。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-between-steps.tsx`。
- docs/agent-runtime-visibility.md：新增运行阶段可见化和 watchdog 行为说明。回滚：`git checkout -- docs/agent-runtime-visibility.md`。
- docs/agent-context-compression.md：补充上下文压缩阶段的可见状态说明。回滚：`git checkout -- docs/agent-context-compression.md`。
- packages/agent-core/src/agents/base-agent.ts：提前启动 watchdog，并在上下文、工具、模型等待和压缩阶段设置 `runtimePhase`。回滚：`git checkout -- packages/agent-core/src/agents/base-agent.ts`。
- packages/agent-core/src/agents/chat/goal-continuation.test.ts：补充准备阶段卡住清理和目标模式续跑测试。回滚：`git checkout -- packages/agent-core/src/agents/chat/goal-continuation.test.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts：补充运行阶段状态 mutation 测试。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/bind.ts：暴露 `setRuntimePhase` 命令。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/bind.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.test.ts：补充 lifecycle 清理运行阶段断言。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.test.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.ts：步骤开始和错误结束时清理运行阶段。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts：停止工作时清理运行阶段。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/streaming.ts：新增运行阶段状态 mutation。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/streaming.ts`。
- packages/agent-core/src/store/state-annotation.md：标注 `runtimePhase` 是临时运行状态。回滚：`git checkout -- packages/agent-core/src/store/state-annotation.md`。
- packages/agent-core/src/types/agent.ts：扩展 `AgentRuntimePhase` 类型和值。回滚：`git checkout -- packages/agent-core/src/types/agent.ts`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui/i18n/dict/chat.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-assistant.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-between-steps.tsx docs/agent-runtime-visibility.md docs/agent-context-compression.md packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/agents/chat/goal-continuation.test.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.ts packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.test.ts packages/agent-core/src/services/agent-manager/state-mutations/lifecycle.ts packages/agent-core/src/services/agent-manager/state-mutations/simple.ts packages/agent-core/src/services/agent-manager/state-mutations/streaming.ts packages/agent-core/src/store/state-annotation.md packages/agent-core/src/types/agent.ts progress.md`。

## 2026-07-14 - Task: 目标模式编辑历史消息后恢复未完成目标

### What was done
- 将目标状态镜像到最新用户消息 metadata 的 `goalSnapshot`，并在删除目标时写入 `null` tombstone，避免重启后误恢复更早目标。
- agent 恢复时从持久化历史里扫描最后一个目标快照；如果目标仍为 active，自动触发模型内部续跑，不需要用户重新发送消息。
- 历史用户消息编辑提交时，如果底部目标模式开关已开启，后端会恢复本会话最后一个目标并把 paused/blocked 快照重新激活，让编辑后的消息继续服务于原目标。
- 目标暂停、继续、编辑目标和删除目标后立即持久化，避免应用关闭后丢失目标状态。
- 前端新增目标模式开关状态事件，编辑历史消息组件提交 replace RPC 时携带 `restoreLastGoal`。

### Testing
- `pnpm -F @stagewise/agent-core exec tsc --noEmit` 退出码 0。
- `pnpm -F @stagewise/agent-core test -- state-mutations goal-continuation` 通过，7 个测试文件、43 个测试全部通过。
- `pnpm -F @stagewise/agent-core build` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false ...` 对本轮触及代码文件检查通过。

### Notes
改动文件清单：
- apps/browser/src/shared/karton-contracts/ui/index.ts：给 `replaceUserMessage` 增加目标恢复选项。回滚：`git checkout -- apps/browser/src/shared/karton-contracts/ui/index.ts`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-user.tsx：编辑历史消息时读取目标模式开关并传递 `restoreLastGoal`。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-user.tsx`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx：广播底部目标模式开关状态。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_lib/chat-goal-mode-event.ts：新增目标模式开关事件类型。回滚：删除该文件。
- docs/agent-goal-mode.md：记录目标快照持久化、历史消息编辑恢复和重启续跑语义。回滚：`git checkout -- docs/agent-goal-mode.md`。
- packages/agent-core/src/agents/base-agent.ts：新增 `continueActiveGoal()` 用于恢复 active 目标后内部续跑。回滚：`git checkout -- packages/agent-core/src/agents/base-agent.ts`。
- packages/agent-core/src/services/agent-manager/agent-manager.ts：恢复目标快照、编辑消息恢复目标、目标变化立即持久化。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/agent-manager.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/bind.ts：暴露 `syncGoalSnapshot` mutation。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/bind.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts：目标状态变化时同步 `goalSnapshot`。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts`。
- packages/agent-core/src/types/metadata.ts：新增 `goalSnapshot` metadata schema。回滚：`git checkout -- packages/agent-core/src/types/metadata.ts`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-user.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx docs/agent-goal-mode.md packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/services/agent-manager/agent-manager.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.ts packages/agent-core/src/services/agent-manager/state-mutations/simple.ts packages/agent-core/src/types/metadata.ts progress.md && git clean -f -- apps/browser/src/ui/screens/main/agent-chat/chat/_lib/chat-goal-mode-event.ts`。

## 2026-07-15 - Task: 模型对话卡住时保存运行日志和请求日志

### What was done
- 给浏览器后端 Logger 增加本地文件落盘和轮转，保留 Console 输出的同时写入 debug 级总日志与 warn/error 日志，避免打包环境卡住后无现场记录。
- 给 LLM 网络请求包装层增加 request id、请求摘要、代理路径、响应状态、异常和耗时日志，便于区分请求未发出、上游无响应、代理/节点切换失败和 provider 返回错误。
- 给 agent step 增加 `agent-runtime-YYYY-MM-DD.jsonl` 结构化运行轨迹，记录 step、模型解析、上下文准备、工具准备、streamText 开始/结束/错误/abort 以及上下文压缩开始/结束/失败等事件。
- 更新运行可见性文档，说明开发版/正式版日志目录、关键文件、traceId 排查方式和敏感信息处理边界。

### Testing
- `pnpm -F @stagewise/agent-core exec tsc --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise test -- --run llm-network` 通过，1 个测试文件、13 个测试全部通过。
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/backend/services/logger.ts apps/browser/src/backend/agents/llm-network.ts packages/agent-core/src/agents/base-agent.ts docs/agent-runtime-visibility.md` 退出码 0。

### Notes
改动文件清单：
- apps/browser/src/backend/services/logger.ts：新增持久化 backend 日志和 warn/error 日志的文件 transport 与轮转配置。回滚：`git checkout -- apps/browser/src/backend/services/logger.ts`。
- apps/browser/src/backend/agents/llm-network.ts：为模型网络请求增加 request id、请求开始、响应、异常和耗时日志。回滚：`git checkout -- apps/browser/src/backend/agents/llm-network.ts`。
- packages/agent-core/src/agents/base-agent.ts：新增 agent runtime JSONL trace，覆盖 step、streamText 和上下文压缩关键阶段。回滚：`git checkout -- packages/agent-core/src/agents/base-agent.ts`。
- docs/agent-runtime-visibility.md：补充运行日志、请求日志和卡住时排查路径。回滚：`git checkout -- docs/agent-runtime-visibility.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/services/logger.ts apps/browser/src/backend/agents/llm-network.ts packages/agent-core/src/agents/base-agent.ts docs/agent-runtime-visibility.md progress.md`。

## 2026-07-15 - Task: 模型对话日志验证补充

### What was done
- 补充执行 agent-core build，确认运行时代码改动可生成包产物。

### Testing
- `pnpm -F @stagewise/agent-core build` 退出码 0。

### Notes
改动文件清单：
- progress.md：追加本轮验证补充记录。回滚：删除本条记录。
统一回滚点：删除本条 `模型对话日志验证补充` 记录。

## 2026-07-15 - Task: 启动后台任务异步化与前台加载提示

### What was done
- 新增 `startupBackgroundTasks` UI 状态，用于向前台报告非关键启动任务的运行、完成和失败状态。
- 增加启动后台任务包装器，将搜索引擎加载、插件发现、通知音效同步、ripgrep 检查、内置技能发现、资源缓存清理和工作区清理扫描纳入后台异步执行与状态上报。
- 将资源缓存 DB 初始化和过期清理从前台 `await` 启动链路移到后台执行，避免该类缓存维护阻塞窗口可操作性。
- 主界面新增非模态后台加载浮层，提示用户“后台正在加载某某内容”，且不阻止用户继续操作 UI。
- 更新启动性能文档，说明哪些任务应后台化、哪些核心路径仍必须保持前台初始化。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/backend/main.ts apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/ui/screens/main/index.tsx apps/browser/src/ui/screens/main/_components/startup-background-tasks-floating.tsx docs/startup-performance-profiling.md` 退出码 0；当前 Biome 配置只检查了代码文件，docs markdown 被忽略。

### Notes
改动文件清单：
- apps/browser/src/backend/main.ts：新增后台启动任务调度器，并将低风险启动任务改为异步后台执行。回滚：`git checkout -- apps/browser/src/backend/main.ts`。
- apps/browser/src/shared/karton-contracts/ui/index.ts：新增 `StartupBackgroundTaskStatus` 和 `startupBackgroundTasks` 状态字段。回滚：`git checkout -- apps/browser/src/shared/karton-contracts/ui/index.ts`。
- apps/browser/src/ui/screens/main/index.tsx：挂载启动后台任务浮层。回滚：`git checkout -- apps/browser/src/ui/screens/main/index.tsx`。
- apps/browser/src/ui/screens/main/_components/startup-background-tasks-floating.tsx：新增非模态后台加载提示组件。回滚：删除该文件。
- docs/startup-performance-profiling.md：补充启动后台任务策略说明。回滚：`git checkout -- docs/startup-performance-profiling.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/main.ts apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/ui/screens/main/index.tsx docs/startup-performance-profiling.md progress.md && git clean -f -- apps/browser/src/ui/screens/main/_components/startup-background-tasks-floating.tsx`。

## 2026-07-19 - Task: 普通对话误触目标模式入口收口

### What was done
- 收口模型可见工具集：普通对话无目标时不再暴露任何目标工具，避免模型在用户未开启目标模式时自行创建目标。
- 已存在目标时只保留读取和更新能力，不再向模型暴露目标创建入口；目标创建仍由前端目标模式开关和后端 send-message options 触发。
- 修正目标续跑回归测试中重复插入的用例块，补充并保留“无目标不暴露工具 / 有目标不含 createGoal”的断言。
- 更新目标模式文档，明确 createGoal 不再是模型工具，目标创建只走 UI/后端入口。

### Testing
- `pnpm -F @stagewise/agent-core test -- goal-continuation` 通过，1 个测试文件、11 个测试全部通过。
- `pnpm -F @stagewise/agent-core build` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false D:/work/ai/stagewise/packages/agent-core/src/agents/base-agent.ts D:/work/ai/stagewise/packages/agent-core/src/agents/chat/goal-continuation.test.ts D:/work/ai/stagewise/docs/agent-goal-mode.md` 退出码 0。
- `git diff --check` 退出码 0；仅输出 CRLF/LF 提示，无 whitespace error。

### Notes
改动文件清单：
- packages/agent-core/src/agents/base-agent.ts：按是否已有 goal 控制目标工具暴露，并移除模型侧 createGoal 工具。回滚：`git checkout -- packages/agent-core/src/agents/base-agent.ts`。
- packages/agent-core/src/agents/chat/goal-continuation.test.ts：增加目标工具暴露回归断言，并清理重复嵌套的测试块。回滚：`git checkout -- packages/agent-core/src/agents/chat/goal-continuation.test.ts`。
- docs/agent-goal-mode.md：记录目标创建只走前端/后端入口，模型不接收 createGoal 工具。回滚：`git checkout -- docs/agent-goal-mode.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/agents/chat/goal-continuation.test.ts docs/agent-goal-mode.md progress.md`。

## 2026-07-19 - Task: 目标模式累计 token 误当上下文窗口阻断

### What was done
- 修正截图中的 `Goal token budget reached (...)` 误阻断：目标模式不再把累计 `usedTokens` 当成当前上下文窗口大小，也不再因为累计 token 超过旧预算而停止无人值守续跑。
- 保留已有上下文压缩链路：请求前仍按模型上下文窗口做 preflight 压缩，provider 返回 `context_too_large` 时仍压缩后重试一次。
- 旧版本遗留的 `Goal token budget reached (...)` blocked 目标在恢复时会自动重新激活并清掉陈旧预算，避免历史会话一直卡在已阻断状态。
- 目标卡片对 blocked 状态也显示继续按钮，用户可以手动恢复被阻断的目标并继续执行。
- 更新目标模式文档，明确累计 token 不是当前上下文窗口，压缩负责处理上下文窗口压力。

### Testing
- `pnpm -F @stagewise/agent-core test -- goal-continuation state-mutations` 通过，7 个测试文件、46 个测试全部通过。
- `pnpm -F @stagewise/agent-core build` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 最终重跑退出码 0；首次与 agent-core build 并发执行时因 dist declarations 被重建出现临时 TS7016，build 完成后重跑通过。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 最终重跑退出码 0；修正 blocked 按钮状态判断后通过。
- `pnpm exec biome check --formatter-enabled=false D:/work/ai/stagewise/packages/agent-core/src/agents/base-agent.ts D:/work/ai/stagewise/packages/agent-core/src/agents/chat/goal-continuation.test.ts D:/work/ai/stagewise/packages/agent-core/src/services/agent-manager/agent-manager.ts D:/work/ai/stagewise/packages/agent-core/src/services/agent-manager/state-mutations/simple.ts D:/work/ai/stagewise/packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts D:/work/ai/stagewise/apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx D:/work/ai/stagewise/docs/agent-goal-mode.md` 退出码 0。
- `git diff --check` 退出码 0；仅输出 CRLF/LF 提示，无 whitespace error。

### Notes
改动文件清单：
- packages/agent-core/src/agents/base-agent.ts：移除累计 token 预算触发的目标阻断，目标上下文中改为 `cumulative_used_tokens`。回滚：`git checkout -- packages/agent-core/src/agents/base-agent.ts`。
- packages/agent-core/src/agents/chat/goal-continuation.test.ts：将目标预算用例改为验证累计 token 超过旧预算后仍继续。回滚：`git checkout -- packages/agent-core/src/agents/chat/goal-continuation.test.ts`。
- packages/agent-core/src/services/agent-manager/agent-manager.ts：恢复历史目标时自动重新激活旧的 token-budget blocked 快照并清除陈旧预算。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/agent-manager.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts：允许 blocked 目标 resume，并清除旧 token-budget 阻断遗留字段。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts：补充 blocked 目标恢复并清除陈旧预算的回归测试。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx：blocked 目标卡片也显示继续按钮并走恢复逻辑。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx`。
- docs/agent-goal-mode.md：记录累计 token 与上下文窗口的边界，以及旧预算阻断的恢复语义。回滚：`git checkout -- docs/agent-goal-mode.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/agents/chat/goal-continuation.test.ts packages/agent-core/src/services/agent-manager/agent-manager.ts packages/agent-core/src/services/agent-manager/state-mutations/simple.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx docs/agent-goal-mode.md progress.md`。

## 2026-07-19 - Task: 目标模式里重复显示两个“正在等待模型响应”提示

### What was done
- 收掉了同一状态的双重渲染：当外层消息列表已经显示 loading 提示时，assistant 消息内部的 between-steps 提示不再重复显示。
- 保持模型等待态的单一来源仍然是外层 `MessageLoading`，这样等待模型响应只出现一次。

### Testing
- `pnpm exec biome check --formatter-enabled=false D:/work/ai/stagewise/apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `git diff --check` 退出码 0；仅输出 CRLF/LF 提示，无 whitespace error。

### Notes
改动文件清单：
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx：当外层 loading 提示存在时，禁止 assistant 内部 between-steps 提示重复渲染。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx progress.md`。

## 2026-07-19 - Task: 目标模式卡片遮挡错误重试按钮

### What was done
- 给目标模式状态卡片增加独立高度测量，写入 `--goal-status-card-height`。
- 聊天历史底部预留空间现在同时包含 footer 状态卡高度和目标模式卡片高度，避免最后一条错误卡片的重试按钮被目标卡片盖住。
- 目标卡片卸载时会清理高度变量，避免普通对话残留额外底部空白。

### Testing
- `pnpm exec biome check --formatter-enabled=false D:/work/ai/stagewise/apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx D:/work/ai/stagewise/apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `git diff --check` 退出码 0；仅输出 CRLF/LF 提示，无 whitespace error。

### Notes
改动文件清单：
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx：测量目标模式卡片高度并同步到 CSS 变量。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx：聊天历史底部 padding 增加目标模式卡片高度预留。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/panel-footer.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx progress.md`。

## 2026-07-19 - Task: 通用运行错误的重试按钮没有明显反应

### What was done
- 调整通用 runtime error 的重试语义：`kind` 为空的错误现在直接重发上一条用户消息，而不是继续当前错误现场。
- 保留 typed provider/risk 错误的原有继续逻辑，避免把账号/上游类错误的处理路径改坏。
- 这样 `LLM stream stalled` 这类普通超时/卡死错误点重试后会立刻进入真正的重新执行流程。

### Testing
- `pnpm exec biome check --formatter-enabled=false D:/work/ai/stagewise/apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `git diff --check` 退出码 0；仅输出 CRLF/LF 提示，无 whitespace error。

### Notes
改动文件清单：
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx：通用 runtime error 的重试按钮改为直接重发上一条用户消息。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx`。
- progress.md：追加本轮记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx progress.md`。

## 2026-07-19 - Task: 修复目标完成后重启复活
### What was done
- 确认目标模式按 agent 会话历史隔离恢复，不是全局目标状态串用。
- 修复目标快照持久化：保存 agent 状态时会把承载 `goalSnapshot` 的最新用户消息行标记为 dirty，确保完成、暂停、删除等终态写入 SQLite 的消息表。
- 补充目标持久化回归测试，覆盖“用户消息后面已有助手消息时，完成态快照仍要持久化到用户消息行”的场景。

### Testing
- `pnpm exec biome check --write packages/agent-core/src/services/agent-manager/agent-manager.ts packages/agent-core/src/services/agent-manager/state-mutations/simple.ts packages/agent-core/src/services/agent-manager/agent-manager.goal-persistence.test.ts`
- `pnpm -F @stagewise/agent-core test -- agent-manager.goal-persistence state-mutations`
- `pnpm -F @stagewise/agent-core build`

### Notes
- packages/agent-core/src/services/agent-manager/agent-manager.ts：持久化前同步目标快照后重新读取 store，并把最新用户消息索引并入 dirtyMessageIndices。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/agent-manager.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts：目标快照同步会为缺失 metadata 的用户消息补最小 metadata，并返回承载快照的消息索引。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/simple.ts`。
- packages/agent-core/src/services/agent-manager/agent-manager.goal-persistence.test.ts：新增目标快照非尾消息持久化回归测试。回滚：`rm packages/agent-core/src/services/agent-manager/agent-manager.goal-persistence.test.ts`。
- docs/agent-goal-mode.md：补充说明目标快照所在用户消息行必须作为 dirty 行持久化。回滚：`git checkout -- docs/agent-goal-mode.md`。

## 2026-07-19 - Task: 兼容历史目标完成态恢复
### What was done
- 增加历史数据兼容：重启恢复时如果用户消息里的 `goalSnapshot` 还是旧的 active，但其后的助手消息里已有同一目标的 `updateGoal` 完成输出，则以工具输出里的 complete 状态为准。
- 扩展回归测试，覆盖旧数据“用户快照 active、助手工具结果 complete”时重启不继续自动执行的场景。

### Testing
- `pnpm exec biome check --write packages/agent-core/src/services/agent-manager/agent-manager.ts packages/agent-core/src/services/agent-manager/agent-manager.goal-persistence.test.ts`
- `pnpm -F @stagewise/agent-core test -- agent-manager.goal-persistence state-mutations`
- `pnpm -F @stagewise/agent-core build`
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit`

### Notes
- packages/agent-core/src/services/agent-manager/agent-manager.ts：恢复目标时读取较新的 `updateGoal` 工具输出，避免旧 active 快照覆盖已完成结果。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/agent-manager.ts`。
- packages/agent-core/src/services/agent-manager/agent-manager.goal-persistence.test.ts：新增旧 active 快照被 newer complete 工具输出纠正的恢复测试。回滚：`rm packages/agent-core/src/services/agent-manager/agent-manager.goal-persistence.test.ts`。
- docs/agent-goal-mode.md：补充历史旧数据恢复优先级说明。回滚：`git checkout -- docs/agent-goal-mode.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。

## 2026-07-19 - Task: 修复上下文超窗误发与压缩超时
### What was done
- 在请求前增加对进行中历史压缩的等待，并把预检上限同时受 85% 比例和 100k 硬上限约束，避免继续用旧上下文反复发起超窗请求。
- 把历史压缩单次超时从 30s 放宽到 90s，给大历史压缩留出完成时间。
- 同步更新历史压缩测试里的超时用例和上下文压缩维护说明。

### Testing
- `pnpm exec biome check --formatter-enabled=false packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/agents/shared/history-compression/index.ts packages/agent-core/src/agents/shared/history-compression.test.ts docs/agent-context-compression.md`
- `pnpm -F @stagewise/agent-core build`
- `pnpm -F @stagewise/agent-core test -- history-compression`
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit`

### Notes
- packages/agent-core/src/agents/base-agent.ts：请求前先等待进行中的历史压缩，并把 preflight 上限也卡到硬上限以下。回滚：`git checkout -- packages/agent-core/src/agents/base-agent.ts`。
- packages/agent-core/src/agents/shared/history-compression/index.ts：历史压缩单次超时从 30 秒放宽到 90 秒。回滚：`git checkout -- packages/agent-core/src/agents/shared/history-compression/index.ts`。
- packages/agent-core/src/agents/shared/history-compression.test.ts：同步更新超时测试断言与等待时长。回滚：`git checkout -- packages/agent-core/src/agents/shared/history-compression.test.ts`。
- docs/agent-context-compression.md：补充压缩等待与硬上限说明。回滚：`git checkout -- docs/agent-context-compression.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。

## 2026-07-19 - Task: 避免上下文压缩期间误触发 stream stalled watchdog
### What was done
- 把 step activity watchdog 从上下文准备阶段挪到真正进入 `waiting-for-model` 之后才启动，避免压缩/预检阶段被误判成模型流卡死。
- 同步更新运行时说明，让 watchdog 行为和真实阶段边界一致。

### Testing
- `pnpm exec biome check --formatter-enabled=false packages/agent-core/src/agents/base-agent.ts docs/agent-runtime-visibility.md docs/agent-context-compression.md`
- `pnpm -F @stagewise/agent-core build`
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit`（当前工作区存在一批既有 `@stagewise/agent-core` 声明/隐式 any 报错，与本次改动无关）

### Notes
- packages/agent-core/src/agents/base-agent.ts：watchdog 改为在 `waiting-for-model` 阶段启动。回滚：`git checkout -- packages/agent-core/src/agents/base-agent.ts`。
- docs/agent-runtime-visibility.md：更新 watchdog 触发边界说明。回滚：`git checkout -- docs/agent-runtime-visibility.md`。
- docs/agent-context-compression.md：保持与压缩/等待说明一致。回滚：`git checkout -- docs/agent-context-compression.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。

## 2026-07-19 - Task: 大 HAR/日志附件上下文瘦身
### What was done
- 新增 HAR 文件读取摘要：默认只注入网络请求索引，包含 hosts、method/status 分布、失败请求、慢请求、内容类型和 GraphQL operation；请求/响应 body 默认不进模型上下文。
- 新增大日志摘要：`.log` 超过 64KB 或 1000 行时只注入首尾样本、级别计数、时间范围和重复错误摘要；精确内容仍可通过行范围读取。
- 大 `.textclip` 粘贴复用日志摘要逻辑，避免大段 HAR/日志文本粘贴后反复触发上下文压缩。
- 为诊断附件摘要补回归测试，并更新文件读取与上下文压缩文档。

### Testing
- `pnpm exec biome check --formatter-enabled=false packages/agent-core/src/file-read-transformer/index.ts packages/agent-core/src/file-read-transformer/transformers/index.ts packages/agent-core/src/file-read-transformer/transformers/diagnostic-text.ts packages/agent-core/src/file-read-transformer/transformers/har.ts packages/agent-core/src/file-read-transformer/transformers/text-blob.ts packages/agent-core/src/file-read-transformer/diagnostic-attachments.test.ts` 退出码 0。
- `pnpm -F @stagewise/agent-core test -- diagnostic-attachments` 退出码 0。
- `pnpm -F @stagewise/agent-core test -- file-read-transformer diagnostic-attachments content-limits preview-promotion serialization` 退出码 0，95 个测试通过。
- `pnpm -F @stagewise/agent-core build` 退出码 0。
- `git diff --check -- packages/agent-core/src/file-read-transformer/index.ts packages/agent-core/src/file-read-transformer/transformers/index.ts packages/agent-core/src/file-read-transformer/transformers/text-blob.ts packages/agent-core/src/file-read-transformer/README.md` 退出码 0；仅输出 CRLF/LF 提示，无 whitespace error。

### Notes
- packages/agent-core/src/file-read-transformer/transformers/har.ts：新增 HAR 摘要转换器，默认省略 request/response body 并保留按行读取入口。回滚：`rm packages/agent-core/src/file-read-transformer/transformers/har.ts`。
- packages/agent-core/src/file-read-transformer/transformers/diagnostic-text.ts：新增大日志/大文本摘要工具。回滚：`rm packages/agent-core/src/file-read-transformer/transformers/diagnostic-text.ts`。
- packages/agent-core/src/file-read-transformer/index.ts：把 `.har`、`.log` 路由到诊断摘要转换器，并给诊断类缓存加版本片段。回滚：`git checkout -- packages/agent-core/src/file-read-transformer/index.ts`。
- packages/agent-core/src/file-read-transformer/transformers/index.ts：导出新增转换器。回滚：`git checkout -- packages/agent-core/src/file-read-transformer/transformers/index.ts`。
- packages/agent-core/src/file-read-transformer/transformers/text-blob.ts：大 `.textclip` 默认走诊断摘要。回滚：`git checkout -- packages/agent-core/src/file-read-transformer/transformers/text-blob.ts`。
- packages/agent-core/src/file-read-transformer/diagnostic-attachments.test.ts：新增 HAR、`.log`、`.textclip` 摘要回归测试。回滚：`rm packages/agent-core/src/file-read-transformer/diagnostic-attachments.test.ts`。
- packages/agent-core/src/file-read-transformer/README.md：补充诊断附件摘要行为。回滚：`git checkout -- packages/agent-core/src/file-read-transformer/README.md`。
- docs/agent-context-compression.md：补充大 HAR/日志附件先摘要再进上下文的说明。回滚：`rm docs/agent-context-compression.md` 或恢复到本轮前内容。
- progress.md：追加本轮记录。回滚：删除本条记录。

## 2026-07-19 - Task: 对话结束后展示 token 统计摘要
### What was done
- 在每次 assistant 步结束后，把累计 token、输入/输出、缓存命中、缓存命中率、上下文占用、调用次数和耗时写入最后一条 assistant 消息的 metadata。
- 在聊天消息底部增加 token 统计条，并补充中英文词条与文档说明。
- 增加核心状态 mutation 回归测试，确认累计统计会从上一条 assistant 的历史摘要继续累加。

### Testing
- `pnpm exec biome check --formatter-enabled=false packages/agent-core/src/types/metadata.ts apps/browser/src/shared/karton-contracts/ui/agent/metadata.ts packages/agent-core/src/services/agent-manager/state-mutations/metadata.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.ts packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts packages/agent-core/src/agents/base-agent.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-assistant.tsx apps/browser/src/ui/i18n/dict/chat.ts` 退出码 0。
- `pnpm -F @stagewise/agent-core test -- bind` 退出码 0。
- `pnpm -F @stagewise/agent-core build` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。

### Notes
- packages/agent-core/src/types/metadata.ts：新增 usage summary 元数据 schema。回滚：`git checkout -- packages/agent-core/src/types/metadata.ts`。
- apps/browser/src/shared/karton-contracts/ui/agent/metadata.ts：把 usage summary 透出到浏览器侧契约。回滚：`git checkout -- apps/browser/src/shared/karton-contracts/ui/agent/metadata.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/metadata.ts：新增最后一条 assistant 的 usage summary 追加逻辑。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/metadata.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/bind.ts：把 usage summary mutation 挂到 bound bundle。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/bind.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts：新增累计 usage summary 回归测试。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/bind.test.ts`。
- packages/agent-core/src/agents/base-agent.ts：记录本步 context / duration 并在结束后写入最后 assistant 消息。回滚：`git checkout -- packages/agent-core/src/agents/base-agent.ts`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-assistant.tsx：新增消息底部 token 统计行。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-assistant.tsx`。
- apps/browser/src/ui/i18n/dict/chat.ts：补充 token 统计文案词条。回滚：`git checkout -- apps/browser/src/ui/i18n/dict/chat.ts`。
- docs/agent-usage-summary.md：记录该统计条的来源与含义。回滚：`rm docs/agent-usage-summary.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。

## 2026-07-19 - Task: 将上下文压缩改为压缩后重基线
### What was done
- 将 post-step 上下文压缩触发从“会话累计 usedTokens”改为“距上次成功压缩后的新增 usedTokens”，避免压缩后因为历史累计值仍然很高而几轮对话内反复压缩。
- 在压缩边界消息 metadata 中写入 `compressionState`，把压缩时的 `baselineUsedTokens` 和 `compressedAt` 持久化到消息表；重启后仍按压缩后的新基线继续判断。
- 对旧历史数据做兼容：如果历史中已有 `compressedHistory` 但没有新 `compressionState`，本轮判断把当前 usedTokens 当作兜底基线，不再因为旧累计值立即重复压缩。
- 同步更新 core/browser metadata schema 和上下文压缩文档说明。

### Testing
- `pnpm exec biome check --write apps/browser/src/shared/karton-contracts/ui/agent/metadata.ts packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/services/agent-manager/state-mutations/streaming.ts packages/agent-core/src/services/agent-manager/state-mutations/streaming.test.ts packages/agent-core/src/types/metadata.ts docs/agent-context-compression.md`
- `pnpm -F @stagewise/agent-core test -- state-mutations streaming`
- `pnpm -F @stagewise/agent-core build`
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit`
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit`
- `git diff --check -- packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/services/agent-manager/state-mutations/streaming.ts packages/agent-core/src/services/agent-manager/state-mutations/streaming.test.ts packages/agent-core/src/types/metadata.ts apps/browser/src/shared/karton-contracts/ui/agent/metadata.ts docs/agent-context-compression.md progress.md` 退出码 0；仅有 progress.md CRLF/LF 提示。

### Notes
- packages/agent-core/src/agents/base-agent.ts：post-step 压缩触发改为按最近压缩基线后的增量计算，并在压缩完成时写入压缩基线。回滚：`git checkout -- packages/agent-core/src/agents/base-agent.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/streaming.ts：`storeCompressedHistory` 支持写入 `compressionState`。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/streaming.ts`。
- packages/agent-core/src/services/agent-manager/state-mutations/streaming.test.ts：补充压缩状态写入断言。回滚：`git checkout -- packages/agent-core/src/services/agent-manager/state-mutations/streaming.test.ts`。
- packages/agent-core/src/types/metadata.ts：新增 `compressionStateSchema` 和 `CompressionState` metadata 字段。回滚：`git checkout -- packages/agent-core/src/types/metadata.ts`。
- apps/browser/src/shared/karton-contracts/ui/agent/metadata.ts：同步浏览器侧 metadata schema。回滚：`git checkout -- apps/browser/src/shared/karton-contracts/ui/agent/metadata.ts`。
- docs/agent-context-compression.md：说明压缩后按新基线继续判断。回滚：`git checkout -- docs/agent-context-compression.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。
- Correction：docs/agent-context-compression.md 当前仍是未跟踪文件；若只回滚本轮改动，应删除本轮新增的压缩基线说明段落；若丢弃整个未跟踪文档，可执行 `Remove-Item -LiteralPath docs/agent-context-compression.md`。

## 2026-07-19 - Task: 降低准备上下文提示频率
### What was done
- 确认 `正在准备上下文…` 不是压缩本身，而是每轮模型请求前和步骤收尾重建上下文时的常规 runtime phase。
- 对 UI 提示做降噪：`preparing-context` 持续超过 1200ms 才显示，避免每个短 step 都闪出“正在准备上下文…”。
- 保持 `compressing-context`、`waiting-for-model` 等真正需要用户感知的状态即时显示。

### Testing
- `pnpm exec biome check --write apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx`
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit`
- `git diff --check -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx progress.md` 退出码 0；仅有 progress.md CRLF/LF 提示。

### Notes
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx：新增 `preparing-context` 延迟显示逻辑，减少短暂上下文准备状态的频繁闪现。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx`。
- progress.md：追加本轮记录。回滚：删除本条记录。

## 2026-07-19 - Task: 修复长工具执行误触发 LLM stream stalled
### What was done
- 确认截图中的 `LLM stream stalled` 发生在工具执行阶段，不是上下文压缩阶段，也不是模型请求前准备阶段。
- 为工具执行包装增加 step activity heartbeat：工具开始、执行期间、结束时都会刷新 watchdog 活跃时间，避免长时间 shell 命令或其他工具运行时被误判为模型流卡死。
- 保留原有 watchdog 语义：工具结束后如果后续确实没有模型输出或生命周期事件，仍会按原 120 秒规则报错。
- 补充回归测试与运行时可见性文档。

### Testing
- `pnpm exec biome check --formatter-enabled=false packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/agents/chat/goal-continuation.test.ts` 退出码 0。
- `pnpm -F @stagewise/agent-core test -- goal-continuation` 退出码 0，12 个测试通过。
- `pnpm -F @stagewise/agent-core build` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/agents/chat/goal-continuation.test.ts docs/agent-runtime-visibility.md` 退出码 0。

### Notes
- packages/agent-core/src/agents/base-agent.ts：工具执行期间增加 activity heartbeat，避免长工具被 step watchdog 误杀。回滚：`git checkout -- packages/agent-core/src/agents/base-agent.ts`。
- packages/agent-core/src/agents/chat/goal-continuation.test.ts：新增长工具执行期间 watchdog 保持活跃的回归测试。回滚：`git checkout -- packages/agent-core/src/agents/chat/goal-continuation.test.ts`。
- docs/agent-runtime-visibility.md：补充工具执行 heartbeat 与 watchdog 边界说明。回滚：`git checkout -- docs/agent-runtime-visibility.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。

## 2026-07-19 - Task: 模型回复语言跟随用户输入语言
### What was done
- 在 chat 系统提示词里补充了更明确的语言规则，要求模型始终使用用户最新消息的语言回复，用户切换语言时立即跟随切换。
- 同步更新了 core 和 browser 两套 `soul.md`，保证浏览器主链路和 core fallback 的行为一致。
- 增加了回归测试，分别覆盖 core 的系统 prompt 组装结果和 browser 侧 `soul.md` 内容。
- 追加了简短文档说明，记录这条语言跟随规则已经进入主 chat prompt。

### Testing
- `pnpm exec biome check --formatter-enabled=false packages/agent-core/src/agents/chat/prompts/soul.md packages/agent-core/src/agents/chat/system-prompt-builder/system-prompt-builder.test.ts apps/browser/src/backend/agents/chat/prompts/soul.md apps/browser/src/backend/agents/chat/prompts/soul.test.ts docs/unrestricted-technical-prompts.md`
- `pnpm -F @stagewise/agent-core test -- system-prompt-builder`
- `pnpm -F stagewise test -- src/backend/agents/chat/prompts/soul.test.ts`

### Notes
- packages/agent-core/src/agents/chat/prompts/soul.md：补充用户语言跟随规则。回滚：`git checkout -- packages/agent-core/src/agents/chat/prompts/soul.md`。
- apps/browser/src/backend/agents/chat/prompts/soul.md：补充浏览器主链路语言跟随规则。回滚：`git checkout -- apps/browser/src/backend/agents/chat/prompts/soul.md`。
- packages/agent-core/src/agents/chat/system-prompt-builder/system-prompt-builder.test.ts：增加 core prompt 语言规则断言。回滚：`git checkout -- packages/agent-core/src/agents/chat/system-prompt-builder/system-prompt-builder.test.ts`。
- apps/browser/src/backend/agents/chat/prompts/soul.test.ts：新增 browser prompt 直测。回滚：`Remove-Item -LiteralPath apps/browser/src/backend/agents/chat/prompts/soul.test.ts`。
- docs/unrestricted-technical-prompts.md：补充 prompt 行为说明。回滚：`git checkout -- docs/unrestricted-technical-prompts.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。
## 2026-07-19 - Task: clarify context usage vs compression threshold
### What was done
- 在 assistant 消耗摘要里补了“压缩阈值”显示，直接把当前上下文估算值和下一轮触发预检压缩的阈值拆开。
- 保持原有上下文估算口径不变，只增加一条辅助提示，避免用户把 `95,939/1,000,000` 误认为压缩触发线。
- 同步补了中英文文案和简短文档说明。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit`

### Notes
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-assistant.tsx：在 usage summary 中新增“压缩阈值”一行。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-assistant.tsx`。
- apps/browser/src/ui/i18n/dict/chat.ts：新增 usage summary 的压缩阈值文案。回滚：`git checkout -- apps/browser/src/ui/i18n/dict/chat.ts`。
- docs/agent-usage-summary.md：补充说明 usage summary 还会展示压缩阈值。回滚：`git checkout -- docs/agent-usage-summary.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。

## 2026-07-19 - Task: large-context compression threshold follows real window
### What was done
- 确认截图里的“重新打包后仍压缩”不是旧包问题，而是 1M 模型仍被 100k 绝对硬上限触发。
- 移除 post-step 和 preflight 压缩触发里的 100k 硬封顶，让阈值按当前模型真实 context window 缩放：chat post-step 约 50%，preflight 约 85%。
- 保留压缩后最近消息保留预算的 40k 上限，避免压缩结果本身过大。
- 把 UI 的提示从“压缩阈值”改成“预检阈值”，并按 85% 窗口展示；1M 模型会显示 850,000，而不是 100,000。
- 补充纯函数回归测试和相关文档/技能说明，防止后续又按旧硬上限排查。

### Testing
- `pnpm exec biome check --formatter-enabled=false packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/agents/index.ts packages/agent-core/src/agents/shared/context-compression-thresholds.ts packages/agent-core/src/agents/shared/context-compression-thresholds.test.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-assistant.tsx apps/browser/src/ui/i18n/dict/chat.ts docs/agent-context-compression.md docs/agent-usage-summary.md .agents/skills/history-compression/SKILL.md`
- `pnpm -F @stagewise/agent-core test -- context-compression-thresholds`
- `pnpm -F @stagewise/agent-core build`
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit`
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit`
- `git diff --check -- packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/agents/index.ts packages/agent-core/src/agents/shared/context-compression-thresholds.ts packages/agent-core/src/agents/shared/context-compression-thresholds.test.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-assistant.tsx apps/browser/src/ui/i18n/dict/chat.ts docs/agent-context-compression.md docs/agent-usage-summary.md .agents/skills/history-compression/SKILL.md progress.md` 退出码 0；仅有 CRLF/LF 提示。

### Notes
- packages/agent-core/src/agents/base-agent.ts：压缩触发阈值改为按 context window 缩放，不再套 100k 绝对硬上限。回滚：`git checkout -- packages/agent-core/src/agents/base-agent.ts`。
- packages/agent-core/src/agents/shared/context-compression-thresholds.ts：新增压缩阈值纯函数。回滚：`Remove-Item -LiteralPath packages/agent-core/src/agents/shared/context-compression-thresholds.ts`。
- packages/agent-core/src/agents/shared/context-compression-thresholds.test.ts：新增 1M context 阈值回归测试。回滚：`Remove-Item -LiteralPath packages/agent-core/src/agents/shared/context-compression-thresholds.test.ts`。
- packages/agent-core/src/agents/index.ts：导出压缩阈值 helper。回滚：`git checkout -- packages/agent-core/src/agents/index.ts`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-assistant.tsx：usage summary 的预检阈值按 85% context window 展示。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-assistant.tsx`。
- apps/browser/src/ui/i18n/dict/chat.ts：文案改为“预检阈值”。回滚：`git checkout -- apps/browser/src/ui/i18n/dict/chat.ts`。
- docs/agent-context-compression.md：更新压缩阈值说明。回滚：`git checkout -- docs/agent-context-compression.md`。
- docs/agent-usage-summary.md：更新 usage summary 阈值说明。回滚：`git checkout -- docs/agent-usage-summary.md`。
- .agents/skills/history-compression/SKILL.md：更新 history-compression 技能里的触发公式。回滚：`git checkout -- .agents/skills/history-compression/SKILL.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。

## 2026-07-19 - Task: hide waiting/tokens UI while model is actively streaming
### What was done
- 收紧了等待提示的显示条件：当当前最后一条 assistant 消息已经有正文在流式输出时，不再在下面继续显示“正在等待模型响应…”。
- 收紧了 tokens 统计框的显示条件：当前这轮 assistant 还在流式响应时，不再展示 usage summary，等这轮真正结束后再显示。
- 同步补了 runtime visibility 和 usage summary 的说明，避免后续把“等待中/统计框”误当成流式输出的一部分。

### Testing
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-assistant.tsx docs/agent-runtime-visibility.md docs/agent-usage-summary.md`
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit`
- `git diff --check -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-assistant.tsx docs/agent-runtime-visibility.md docs/agent-usage-summary.md progress.md` 退出码 0；仅有 CRLF/LF 提示。

### Notes
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx：等待状态在 assistant 已开始输出时不再继续挂载。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/chat-history.tsx`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-assistant.tsx：当前流式 assistant 的 usage summary 改为完成后再显示。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-assistant.tsx`。
- docs/agent-runtime-visibility.md：补充 waiting-for-model 的展示边界。回滚：`git checkout -- docs/agent-runtime-visibility.md`。
- docs/agent-usage-summary.md：补充 summary 只在本轮 settled 后显示。回滚：`git checkout -- docs/agent-usage-summary.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。

## 2026-07-19 - Task: context-too-large recovery does not stop when LLM compression aborts
### What was done
- 根据运行日志确认本次“跑着跑着停下”不是 UI 假死，而是 provider 返回 `context window exceeded` 后触发强制压缩，压缩模型随后 abort/超时，恢复链路直接落入可见错误。
- 在 `preflight` / `context-too-large` 这两类强制恢复路径中增加本地 emergency compression fallback：LLM 压缩失败时写入小型本地摘要并继续保留最近未压缩消息，避免任务直接停止在原始上下文超限错误上。
- 普通 post-step 后台压缩失败仍保持原行为，不把非强制压缩失败误包装成成功。
- 运行日志新增 `compression-emergency-fallback` 事件，便于后续区分“LLM 压缩成功”和“本地兜底压缩”。

### Testing
- `pnpm exec biome check --formatter-enabled=false packages/agent-core/src/agents/base-agent.ts`
- `pnpm -F @stagewise/agent-core build`
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit`
- `pnpm exec biome check --formatter-enabled=false packages/agent-core/src/agents/base-agent.ts docs/agent-context-compression.md docs/agent-runtime-visibility.md`
- `git diff --check -- packages/agent-core/src/agents/base-agent.ts docs/agent-context-compression.md docs/agent-runtime-visibility.md progress.md` 退出码 0；仅有 progress.md CRLF/LF 提示。

### Notes
- packages/agent-core/src/agents/base-agent.ts：强制压缩路径增加本地 emergency fallback，压缩模型 abort 时继续恢复下一轮。回滚：`git checkout -- packages/agent-core/src/agents/base-agent.ts`。
- docs/agent-context-compression.md：补充强制恢复路径的本地兜底说明。回滚：`git checkout -- docs/agent-context-compression.md`。
- docs/agent-runtime-visibility.md：补充 `compression-emergency-fallback` 日志事件说明。回滚：`git checkout -- docs/agent-runtime-visibility.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。

## 2026-07-19 - Task: 选择性合并 main 稳定性修复到 local

### What was done
- 按 `local` 优先原则审查 `main` 增量，跳过注册、帐号池、鉴权、API endpoint 探测、遥测、provider 架构、onboarding、网站内容、发布版本和提示词/记录类改动。
- 合入 LSP 关闭阶段的稳定性修复，降低服务关闭时出现未处理 stream 错误的风险，同时保留 `local` 已有 Biome Windows native binary 路径。
- 合入内容面板折叠状态下打开 plan/chat 链接的可见性修复，打开目标页前会先展开内容面板。
- 合入 workspace 默认分支偏好水合修复，解决 fallback `main` 与实际 `master` 等默认分支不一致时 source branch 没有更新的问题。
- 合入 symlink skill 目录发现修复，使符号链接到目录的 skill 能被识别。
- 已识别但未合入 `main` 对 `AGENTS.md`、两个 `soul.md` 和 `progress.md` 的改动，等待用户单独决定。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F @stagewise/agent-core test -- skills` 退出码 0，1 个 test file / 8 个 tests 全部通过。
- `pnpm -F stagewise exec vitest run src/ui/screens/main/agent-chat/chat/_components/workspace-action-config.test.ts` 退出码 0，1 个 test file / 8 个 tests 全部通过。
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/backend/services/toolbox/services/lsp/client.ts apps/browser/src/ui/components/streamdown/index.tsx apps/browser/src/ui/screens/main/_components/content-collapsed-context.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/footer-status-card/index.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-part-ui/tools/write/create-plan.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/workspace-action-config-utils.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/workspace-action-config.test.ts packages/agent-core/src/services/mount-manager/workspace-info/skills.ts packages/agent-core/src/services/mount-manager/workspace-info/skills.test.ts` 退出码 0。
- `git diff --check -- apps/browser/src/backend/services/toolbox/services/lsp/client.ts apps/browser/src/ui/components/streamdown/index.tsx apps/browser/src/ui/screens/main/_components/content-collapsed-context.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/footer-status-card/index.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-part-ui/tools/write/create-plan.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/workspace-action-config-utils.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/workspace-action-config.test.ts packages/agent-core/src/services/mount-manager/workspace-info/skills.ts packages/agent-core/src/services/mount-manager/workspace-info/skills.test.ts` 退出码 0。

### Notes
改动文件清单：
- apps/browser/src/backend/services/toolbox/services/lsp/client.ts：关闭 LSP 时跳过已销毁 stdin 的 Exit 写入，并接住超时后的 shutdown promise。回滚：`git checkout -- apps/browser/src/backend/services/toolbox/services/lsp/client.ts`。
- apps/browser/src/ui/components/streamdown/index.tsx：alt-click 打开 chat link 前展开内容面板。回滚：`git checkout -- apps/browser/src/ui/components/streamdown/index.tsx`。
- apps/browser/src/ui/screens/main/_components/content-collapsed-context.tsx：新增可选读取折叠状态的 hook，供可能缺少 provider 的渲染场景使用。回滚：`git checkout -- apps/browser/src/ui/screens/main/_components/content-collapsed-context.tsx`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/footer-status-card/index.tsx：打开 footer plan 前展开内容面板。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/footer-status-card/index.tsx`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-part-ui/tools/write/create-plan.tsx：打开新建 plan 卡片前展开内容面板。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-part-ui/tools/write/create-plan.tsx`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/workspace-action-config-utils.ts：source branch 默认值水合改用占位集合判断。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/workspace-action-config-utils.ts`。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/workspace-action-config.test.ts：补充 fallback `main` 与实际 source branch 不一致的回归测试。回滚：`git checkout -- apps/browser/src/ui/screens/main/agent-chat/chat/_components/workspace-action-config.test.ts`。
- packages/agent-core/src/services/mount-manager/workspace-info/skills.ts：skill 目录判断改为 stat 跟随 symlink。回滚：`git checkout -- packages/agent-core/src/services/mount-manager/workspace-info/skills.ts`。
- packages/agent-core/src/services/mount-manager/workspace-info/skills.test.ts：新增 symlink skill 发现回归测试。回滚：`Remove-Item -LiteralPath packages\agent-core\src\services\mount-manager\workspace-info\skills.test.ts`。
- progress.md：追加本轮合并与验证记录。回滚：删除本条记录。
统一回滚点：`git checkout -- apps/browser/src/backend/services/toolbox/services/lsp/client.ts apps/browser/src/ui/components/streamdown/index.tsx apps/browser/src/ui/screens/main/_components/content-collapsed-context.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/footer-status-card/index.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-part-ui/tools/write/create-plan.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/workspace-action-config-utils.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/workspace-action-config.test.ts packages/agent-core/src/services/mount-manager/workspace-info/skills.ts progress.md; Remove-Item -LiteralPath packages\agent-core\src\services\mount-manager\workspace-info\skills.test.ts`。

## 2026-07-20 - Task: OpenAI Responses missing item and slow shell polls
### What was done
- 修复 OpenAI Responses 路由复用上一轮 reasoning item 的问题：官方 OpenAI、OpenAI Responses 自定义端点、用户自定义 Responses 模型都不再向后续请求注入 `reasoningSignatureSource`，避免在 `store=false` 时携带已经不存在的 `rs_...` 引用。
- 将 `reasoningSignatureSource` 标记为可选，和 agent-core 已有的可选消费方式对齐。
- 缩短 shell follow-up 的等待体感：空命令轮询没有显式 `wait_until` 时约 2 秒返回；stdin 跟进默认约 3 秒返回，减少“Poll / Interrupt / Inspect”一串工具卡长时间挂起的情况。
- 更新运行诊断文档，记录 Responses reasoning replay 边界和 shell follow-up 超时策略。

### Testing
- `node node_modules/electron/install.js` 退出码 0；用于修复本机 Electron 缺少 `dist/electron.exe` 导致 browser 测试无法加载的问题。
- `pnpm -F stagewise test -- src/backend/agents/model-provider.test.ts` 退出码 0，1 个 test file / 37 个 tests 全部通过。
- `pnpm -F @stagewise/agent-shell test -- session-manager` 退出码 0，1 个 test file / 51 个 tests 全部通过。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F @stagewise/agent-shell typecheck` 退出码 0。
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/backend/agents/model-provider.ts apps/browser/src/backend/agents/model-provider.test.ts packages/agent-shell/src/engine/types.ts packages/agent-shell/src/engine/session-manager.ts packages/agent-shell/src/engine/session-manager.test.ts docs/agent-runtime-visibility.md` 退出码 0。
- `git diff --check` 退出码 0；仅有 CRLF/LF 提示。

### Notes
- apps/browser/src/backend/agents/model-provider.ts：OpenAI Responses 路由不再提供 reasoning replay source，并将 source 类型改为可选。回滚：`git checkout -- apps/browser/src/backend/agents/model-provider.ts`。
- apps/browser/src/backend/agents/model-provider.test.ts：新增 OpenAI Responses 三条路由的回归测试，并让测试 helper 支持 customModels。回滚：`git checkout -- apps/browser/src/backend/agents/model-provider.test.ts`。
- packages/agent-shell/src/engine/types.ts：新增空命令轮询默认超时并缩短 stdin 默认等待。回滚：`git checkout -- packages/agent-shell/src/engine/types.ts`。
- packages/agent-shell/src/engine/session-manager.ts：空命令轮询使用更短的默认 timeout。回滚：`git checkout -- packages/agent-shell/src/engine/session-manager.ts`。
- packages/agent-shell/src/engine/session-manager.test.ts：补充空命令轮询 timeout 选择测试。回滚：`git checkout -- packages/agent-shell/src/engine/session-manager.test.ts`。
- docs/agent-runtime-visibility.md：补充 Responses item 缺失排查点和 shell follow-up 超时策略。回滚：`git checkout -- docs/agent-runtime-visibility.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。

## 2026-07-20 - Task: shell follow-up prompt guidance
### What was done
- 同步更新 shell 工具描述，让模型知道空命令轮询是短快照，应重复轮询而不是主动拉长等待时间。

### Testing
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/backend/agents/model-provider.ts apps/browser/src/backend/agents/model-provider.test.ts packages/agent-shell/src/engine/types.ts packages/agent-shell/src/engine/session-manager.ts packages/agent-shell/src/engine/session-manager.test.ts packages/agent-shell/src/tools/execute-shell-command.ts docs/agent-runtime-visibility.md` 退出码 0。
- `pnpm -F @stagewise/agent-shell typecheck` 退出码 0。

### Notes
- packages/agent-shell/src/tools/execute-shell-command.ts：工具提示补充空命令轮询短快照说明。回滚：`git checkout -- packages/agent-shell/src/tools/execute-shell-command.ts`。
- progress.md：追加本轮记录。回滚：删除本条记录。

## 2026-07-21 - Task: PickStar Studio 品牌、包标识、主页、关于页与应用图标替换
### What was done
- 将浏览器应用展示名、窗口标题、打包基础名、Windows 元数据和包标识同步为 PickStar Studio / pickstar-studio / asia.pickstar。
- 将主页同步为 https://pickstar.asia，并在关于页移除主页下方其他版本列表，新增项目说明。
- 使用用户提供图片生成 dev、nightly、release 三套 PNG/ICO/ICNS 图标，并让前端 Logo 使用同一 PickStar 图标。
- 清理剩余前端可见 Stagewise 品牌文案，保留 pnpm workspace name、内部协议、内部 provider mode 和 @stagewise 包名。
### Testing
- `pnpm exec biome check --formatter-enabled=false ...` 退出码 0，检查本轮涉及的 23 个源码/配置文件通过。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise package:fast` 退出码 0，生成 `apps/browser/out/dev/pickstar-studio-win32-x64/pickstar-studio.exe`。
- 已读取打包 exe 元数据，确认 ProductName、FileDescription、CompanyName 均为 `PickStar Studio`，OriginalFilename/InternalName 为 `pickstar-studio.exe` / `pickstar-studio`。
- `git diff --check` 退出码 0；仅输出 CRLF/LF 提示，无空白错误。
### Notes
改动文件清单：
- `apps/browser/assets/icons/dev/icon-1024.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/dev/icon-128.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/dev/icon-16.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/dev/icon-256.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/dev/icon-32.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/dev/icon-48.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/dev/icon-512.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/dev/icon-64.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/dev/icon-96.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/dev/icon.icns`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/dev/icon.ico`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/dev/icon.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/nightly/icon-1024.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/nightly/icon-128.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/nightly/icon-16.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/nightly/icon-256.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/nightly/icon-32.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/nightly/icon-48.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/nightly/icon-512.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/nightly/icon-64.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/nightly/icon-96.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/nightly/icon.icns`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/nightly/icon.ico`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/nightly/icon.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/release/icon-1024.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/release/icon-128.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/release/icon-16.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/release/icon-256.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/release/icon-32.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/release/icon-48.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/release/icon-512.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/release/icon-64.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/release/icon-96.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/release/icon.icns`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/release/icon.ico`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/assets/icons/release/icon.png`：替换为 PickStar Studio 各尺寸打包图标。
- `apps/browser/build-constants.ts`：统一应用展示名、基础包名、包标识与主页常量。
- `apps/browser/etc/windows/windowsSign.ts`：同步 Windows 签名元数据主页。
- `apps/browser/forge.config.mts`：同步打包名称、安装器标题、元数据、主页与修复配置文件 UTF-8 注释。
- `apps/browser/package.json`：同步 productName、description、author 与 homepage，保留 workspace name。
- `apps/browser/src/backend/agents/chat/prompts/environment-preamble.md`：同步运行环境提示中的应用名称和项目来源说明。
- `apps/browser/src/backend/index.ts`：启动时使用统一应用名与包标识。
- `apps/browser/src/shared/coding-plans.ts`：同步编码套餐兜底免责声明中的产品名。
- `apps/browser/src/shared/credential-types/stagewise-auth.ts`：同步内置登录凭据的展示名与说明。
- `apps/browser/src/shared/personalization-themes.ts`：同步默认主题描述中的产品名。
- `apps/browser/src/ui/components/title-manager.tsx`：同步窗口标题。
- `apps/browser/src/ui/components/ui/logo-with-text.tsx`：同步带文字 Logo 为 PickStar Studio。
- `apps/browser/src/ui/components/ui/logo.tsx`：改为使用 PickStar Studio 图片图标。
- `apps/browser/src/ui/i18n/dict/chat.ts`：同步聊天相关可见文案中的产品名。
- `apps/browser/src/ui/i18n/dict/common.ts`：同步通用登录标题与按钮文案中的产品名。
- `apps/browser/src/ui/i18n/dict/file-tree.ts`：同步文件预览相关可见文案中的产品名。
- `apps/browser/src/ui/i18n/dict/onboarding.ts`：同步引导页可见文案中的产品名。
- `apps/browser/src/ui/i18n/dict/settings.ts`：同步设置页产品名并新增关于页项目说明文案。
- `apps/browser/src/ui/index.html`：同步 HTML 标题。
- `apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx`：同步模型帐号错误提示中的产品名。
- `apps/browser/src/ui/screens/main/content/_components/omnibox/index.tsx`：同步默认浏览器提示中的产品名。
- `apps/browser/src/ui/screens/main/content/_components/omnibox/internal-page-breadcrumbs.tsx`：同步内部页面面包屑产品名。
- `apps/browser/src/ui/screens/main/file-tree/file-preview-tab-content.tsx`：同步文件预览硬编码产品名并复用现有 i18n 文案。
- `apps/browser/src/ui/screens/settings/sections/about-section.tsx`：关于页改为 PickStar Studio，移除其他版本列表并展示项目说明。
- `apps/browser/src/ui/screens/settings/sections/agent-settings.worktree-setup.tsx`：同步 worktree 初始化脚本模板中的产品名。
- `apps/browser/assets/pages/pickstar-icon.png`：新增渲染层使用的 PickStar Studio 图标。
- `docs/pickstar-studio-branding.md`：新增 PickStar Studio 品牌和图标改动说明。
回滚方式：执行 `git checkout -- apps/browser/build-constants.ts apps/browser/etc/windows/windowsSign.ts apps/browser/forge.config.mts apps/browser/package.json apps/browser/src/backend/agents/chat/prompts/environment-preamble.md apps/browser/src/backend/index.ts apps/browser/src/shared/coding-plans.ts apps/browser/src/shared/credential-types/stagewise-auth.ts apps/browser/src/shared/personalization-themes.ts apps/browser/src/ui/components/title-manager.tsx apps/browser/src/ui/components/ui/logo-with-text.tsx apps/browser/src/ui/components/ui/logo.tsx apps/browser/src/ui/i18n/dict/chat.ts apps/browser/src/ui/i18n/dict/common.ts apps/browser/src/ui/i18n/dict/file-tree.ts apps/browser/src/ui/i18n/dict/onboarding.ts apps/browser/src/ui/i18n/dict/settings.ts apps/browser/src/ui/index.html apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx apps/browser/src/ui/screens/main/content/_components/omnibox/index.tsx apps/browser/src/ui/screens/main/content/_components/omnibox/internal-page-breadcrumbs.tsx apps/browser/src/ui/screens/main/file-tree/file-preview-tab-content.tsx apps/browser/src/ui/screens/settings/sections/about-section.tsx apps/browser/src/ui/screens/settings/sections/agent-settings.worktree-setup.tsx`，再执行 `git checkout -- apps/browser/assets/icons/dev apps/browser/assets/icons/nightly apps/browser/assets/icons/release`，删除 `apps/browser/assets/pages/pickstar-icon.png` 与 `docs/pickstar-studio-branding.md`，最后按需删除 `apps/browser/out/dev/pickstar-studio-win32-x64` 后重新打包。
- `progress.md`：追加本轮进度、验证与回滚记录。
  回滚：删除本条 PickStar Studio 记录。

## 2026-07-21 - Task: 认证页允许跳过进入主界面
### What was done
- 将 onboarding 认证步骤改为可跳过：用户未登录、未配置 API Key、未连接订阅时，右下角按钮显示“跳过，直接进入”。
- 点击跳过会直接标记 onboarding 已完成，并以 `unknown` 认证方式进入主对话界面，不再强制停在登录页。
- 同步补充中英文按钮文案和 PickStar Studio 品牌说明文档。

### Testing
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/ui/screens/onboarding/index.tsx apps/browser/src/ui/i18n/dict/onboarding.ts docs/pickstar-studio-branding.md` 退出码 0；Biome 当前配置只检查源码文件，docs markdown 被忽略。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `git diff --check -- apps/browser/src/ui/screens/onboarding/index.tsx apps/browser/src/ui/i18n/dict/onboarding.ts docs/pickstar-studio-branding.md progress.md` 退出码 0；仅输出 CRLF/LF 提示，无空白错误。

### Notes
- apps/browser/src/ui/screens/onboarding/index.tsx：认证步骤未满足登录条件时，底部下一步按钮改为跳过并直接完成 onboarding。回滚：`git checkout -- apps/browser/src/ui/screens/onboarding/index.tsx`。
- apps/browser/src/ui/i18n/dict/onboarding.ts：新增“跳过，直接进入”中英文文案。回滚：`git checkout -- apps/browser/src/ui/i18n/dict/onboarding.ts`。
- docs/pickstar-studio-branding.md：补充 onboarding 认证可跳过说明。回滚：`git checkout -- docs/pickstar-studio-branding.md` 或删除该文件中本轮小节。
- progress.md：追加本轮记录。回滚：删除本条记录。

## 2026-07-21 - Task: 移除 onboarding 共享用户内容复选框
### What was done
- 移除已登录认证页中的“共享可识别的聊天与使用数据”复选框和说明文案。
- 删除对应的 onboarding telemetry 文案键和前端状态/更新逻辑，避免 onboarding 引导用户开启 full telemetry。
- 同步更新 PickStar Studio 品牌说明文档，明确已登录 onboarding 只显示账号和切换邮箱入口。

### Testing
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/ui/screens/onboarding/steps/02-auth.tsx apps/browser/src/ui/i18n/dict/onboarding.ts docs/pickstar-studio-branding.md` 退出码 0；Biome 当前配置只检查源码文件，docs markdown 被忽略。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `git diff --check -- apps/browser/src/ui/screens/onboarding/steps/02-auth.tsx apps/browser/src/ui/i18n/dict/onboarding.ts docs/pickstar-studio-branding.md progress.md` 退出码 0；仅输出 CRLF/LF 提示，无空白错误。

### Notes
- apps/browser/src/ui/screens/onboarding/steps/02-auth.tsx：移除共享用户内容复选框、telemetry 状态和 preferences 更新调用。回滚：`git checkout -- apps/browser/src/ui/screens/onboarding/steps/02-auth.tsx`。
- apps/browser/src/ui/i18n/dict/onboarding.ts：删除 onboarding 共享用户内容相关文案键。回滚：`git checkout -- apps/browser/src/ui/i18n/dict/onboarding.ts`。
- docs/pickstar-studio-branding.md：补充已登录 onboarding 不再展示共享用户内容复选框。回滚：`git checkout -- docs/pickstar-studio-branding.md` 或删除该文件中本轮新增句子。
- progress.md：追加本轮记录。回滚：删除本条记录。

## 2026-07-21 - Task: 修复正在准备上下文卡住
### What was done
- 给环境上下文采集增加单个适配器超时隔离，某个业务环境采集挂起时不再阻塞整轮上下文准备。
- 给 `preparing-context` 阶段增加整体超时保护；完整上下文准备超时后自动记录运行轨迹，并用精简上下文重试，跳过环境快照、路径引用、文件内容注入和技能列表等可选增强，继续推进到模型请求。
- 补充运行可观测性文档，说明上下文准备降级和新增 trace 事件，便于后续排查同类卡住问题。

### Testing
- `pnpm exec biome check --formatter-enabled=false packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/env/contract.ts packages/agent-core/src/env/contract.test.ts docs/agent-runtime-visibility.md` 退出码 0；Biome 检查源码通过，markdown 被当前配置忽略。
- `pnpm -F @stagewise/agent-core test -- contract` 退出码 0；`src/env/contract.test.ts` 17 个测试通过。
- `pnpm -F @stagewise/agent-core exec tsc -p tsconfig.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit` 退出码 0。
- `git diff --check -- packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/env/contract.ts packages/agent-core/src/env/contract.test.ts docs/agent-runtime-visibility.md progress.md` 退出码 0；仅输出 CRLF/LF 提示，无空白错误。

### Notes
- packages/agent-core/src/agents/base-agent.ts：为上下文准备增加完整超时、精简上下文重试和 `context-preparation-timeout`、`context-env-capture-skipped`、`context-path-references-skipped` 运行轨迹。回滚：`git checkout -- packages/agent-core/src/agents/base-agent.ts`。
- packages/agent-core/src/env/contract.ts：为单个 domain adapter 状态采集增加 8 秒超时隔离。回滚：`git checkout -- packages/agent-core/src/env/contract.ts`。
- packages/agent-core/src/env/contract.test.ts：新增挂起 adapter 不阻塞健康 adapter 的回归测试。回滚：`git checkout -- packages/agent-core/src/env/contract.test.ts`。
- docs/agent-runtime-visibility.md：补充 `preparing-context` 阶段降级策略和新增 trace 事件说明。回滚：`git checkout -- docs/agent-runtime-visibility.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。

## 2026-07-22 - Task: 融合授权安全评估核心提示词
### What was done
- 在浏览器宿主主聊天 `soul.md` 中新增 Authorized Security Assessment Mode，合入用户提供的授权安全评估、OSINT、复现、高风险步骤标注和目标范围处理要求。
- 在 agent-core 默认主聊天 `soul.md` 中同步新增相同提示词内容，避免宿主未覆盖时回退到旧默认提示。
- 为浏览器宿主 `soul.md` 增加回归测试，确认授权安全评估段落、OSINT 文案、风险等级和紧急回滚建议要求存在。
- 同步更新 `docs/unrestricted-technical-prompts.md`，记录主聊天系统提示词的新增行为范围。

### Testing
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/backend/agents/chat/prompts/soul.test.ts apps/browser/src/backend/agents/chat/prompts/soul.md packages/agent-core/src/agents/chat/prompts/soul.md docs/unrestricted-technical-prompts.md` 退出码 0；Biome 检查源码通过，markdown 被当前配置忽略。
- `pnpm -F stagewise test -- soul` 退出码 0；`src/backend/agents/chat/prompts/soul.test.ts` 2 个测试通过。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F @stagewise/agent-core exec tsc -p tsconfig.json --noEmit` 退出码 0。
- `git diff --check -- apps/browser/src/backend/agents/chat/prompts/soul.md packages/agent-core/src/agents/chat/prompts/soul.md docs/unrestricted-technical-prompts.md apps/browser/src/backend/agents/chat/prompts/soul.test.ts progress.md` 退出码 0；仅输出 CRLF/LF 提示，无空白错误。

### Notes
- apps/browser/src/backend/agents/chat/prompts/soul.md：新增浏览器宿主主聊天授权安全评估模式段落。回滚：`git checkout -- apps/browser/src/backend/agents/chat/prompts/soul.md`。
- packages/agent-core/src/agents/chat/prompts/soul.md：同步新增 agent-core 默认主聊天授权安全评估模式段落。回滚：`git checkout -- packages/agent-core/src/agents/chat/prompts/soul.md`。
- apps/browser/src/backend/agents/chat/prompts/soul.test.ts：新增授权安全评估提示词存在性测试。回滚：`git checkout -- apps/browser/src/backend/agents/chat/prompts/soul.test.ts`。
- docs/unrestricted-technical-prompts.md：记录新增授权安全评估提示词范围。回滚：`git checkout -- docs/unrestricted-technical-prompts.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。

## 2026-07-22 - Task: 融入 Codex 外层最终汇报规范
### What was done
- 将“业务结论、原因、风险、下一步、已验证通过、本轮改动文件”的 Codex 外层汇报规范翻译成英文，并合入浏览器宿主主聊天 `soul.md`。
- 在 agent-core 默认主聊天 `soul.md` 同步新增相同的最终任务汇报格式，保证宿主覆盖和默认回退路径一致。
- 更新浏览器宿主 `soul.md` 测试，覆盖始终中文回复、授权安全评估提示词和 business-first final task report format。
- 同步更新提示词说明文档，记录最终汇报格式和当前“始终中文回复”的实际规则。

### Testing
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/backend/agents/chat/prompts/soul.test.ts apps/browser/src/backend/agents/chat/prompts/soul.md packages/agent-core/src/agents/chat/prompts/soul.md docs/unrestricted-technical-prompts.md` 退出码 0；Biome 检查源码通过，markdown 被当前配置忽略。
- `pnpm -F stagewise test -- soul` 退出码 0；`src/backend/agents/chat/prompts/soul.test.ts` 3 个测试通过。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `pnpm -F @stagewise/agent-core exec tsc -p tsconfig.json --noEmit` 退出码 0。
- `git diff --check -- apps/browser/src/backend/agents/chat/prompts/soul.md packages/agent-core/src/agents/chat/prompts/soul.md apps/browser/src/backend/agents/chat/prompts/soul.test.ts docs/unrestricted-technical-prompts.md progress.md` 退出码 0；仅输出 CRLF/LF 提示，无空白错误。

### Notes
- apps/browser/src/backend/agents/chat/prompts/soul.md：新增英文最终任务汇报格式，并要求中文响应使用“业务结论、原因、风险、下一步、已验证通过、本轮改动文件”标题。回滚：`git checkout -- apps/browser/src/backend/agents/chat/prompts/soul.md`。
- packages/agent-core/src/agents/chat/prompts/soul.md：同步新增 agent-core 默认最终任务汇报格式。回滚：`git checkout -- packages/agent-core/src/agents/chat/prompts/soul.md`。
- apps/browser/src/backend/agents/chat/prompts/soul.test.ts：更新旧语言断言并新增最终汇报格式存在性测试。回滚：`git checkout -- apps/browser/src/backend/agents/chat/prompts/soul.test.ts`。
- docs/unrestricted-technical-prompts.md：记录最终汇报格式，并同步当前始终中文回复规则。回滚：`git checkout -- docs/unrestricted-technical-prompts.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。

## 2026-07-22 - Task: 放宽高上下文高推理请求的静默流 watchdog
### What was done
- 排查用户截图中的 `LLM stream stalled`：日志显示第一轮模型请求正常完成并发起 3 个工具调用，第二轮 `https://subapi.pickstar.asia/v1/responses` 请求在 120 秒内没有任何响应事件，随后被本地 step activity watchdog 主动中止；同期还有 `fetch failed` 和订阅查询超时，说明网络/代理/上游卡住概率较高。
- 将模型流静默 watchdog 从固定 120 秒改为动态阈值：基础仍为 120 秒，但大上下文、高 reasoning、自定义 provider、显式请求超时会自动增加等待时间，避免 GPT-5.5 High + 30 万以上上下文时被过早误杀。
- 新增 `step-activity-timeout` runtime trace，并在 `stream-request-start` 中记录 `activityTimeoutMs`、`estimatedTokens`、`contextWindowTokens`，后续能直接判断实际阈值和触发原因。
- 错误文案从固定 “120 seconds” 改为按实际 watchdog 阈值输出。
- 同步运行可观测性文档和回归测试。截图场景对应的 322k tokens + custom provider + high reasoning 会将静默阈值放宽到 360 秒。

### Testing
- `pnpm -F @stagewise/agent-core test -- goal-continuation` 退出码 0；`src/agents/chat/goal-continuation.test.ts` 13 个测试通过。
- `pnpm exec biome check --formatter-enabled=false packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/agents/chat/goal-continuation.test.ts docs/agent-runtime-visibility.md` 退出码 0；Biome 检查源码通过，markdown 被当前配置忽略。
- `pnpm -F @stagewise/agent-core exec tsc -p tsconfig.json --noEmit` 退出码 0。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit` 退出码 0。
- `git diff --check -- packages/agent-core/src/agents/base-agent.ts packages/agent-core/src/agents/chat/goal-continuation.test.ts docs/agent-runtime-visibility.md progress.md` 退出码 0；仅输出 CRLF/LF 提示，无空白错误。

### Notes
- packages/agent-core/src/agents/base-agent.ts：新增动态 step activity watchdog 阈值、实际秒数错误文案、`step-activity-timeout` trace 和 `stream-request-start` 阈值字段。回滚：`git checkout -- packages/agent-core/src/agents/base-agent.ts`。
- packages/agent-core/src/agents/chat/goal-continuation.test.ts：补充 HostPaths mock，并新增大上下文 high reasoning custom provider 阈值回归测试。回滚：`git checkout -- packages/agent-core/src/agents/chat/goal-continuation.test.ts`。
- docs/agent-runtime-visibility.md：记录动态 watchdog、`activityTimeoutMs` 和 `step-activity-timeout` 排查方式。回滚：`git checkout -- docs/agent-runtime-visibility.md`。
- progress.md：追加本轮记录。回滚：删除本条记录。

## 2026-07-23 - Task: add custom provider max context setting
### What was done
- Added an optional model max context field to the custom provider configuration dialog.
- Persisted the value on custom endpoints and used it when built-in models are routed through that custom provider, so compression and context preflight use the configured window instead of the built-in default.
- Added a regression test and updated the context-compression documentation to describe the custom provider override.

### Testing
- `pnpm exec biome check --formatter-enabled=false apps/browser/src/ui/screens/settings/sections/custom-providers-section.tsx apps/browser/src/ui/i18n/dict/settings.ts apps/browser/src/shared/karton-contracts/ui/shared-types.ts apps/browser/src/backend/agents/model-provider.ts apps/browser/src/backend/agents/model-provider.test.ts docs/agent-context-compression.md`
- `pnpm -F stagewise test -- model-provider`
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit`
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit`

### Notes
- `apps/browser/src/shared/karton-contracts/ui/shared-types.ts`: added optional `contextWindowSize` to custom endpoint schema.
- `apps/browser/src/ui/screens/settings/sections/custom-providers-section.tsx`: added the dialog input, validation, dirty-state tracking, and save persistence for the endpoint context window.
- `apps/browser/src/ui/i18n/dict/settings.ts`: added Chinese and English labels, description, and validation copy for the new field.
- `apps/browser/src/backend/agents/model-provider.ts`: custom-routed built-in models now use the endpoint context override when present.
- `apps/browser/src/backend/agents/model-provider.test.ts`: added coverage proving a custom endpoint context override reaches `ModelWithOptions.contextWindowSize`.
- `docs/agent-context-compression.md`: documented that the custom provider context setting controls context accounting and automatic compression triggers.
- Rollback: restore the five task-only files with `git restore -- apps/browser/src/shared/karton-contracts/ui/shared-types.ts apps/browser/src/ui/screens/settings/sections/custom-providers-section.tsx apps/browser/src/backend/agents/model-provider.ts apps/browser/src/backend/agents/model-provider.test.ts docs/agent-context-compression.md`; in `apps/browser/src/ui/i18n/dict/settings.ts`, remove only the four `settings.customProviders.dialog.contextWindow*` entries to avoid discarding earlier unrelated branding edits already present in that file.
- Additional validation: `git diff --check -- apps/browser/src/shared/karton-contracts/ui/shared-types.ts apps/browser/src/ui/screens/settings/sections/custom-providers-section.tsx apps/browser/src/ui/i18n/dict/settings.ts apps/browser/src/backend/agents/model-provider.ts apps/browser/src/backend/agents/model-provider.test.ts docs/agent-context-compression.md progress.md` exited 0; output only CRLF/LF normalization warnings.
