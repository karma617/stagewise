## 2026-06-26 - Task: Merge origin/main into local

### What was done
- Fetched `origin/main` and merged it into the current `local` branch.
- The merge completed without conflicts and preserved the existing local commit history.

### Testing
- Verified `git status --short --branch` reports a clean `local` branch after the merge.
- Verified the latest commit is the merge commit `ac20f89a`.

### Notes
- Changed files: repository merge result plus this `progress.md` audit entry.
- Rollback point: use `git revert -m 1 ac20f89a` to revert the merge commit if needed.

## 2026-06-26 - Task: Align auto-registration with silent console email login

### What was done
- Changed auto-registration to use a silent console-origin email OTP flow that returns `set-auth-token` directly instead of opening the system browser.
- Added optional captcha token plumbing through the auto-register RPC and quota auto-switch RPC.
- Updated the auto-register settings page and quota-limit auto-switch UI to solve Turnstile invisibly and pass the token to the backend.

### Testing
- Ran `npx -y pnpm@10.30.3 --filter stagewise exec tsc --noEmit`; no TypeScript errors were reported.
- Ran `npx -y pnpm@10.30.3 --filter stagewise make`; Electron Forge completed successfully.
- Verified the new Squirrel installer was generated at `apps/browser/out/dev/make/squirrel.windows/stagewise-dev-1.13.0-x64-setup.exe`.

### Notes
- Changed files: `apps/browser/src/backend/services/auth/server-interop.ts` adds silent console OTP helpers.
- Changed files: `apps/browser/src/backend/services/auth/index.ts` routes auto-registration through the silent OTP token flow.
- Changed files: `apps/browser/src/shared/karton-contracts/ui/index.ts` updates RPC signatures for optional captcha tokens.
- Changed files: `apps/browser/src/ui/screens/settings/sections/auto-register-section.tsx` passes an invisible Turnstile token to auto-register.
- Changed files: `apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx` passes an invisible Turnstile token during quota auto-switch.
- Rollback point: revert the file changes above, or reset to the commit before these working tree edits if they are committed later.

## 2026-06-26 - Task: Add proxy pool and registration fingerprint routing

### What was done
- Added a proxy pool settings page aligned with the reference project's add/read model: batch import, region label, duplicate skipping, active/disabled state, and success/fail counters.
- Stored proxy pool entries as JSON objects while preserving old plain-text proxy list migration.
- Updated auto-registration network routing so registration randomly selects one active proxy when the pool is configured; with no pool entry, requests use the default runtime network path.
- Added per-registration randomized request fingerprint headers and reused the same selected proxy/fingerprint through mailbox, OTP send, and OTP verify requests.

### Testing
- Ran `npx -y pnpm@10.30.3 exec biome check apps/browser/src/ui/screens/settings/sections/proxy-pool-section.tsx apps/browser/src/backend/services/auth/registration-network.ts`; no issues were reported after the fix.
- Ran `npx -y pnpm@10.30.3 --filter stagewise exec tsc --noEmit`; no TypeScript errors were reported.
- Ran `npx -y pnpm@10.30.3 --filter stagewise make`; Electron Forge completed successfully.
- Verified the refreshed Squirrel installer exists at `apps/browser/out/dev/make/squirrel.windows/stagewise-dev-1.13.0-x64-setup.exe`.
- Full live registration was not completed in this terminal run because it requires the app UI to obtain a real Turnstile token and consume a live mailbox account.

### Notes
- Changed files: `apps/browser/src/ui/screens/settings/sections/proxy-pool-section.tsx` implements the proxy pool object list UI and localStorage migration.
- Changed files: `apps/browser/src/backend/services/auth/registration-network.ts` adds fingerprint creation, proxy parsing, active-proxy filtering, random proxy picking, and proxied fetch.
- Changed files: `apps/browser/src/backend/services/auth/index.ts` wires selected proxy and fingerprint into one auto-registration run.
- Changed files: `apps/browser/src/backend/services/auth/mailbox-pool.ts` routes mailbox API calls through the selected registration proxy.
- Changed files: `apps/browser/package.json` and `pnpm-lock.yaml` add the `undici` dependency used for proxy dispatch.
- Rollback point: remove the proxy pool settings route/page, revert `registration-network.ts`, and restore auto-registration calls to direct `fetch` without selected proxy/fingerprint.

## 2026-06-26 - Task: Add batch auto-registration task to account pool

### What was done
- Added a background batch registration feature to the account pool page so the user can register N spare accounts at once without disturbing the currently signed-in session.
- Added three new RPC procedures in the karton contract: `autoRegisterBatch`, `getBatchTaskStatus`, and `cancelBatchTask`.
- Implemented a backend `registerToPoolOnly` path that runs the silent OTP registration flow but only persists the new account into the pool (no credential switch, no session refresh), so the active user keeps working.
- Implemented `startBatchTask` which returns a task id immediately and runs the registration loop detached on the main process; each round registers one account, appends to the pool, then waits the configured interval before the next round. Progress (done/failed/logs/emails) is stored in memory and polled by the renderer.
- Rewrote the account pool settings page to add an "open auto task" button, a modal dialog (registration count, per-round delay defaulting to 2000ms, Turnstile container), and a live progress panel with cancel/close controls that polls `getBatchTaskStatus` every 2 seconds and refreshes the pool list when the task finishes.
- Bumped the app version to 1.14.0 and produced a new Windows installer.

### Testing
- Ran `npx -y pnpm@10.30.3 exec biome check --write` over the changed contract, backend, and frontend files; Biome auto-fixed formatting and reported no blocking errors.
- Ran `npx -y pnpm@10.30.3 --filter stagewise exec tsc --noEmit`; TypeScript reported no errors.
- Ran `npx -y pnpm@10.30.3 --filter stagewise make`; Electron Forge completed successfully.
- Verified the Squirrel installer exists at `apps/browser/out/dev/make/squirrel.windows/stagewise-dev-1.14.0-x64-setup.exe` (approx. 205 MB).
- End-to-end live batch registration was not executed in this terminal run because it requires the app UI to obtain a real Turnstile token and consume live mailbox-pool accounts.

### Notes
- Changed files: `apps/browser/src/shared/karton-contracts/ui/index.ts` adds the three batch-task RPC signatures to `userAccount` server procedures.
- Changed files: `apps/browser/src/backend/services/auth/index.ts` adds the `batchTasks` field, registers/removes the three handlers, and implements `registerToPoolOnly`, `startBatchTask`, `runBatchLoop`, `getBatchTaskStatus`, and `cancelBatchTask`.
- Changed files: `apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx` rewrites the page to add the auto-task button, modal, and polling progress panel while keeping the existing pool list, switch, and remove actions.
- Changed files: `apps/browser/package.json` bumps the version to 1.14.0.
- Rollback point: revert the file changes above, or run `git checkout -- <files>` for the modified files and delete the new methods/handlers; the batch feature is additive and does not alter existing single-account registration or switching behavior.


## 2026-06-26 - Task: Account 页面报错修复 + 代理池乱码修复 + i18n 界面语言切换

### What was done
- 修复 account-section.tsx 编译错误：AccountSection 组件缺少 logout 和 openSettings 定义（tsc 必然报错）；已从 useKartonProcedure 获取 p.userAccount.logout 和 p.appScreen.openSettings。
- 修复 account-section.tsx 两处模板字符串乱码 bug：RegisterAndLoginView 中 appendLog 的「注册失败」和「注册异常」行的全角冒号 U+FF1A 被写成了 GBK 乱码字节（显示为「锛?」），且变量插值 ${...} 丢失了 $ 符号导致 msg 变量未引用；已替换为干净的 \uXXXX 转义字符串拼接，后由 Biome 统一为模板字符串。
- 修复 proxy-pool-section.tsx placeholder 属性乱码：地区标记输入框 placeholder 使用了双引号 JSX 属性值 placeholder="\u5730\u533a..."，在 JSX 中双引号属性值不解码 \uXXXX 转义，导致界面显示原始 \u 字符串；已改为 placeholder={'\u5730\u533a...'} 表达式形式。
- 新增 i18n 界面语言切换：在 globalConfigSchema 添加 appLanguageSchema（zh-CN/en，默认 zh-CN），创建 use-i18n.ts hook 含轻量翻译字典，General 设置页新增 LanguageSetting 组件（中/英下拉选择），GeneralSettingsSection 和 PowerSaveBlockerSetting 标题/描述接入 i18n。
- 版本号从 1.14.0 升至 1.15.0，打包生成 stagewise-dev-1.15.0-x64-setup.exe。

### Testing
- Biome check: 4 files checked, no fixes needed (format pass)
- tsc --noEmit: 零错误通过
- 打包: squirrel.windows/stagewise-dev-1.15.0-x64-setup.exe (205,278,208 bytes) 生成成功

### Notes
改动文件清单：
- apps/browser/src/ui/screens/settings/sections/account-section.tsx: 添加 logout/openSettings procedure 定义；修复 RegisterAndLoginView 两处模板字符串乱码
- apps/browser/src/ui/screens/settings/sections/proxy-pool-section.tsx: 修复 placeholder 属性双引号 \uXXXX 乱码
- apps/browser/src/shared/karton-contracts/ui/shared-types.ts: 添加 appLanguageSchema、AppLanguage 类型，globalConfigSchema 添加 appLanguage 字段
- apps/browser/src/ui/hooks/use-i18n.ts: 新建 i18n hook，含 zh-CN/en 翻译字典
- apps/browser/src/ui/screens/settings/sections/general-settings-section.tsx: 添加 LanguageSetting 组件，GeneralSettingsSection 和 PowerSaveBlockerSetting 接入 i18n
- apps/browser/package.json: 版本号 1.14.0 -> 1.15.0
回滚点: git checkout -- apps/browser/src/ui/screens/settings/sections/account-section.tsx apps/browser/src/ui/screens/settings/sections/proxy-pool-section.tsx apps/browser/src/ui/screens/settings/sections/general-settings-section.tsx apps/browser/src/shared/karton-contracts/ui/shared-types.ts apps/browser/package.json; rm apps/browser/src/ui/hooks/use-i18n.ts


## 2026-06-26 - Task: 修复自动注册配置“测试连接”报错
### What was done
“测试连接”按钮之前只传 { apiUrl, apiKey } 给后端，缺 adminPassword/groupId 等字段。外部 API /api/external/accounts 返回 404 时回退 admin 登录路径会因 adminPassword 为空抛 “Admin password not configured” 。现已将契约、后端、前端三处统一为传递完整 MailboxPoolConfig，测试连接可走通 admin 回退。
### Testing
- tsc --noEmit -p apps/browser/tsconfig.json：零错误通过
- 实测邮箱后端 admin 链路：POST /login 200 -> GET /api/csrf-token -> GET /api/accounts?group_id=4 200，返回账号列表
### Notes
改动文件清单：
- apps/browser/src/shared/karton-contracts/ui/index.ts: testMailboxConnection 契约 cfg 补充 adminPassword/groupId/tagIds/emailFolder/emailTop/pollIntervalMs/proxyPool 可选字段
- apps/browser/src/backend/services/auth/index.ts: testMailboxConnection 后竫参数类型从 { apiUrl, apiKey } 改为 MailboxPoolConfig，移除多余 as 转换
- apps/browser/src/ui/screens/settings/sections/auto-register-section.tsx: 测试连接调用改为传递完整 cfg
回滚点: git checkout -- apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/backend/services/auth/index.ts apps/browser/src/ui/screens/settings/sections/auto-register-section.tsx

## 2026-06-26 - Task: 加速 apps/browser 本地打包（FAST_BUILD 开关）
### What was done
为本地高频打包新增 FAST_BUILD=1 开关：
- forge.config.mts 顶部新增 __FAST_BUILD__，rebuildConfig.force 改为受其控制（CI 不设此变量，强制 rebuild 行为不变）
- 6 个 vite 配置（ui/pages/backend/ui-preload/web-content-preload/sandbox-worker）的 sourcemap 改为 FAST_BUILD=1 时关闭，仍默认 hidden
- apps/browser/package.json 新增脚本 package:fast，等同于 cross-env FAST_BUILD=1 跑 electron-forge package
使用：本地日常构建跑 pnpm package:fast（仅产 out 目录可执行，无安装包、无 sourcemap、不重编原生模块）；正式发布仍走 pnpm make。

### Testing
- tsc 解析 6 个 vite 配置 + forge.config.mts：零错误通过
- $env:FAST_BUILD=1; npx tsx apps/browser/forge.config.mts 实际加载：日志输出 "[forge.config] FAST_BUILD=1: skip native rebuild force, skip sourcemaps"，确认开关在配置层生效
- 未执行端到端 pnpm package:fast 全量跑（耗时长且需要 .env），由用户实际触发验证耗时下降

### Notes
改动文件清单：
- apps/browser/forge.config.mts：注入 __FAST_BUILD__ 常量与启动日志；rebuildConfig.force 由 true 改为 !__FAST_BUILD__
- apps/browser/vite.ui.config.ts：sourcemap 受 FAST_BUILD 控制
- apps/browser/vite.pages.config.ts：同上
- apps/browser/vite.backend.config.ts：同上
- apps/browser/vite.ui-preload.config.ts：同上
- apps/browser/vite.web-content-preload.config.ts：同上
- apps/browser/vite.sandbox-worker.config.ts：同上
- apps/browser/package.json：scripts 新增 package:fast
回滚点: git checkout -- apps/browser/forge.config.mts apps/browser/vite.ui.config.ts apps/browser/vite.pages.config.ts apps/browser/vite.backend.config.ts apps/browser/vite.ui-preload.config.ts apps/browser/vite.web-content-preload.config.ts apps/browser/vite.sandbox-worker.config.ts apps/browser/package.json

## 2026-06-26 - Task: typecheck 走 turbo 复用缓存
### What was done
将 apps/browser 的 typecheck 脚本里前置的 pnpm -F @stagewise/agent-core build && pnpm -F @stagewise/agent-shell build 替换为 pnpm -w turbo run build --filter=@stagewise/agent-core --filter=@stagewise/agent-shell，命中 turbo cache 时这两包构建近似零成本，未命中时与原行为等价（输出 dist/**）。
make/package/package:fast 不引入新的前置构建步骤，避免反向增加耗时；bundle:eslint 脚本第 57-60 行已自带"产物存在则跳过"逻辑，无需改造。

### Testing
- pnpm -w turbo run build --filter=@stagewise/agent-core --filter=@stagewise/agent-shell --dry=json：turbo 正常解析 filter，无报错
- 未执行真实 typecheck 全量跑（耗时较长），由用户实际触发验证 cache 命中

### Notes
改动文件清单：
- apps/browser/package.json：仅 typecheck 脚本改走 turbo，其他脚本未动
回滚点: git checkout -- apps/browser/package.json

## 2026-06-26 - Task: 原生依赖硬链接 + 一键打包脚本
### What was done
FAST_BUILD 模式下用文件硬链接替代 copyNativeDependencies 的递归 fs.cpSync：
- forge.config.mts 新增 hardlinkRecursive 工具函数：目录递归 mkdir、文件 fs.linkSync，软链接退回 cpSync，跨卷或文件系统不支持时 fallback 到 fs.copyFileSync
- copyNativeDependencies 函数体内 FAST_BUILD=1 时走 hardlinkRecursive，否则维持原 fs.cpSync 行为，CI 路径零变化
- packagerConfig.prune 由 true 改为 !__FAST_BUILD__，FAST_BUILD 下跳过 electron-packager 的依赖 prune（vite bundle 后 prune 无意义且耗时）

新增一键打包脚本 build-fast.bat（放在 stagewise/ 仓库根）：
- 纯 ASCII 内容，规避 Windows 控制台中文乱码
- 双击运行：自动 cd 到脚本所在目录 -> pushd apps/browser -> 跑 pnpm package:fast -> 显示开始/结束时间、产物路径、按任意键关闭
- 若 pnpm 不在 PATH 则直接报错并暂停

### Testing
- $env:FAST_BUILD=1; npx tsx apps/browser/forge.config.mts：配置加载日志包含 "FAST_BUILD=1: skip native rebuild force, skip sourcemaps"，hardlinkRecursive 与 prune 改动通过 TS 解析
- 未执行端到端 pnpm package:fast 全量跑（耗时较长且需要 .env），由用户双击 build-fast.bat 实测

### Notes
改动文件清单：
- apps/browser/forge.config.mts：新增 hardlinkRecursive 工具函数；copyNativeDependencies 函数体内分支化；packagerConfig.prune 受 __FAST_BUILD__ 控制
- build-fast.bat（新增）：一键打包脚本，双击执行 pnpm package:fast
回滚点: git checkout -- apps/browser/forge.config.mts; rm build-fast.bat

## 2026-06-30 - Task: 提升 Camoufox 跨机器启动稳定性
### What was done
针对另一台电脑上 Camoufox 启动即失败的问题，补了两层保障：
- Camoufox 新建页面时禁用 Playwright 默认视口模拟，避免旧/新协议不一致时下发 `viewport.isMobile=false` 导致 `Browser.setDefaultViewport` 失败。
- `build-fast.bat` 在快速打包前准备 Camoufox 随包资源，并在打包成功后把整个 `apps/browser/assets/camoufox` 目录同步到 packaged `resources/camoufox`，后续新增同类外挂资源不需要再单独改复制单文件逻辑。

### Testing
- `py -3.12 -m py_compile apps/browser/src/backend/services/auth/camoufox-ui-flow.py`：通过。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit`：通过。
- 等价执行 `build-fast.bat` 中 Camoufox 资源同步命令：通过，确认 `apps/browser/out/dev/stagewise-dev-win32-x64/resources/camoufox/GeoLite2-City.mmdb` 存在，大小 66164133 字节。

### Notes
改动文件清单：
- build-fast.bat：快速打包前准备 Camoufox 资源，打包后将整个 Camoufox 资源目录复制到 packaged resources。
- apps/browser/src/backend/services/auth/camoufox-ui-flow.py：新建 Camoufox 页面时优先使用 `no_viewport=True`，规避默认视口协议字段不兼容。
- docs/camoufox-packaging.md：记录 Camoufox 随包资源准备、复制位置和运行期使用方式。
- progress.md：追加本轮施工与验证记录。

回滚点: git checkout -- build-fast.bat apps/browser/src/backend/services/auth/camoufox-ui-flow.py progress.md; rm docs/camoufox-packaging.md

## 2026-06-30 - Task: 修正 Camoufox setDefaultViewport 启动失败
### What was done
上一轮使用 `browser.new_page(no_viewport=True)` 仍可能被 Camoufox/Playwright 内部转换成默认上下文视口设置，不能稳定规避 `Browser.setDefaultViewport` 下发 `viewport.isMobile=false` 的问题。本轮改为先显式创建 `browser.new_context(no_viewport=True)`，再调用 `context.new_page()`，把禁用默认视口前移到上下文创建阶段，避免继续走 `browser.new_page()` 的默认视口路径。

### Testing
- `py -3.12 -m py_compile apps/browser/src/backend/services/auth/camoufox-ui-flow.py`：通过。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit`：通过。
- 用本地猴子补丁验证 `run_browser_flow` 调用路径：通过，确认调用 `browser.new_context({'no_viewport': True})` 和 `context.new_page()`，且不调用 `browser.new_page()`。

### Notes
改动文件清单：
- apps/browser/src/backend/services/auth/camoufox-ui-flow.py：将 Camoufox 页面创建从 `browser.new_page(...)` 改为 `browser.new_context(no_viewport=True)` 后 `context.new_page()`。
- progress.md：追加本轮更正与验证记录。

回滚点: git checkout -- apps/browser/src/backend/services/auth/camoufox-ui-flow.py progress.md

## 2026-06-30 - Task: 帐号池列表加载提示
### What was done
帐号池页面首次进入时也会进入 loading 状态，并在列表区域显示“正在读取帐号列表....”。刷新按钮触发读取时沿用同一个提示，避免页面停在旧内容或空白区域时用户误以为没有响应。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit`：通过。

### Notes
改动文件清单：
- apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx：首次读取帐号池时设置 loading，并在列表区域显示读取提示。
- apps/browser/src/ui/i18n/dict/settings.ts：新增 `settings.accountPool.loading` 文案。
- progress.md：追加本轮施工与验证记录。

回滚点: git checkout -- apps/browser/src/ui/screens/settings/sections/account-pool-section.tsx apps/browser/src/ui/i18n/dict/settings.ts progress.md

## 2026-06-30 - Task: 注册网络请求统一 fallback 链路
### What was done
补齐注册过程中网络请求的代理 fallback：
- Stagewise 静默发码/验码接口改为走 `fetchWithRegistrationFallback`，按当前代理、系统代理、直连依次尝试。
- 2captcha、CapSolver、YesCaptcha 的提交和轮询请求改为统一 fallback；Playwright stealth 模式也会按候选网络重试。
- Camoufox 真实浏览器页面模式支持多个网络候选，`Page.goto` 等网络中断类错误会自动用下一条链路重启浏览器流程。
- `NS_ERROR_NET_INTERRUPT`、代理连接拒绝、连接 reset/timeout、`Page.goto` 网络错误归类为本地网络/环境错误，批量静默路径不再把这类失败领取到的邮箱标为无效，而是释放 claim。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit`：通过。
- 搜索核心注册 TS 文件中的裸 `fetch(` / 直接 `fetchWithRegistrationNetwork(` 调用：未发现残留。

### Notes
改动文件清单：
- apps/browser/src/backend/services/auth/registration-network.ts：抽出注册网络候选列表和展示标签，fallback 复用同一候选生成逻辑。
- apps/browser/src/backend/services/auth/server-interop.ts：Stagewise 发码/验码接口改走 fallback。
- apps/browser/src/backend/services/auth/captcha-providers.ts：第三方验证码服务请求和 Playwright stealth 网络访问改走 fallback。
- apps/browser/src/backend/services/auth/browser-ui-flow.ts：Camoufox 外部浏览器流程支持网络候选重试。
- apps/browser/src/backend/services/auth/index.ts：生成并传递注册网络候选，补网络链路日志，扩展环境错误分类，避免网络中断误伤邮箱。
- progress.md：追加本轮施工与验证记录。

回滚点: git checkout -- apps/browser/src/backend/services/auth/registration-network.ts apps/browser/src/backend/services/auth/server-interop.ts apps/browser/src/backend/services/auth/captcha-providers.ts apps/browser/src/backend/services/auth/browser-ui-flow.ts apps/browser/src/backend/services/auth/index.ts progress.md

## 2026-06-30 - Task: 选择性合并 main 正向修复到 local
### What was done
从 `main` 中只合入低风险正向 UI 修复：设置页切换不再触发 agent 自动选择逻辑误重置，默认侧栏宽度加宽，终端创建和切换后会请求聚焦。未合入反馈问卷、用户使用统计、telemetry、Token Plan/API 校验、release 版本变更，以及注册、帐号池、代理池、验证码、邮箱和风控相关改动。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit`：通过。
- `git diff --cached --name-only | rg "auth|account-pool|auto-register|proxy-pool|captcha|mailbox|registration|telemetry|posthog|experience|validate-api|coding-plans"`：无输出，确认本轮暂存合并不包含排除范围文件。

### Notes
改动文件清单：
- apps/browser/src/ui/hooks/use-auto-select-agent.tsx：限制 agent 自动选择只在主界面生效，避免切换设置页时误清空当前 agent。
- apps/browser/src/ui/screens/main/_components/sidebar-panel-config.ts：加宽默认展开侧栏，减少默认视图拥挤。
- apps/browser/src/ui/screens/main/_components/agent-hotkey-bindings.tsx：移除快捷键创建终端后的重复聚焦请求，交给终端创建链路统一处理。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/workspace-select.tsx：从工作区卡片创建终端后请求聚焦新终端。
- apps/browser/src/ui/screens/main/content/index.tsx：切换到终端 tab 或创建终端 tab 后请求聚焦。
- apps/browser/src/ui/screens/main/index.tsx：主布局打开终端后请求聚焦新终端。
- progress.md：追加本轮选择性合并与验证记录。

回滚点: git checkout -- apps/browser/src/ui/hooks/use-auto-select-agent.tsx apps/browser/src/ui/screens/main/_components/sidebar-panel-config.ts apps/browser/src/ui/screens/main/_components/agent-hotkey-bindings.tsx apps/browser/src/ui/screens/main/agent-chat/chat/_components/workspace-select.tsx apps/browser/src/ui/screens/main/content/index.tsx apps/browser/src/ui/screens/main/index.tsx progress.md

## 2026-06-30 - Task: 帐号额度上限后自动切换优化与重试
### What was done
额度上限触发自动切换时，不再先全量刷新帐号池额度。现在会先标记当前帐号受限，再按候选帐号逐个实时校验额度，确认 token 正常且未达上限后立即切换，找到可用帐号即停止扫描。前端自动切换 RPC 增加 3 次重试，遇到 Karton 短暂断连时会重试后再展示最终失败。

### Testing
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit`：通过。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit`：通过。
- `git diff --name-only | rg "auto-register|proxy-pool|captcha|mailbox|registration-network|browser-ui-flow|camoufox|telemetry|posthog|validate-api"`：无输出，确认未改注册执行、代理池、验证码、邮箱、风控网络和 telemetry/API 校验文件。

### Notes
改动文件清单：
- apps/browser/src/backend/services/auth/account-pool.ts：候选帐号查找支持本次切换内排除列表，避免临时失败账号被反复选中。
- apps/browser/src/backend/services/auth/index.ts：自动切换改为逐个候选即时校验额度，跳过额度不足、token 被拒绝或临时校验失败的帐号，不再全量刷新帐号池。
- apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx：自动切换提示改为候选校验，并为 `switchToAvailablePoolAccount` RPC 增加最多 3 次重试。
- progress.md：追加本轮施工与验证记录。

回滚点: git checkout -- apps/browser/src/backend/services/auth/account-pool.ts apps/browser/src/backend/services/auth/index.ts apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-runtime-error.tsx progress.md

## 2026-06-30 - Task: build-fast 缺失产物恢复
### What was done
修复当前项目运行 `build-fast.bat` 的连续失败点：先恢复依赖安装产物中的 `tsx`，再从 `D:\work\ai\ctf\stagewise` 复制可直接复用的生成产物，包含 ESLint server bundle、`agent-runtime-node`、`agent-shell`、`karton` 和 Tailwind color modifiers 的 `dist`。`agent-core` 当前源码与旧项目不完全一致，因此未复制旧产物，改为按当前源码重新构建。

同步 `experience` 服务与测试到旧项目已跑通版本，移除当前半合并状态中未配套导出的问卷 schema 依赖，避免 backend Rollup 构建失败。

### Testing
- `pnpm exec tsx --version`：通过，输出 `tsx v4.21.0`。
- `pnpm bundle:eslint`：通过，ESLint server 已存在并跳过下载/编译。
- `pnpm -F @stagewise/agent-core build`：通过，按当前源码生成 `packages/agent-core/dist`。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit`：通过。
- `cmd /d /c "echo. | build-fast.bat"`：通过，输出 `SUCCESS. Artifact directory: D:\work\ai\stagewise\apps\browser\out`，并将 Camoufox 资源复制到 packaged resources。

### Notes
改动文件清单：
- apps/browser/src/backend/services/experience.ts：从旧项目复制已跑通版本，去除当前半合并的问卷 schema 依赖。
- apps/browser/src/backend/services/experience.test.ts：从旧项目复制匹配旧版 `ExperienceService` 构造参数的测试。
- apps/browser/bundled/eslint-server/：从旧项目复制生成的 ESLint server bundle，避免当前环境重新下载和依赖 `unzip`。
- agent/runtime-node/dist/：从旧项目复制 workspace 包构建产物，恢复 `@stagewise/agent-runtime-node` 入口。
- packages/agent-shell/dist/：从旧项目复制 workspace 包构建产物，恢复 `@stagewise/agent-shell` 入口。
- packages/karton/dist/：从旧项目复制 workspace 包构建产物，恢复 `@stagewise/karton/server` 等入口。
- packages/tailwindcss-color-modifiers/dist/：从旧项目复制 Tailwind 插件构建产物，恢复 `dist/index.cjs`。
- packages/agent-core/dist/：按当前源码重新构建，保留当前项目新增的 attachments 导出。
- apps/browser/out/：`build-fast.bat` 成功生成的 Electron package 输出目录。
- apps/browser/src/pages/generated/：打包时生成 license 数据。
- progress.md：追加本轮恢复与验证记录。

回滚方式: git checkout -- apps/browser/src/backend/services/experience.ts apps/browser/src/backend/services/experience.test.ts progress.md; Remove-Item -Recurse -Force agent/runtime-node/dist,apps/browser/bundled/eslint-server,apps/browser/out,apps/browser/src/pages/generated,packages/agent-core/dist,packages/agent-shell/dist,packages/karton/dist,packages/tailwindcss-color-modifiers/dist

## 2026-07-01 - Task: 移除 Playwright 隐身验证码模式
### What was done
从自动注册的安全验证方式中移除 `Playwright 隐身模式`。设置页下拉不再展示该选项，配置类型和 Karton contract 不再允许 `playwright-stealth`，后端也删除了对应的 Playwright solver 实现。

历史配置如果仍保存了旧的 `playwright-stealth` 值，后端会归一到 `browser-ui-flow`，即继续走真实浏览器页面注册。

### Testing
- `rg -n "playwright-stealth|Playwright 隐身模式|Playwright Stealth|playwrightHint|captchaProvider\\?:[\\s\\S]*playwright" apps\\browser\\src -S`：无输出，确认旧模式入口和文案已清理。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit`：通过。
- `pnpm -F stagewise exec tsc -p tsconfig.ui.json --noEmit`：未通过；失败点是既有 `sidebar-experience-survey.tsx` 仍引用当前 experience contract 中不存在的 survey 字段，与本轮移除 Playwright 隐身模式无关。

### Notes
改动文件清单：
- apps/browser/src/ui/screens/settings/sections/auto-register-section.tsx：移除 `Playwright 隐身模式` 下拉选项和对应提示。
- apps/browser/src/ui/screens/settings/sections/auto-register-config.ts：移除 `playwright-stealth` 配置枚举，并让旧值回落到默认真实浏览器页面注册。
- apps/browser/src/shared/karton-contracts/ui/index.ts：移除 auto-register 与 batch-register contract 中的 `playwright-stealth` provider。
- apps/browser/src/backend/services/auth/captcha-providers.ts：移除 Playwright solver provider 和动态安装/导入实现。
- apps/browser/src/backend/services/auth/index.ts：增加验证码 provider 归一逻辑，把旧 `playwright-stealth` 配置归到 `browser-ui-flow`。
- apps/browser/src/ui/i18n/dict/settings.ts：删除 Playwright 模式提示文案。
- apps/browser/src/ui/i18n/dict/chat.ts：删除 Playwright 模式选项文案。
- apps/browser/src/types/playwright.d.ts：删除不再需要的 optional Playwright ambient declaration。
- progress.md：追加本轮施工与验证记录。

回滚点: git checkout -- apps/browser/src/ui/screens/settings/sections/auto-register-section.tsx apps/browser/src/ui/screens/settings/sections/auto-register-config.ts apps/browser/src/shared/karton-contracts/ui/index.ts apps/browser/src/backend/services/auth/captcha-providers.ts apps/browser/src/backend/services/auth/index.ts apps/browser/src/ui/i18n/dict/settings.ts apps/browser/src/ui/i18n/dict/chat.ts apps/browser/src/types/playwright.d.ts progress.md

## 2026-07-01 - Task: 修复工作树清理提示失败反馈
### What was done
工作树清理按钮现在会在删除前返回具体的安全校验失败原因，不再只显示笼统的 `Worktree is no longer safe to clean.`。

清理结束后会重新扫描可清理候选项。已经不再满足安全清理条件的工作树会从提示中移除；如果 Git 删除本身失败但工作树仍然符合清理条件，则继续保留在提示里并显示 Git 返回的失败原因。

### Testing
- `pnpm -F stagewise exec vitest run src/backend/services/toolbox/services/mount-manager/git-path-actions.test.ts`：通过，17 个测试通过。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit`：通过。

### Notes
改动文件清单：
- apps/browser/src/backend/services/toolbox/services/mount-manager/index.ts：为工作树清理候选的二次安全校验返回具体失败原因，并在清理后刷新候选列表。
- apps/browser/src/backend/services/toolbox/services/mount-manager/git-path-actions.test.ts：补充清理候选变为不安全、以及 Git 删除失败时候选保留的回归测试。
- progress.md：追加本轮施工与验证记录。

回滚点: git checkout -- apps/browser/src/backend/services/toolbox/services/mount-manager/index.ts apps/browser/src/backend/services/toolbox/services/mount-manager/git-path-actions.test.ts progress.md

## 2026-07-01 - Task: 修复清除全部时间与强制清理工作树
### What was done
修复“清除全部时间”在选择下载记录时因为 history 数据库缺少 `downloads` 表而报错的问题。新库初始化会创建下载相关表，已有 version 1 数据库会通过 version 2 迁移补齐 `downloads`、`downloads_url_chains` 和 `downloads_slices`。

工作树清理改为对当前提示里的受管候选执行强制删除。即使点击时二次校验发现候选已被挂载或状态变化，只要它仍是提示里的受管工作树候选，就使用 `git worktree remove --force` 删除；删除成功后同步解绑仍指向该路径的 agent 挂载。

### Testing
- `pnpm -F stagewise exec vitest run src/backend/services/toolbox/services/mount-manager/git-path-actions.test.ts`：通过，17 个测试通过。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit`：通过。
- `pnpm exec biome check apps/browser/src/backend/services/history/migrations/v002-create-downloads-tables.ts apps/browser/src/backend/services/history/migrations/index.ts`：通过。
- `pnpm exec biome check apps/browser/src/backend/services/history/migrations/v002-create-downloads-tables.ts apps/browser/src/backend/services/history/migrations/index.ts apps/browser/src/backend/services/toolbox/services/mount-manager/index.ts apps/browser/src/backend/services/toolbox/services/mount-manager/git-path-actions.test.ts`：未通过；失败原因是既有 CRLF 文件会被 Biome 整文件改成 LF，本轮按禁止全量格式化/转码约束未执行该改写。

### Notes
改动文件清单：
- apps/browser/src/backend/services/history/schema.sql：补齐新 history 数据库初始化时的下载记录表。
- apps/browser/src/backend/services/history/migrations/index.ts：注册 history 数据库 version 2 迁移。
- apps/browser/src/backend/services/history/migrations/v002-create-downloads-tables.ts：为已有 history 数据库创建缺失的下载记录表。
- apps/browser/src/backend/services/toolbox/services/mount-manager/index.ts：工作树清理对提示候选执行 `--force` 删除，并在成功后解绑相关 agent 挂载。
- apps/browser/src/backend/services/toolbox/services/mount-manager/git-path-actions.test.ts：更新工作树清理测试，覆盖候选变为不安全时仍强制删除。
- progress.md：追加本轮施工与验证记录。

回滚点: git checkout -- apps/browser/src/backend/services/history/schema.sql apps/browser/src/backend/services/history/migrations/index.ts apps/browser/src/backend/services/toolbox/services/mount-manager/index.ts apps/browser/src/backend/services/toolbox/services/mount-manager/git-path-actions.test.ts progress.md; Remove-Item -LiteralPath apps/browser/src/backend/services/history/migrations/v002-create-downloads-tables.ts

## 2026-07-01 - Task: 安全强制清理工作树
### What was done
将工作树清理从直接强制删除升级为安全强制删除。删除前会重新检查工作树状态；如果发现未提交改动，会先在用户目录下的 `.stagewise/worktree-cleanup-backups` 创建备份，再执行 `git worktree remove --force`。

备份内容包括 tracked/staged 改动的 `changes.patch`、未跟踪文件的 `untracked/` 目录，以及记录原路径、分支、HEAD 和备份文件位置的 `metadata.json`。如果 Git 报 dirty 但没有捕获到可恢复内容，则停止删除，避免不可恢复的数据丢失。

同步新增 `docs/worktree-cleanup.md`，说明受管清理范围、备份位置和恢复方式。

### Testing
- `pnpm -F stagewise exec vitest run src/backend/services/git/index.test.ts`：通过，61 个测试通过。
- `pnpm -F stagewise exec vitest run src/backend/services/toolbox/services/mount-manager/git-path-actions.test.ts`：通过，18 个测试通过。
- `pnpm -F stagewise exec tsc -p tsconfig.backend.json --noEmit`：通过。
- `pnpm exec biome check apps/browser/src/backend/services/history/migrations/v002-create-downloads-tables.ts apps/browser/src/backend/services/history/migrations/index.ts apps/browser/src/backend/utils/paths.ts docs/worktree-cleanup.md`：通过；Biome 实际检查 3 个受支持文件，Markdown 未被检查。

### Notes
改动文件清单：
- apps/browser/src/backend/services/git/index.ts：新增工作树清理前备份能力，导出 patch、复制未跟踪文件并写 metadata。
- apps/browser/src/backend/services/git/index.test.ts：补充 dirty worktree 清理备份的 GitService 测试。
- apps/browser/src/backend/services/toolbox/services/mount-manager/index.ts：强制删除前重新检查状态，dirty 时先备份，备份失败则不删除。
- apps/browser/src/backend/services/toolbox/services/mount-manager/git-path-actions.test.ts：补充 dirty 候选先备份再强删的回归测试。
- apps/browser/src/backend/utils/paths.ts：新增工作树清理备份目录路径并纳入目录初始化。
- docs/worktree-cleanup.md：记录清理范围、备份内容和恢复方式。
- progress.md：追加本轮施工与验证记录。

回滚点: git checkout -- apps/browser/src/backend/services/git/index.ts apps/browser/src/backend/services/git/index.test.ts apps/browser/src/backend/services/toolbox/services/mount-manager/index.ts apps/browser/src/backend/services/toolbox/services/mount-manager/git-path-actions.test.ts apps/browser/src/backend/utils/paths.ts progress.md; Remove-Item -LiteralPath docs/worktree-cleanup.md
