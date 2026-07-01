# Windows 打包说明（build-fast.bat）

本文件记录在 Windows + pnpm 11 环境下，通过 `build-fast.bat` 对 `apps/browser`
做 FAST 打包时所需的环境调整与已知非致命告警，便于后续复现与排障。

## 一、前置环境
- Node 18+（实测 Node 24.13.0 可用）。
- pnpm 11.x（实测 11.7.0）。
- 网络可访问 npm 镜像；GitHub 直连不稳定时，Electron 二进制需走镜像。

## 二、为适配 pnpm 11 所做的配置迁移（pnpm-workspace.yaml）
pnpm 11 不再读取 `package.json` 里的 `pnpm` 字段，相关配置已迁移到
`pnpm-workspace.yaml`：

1. `blockExoticSubdeps: false`
   允许子依赖里通过 git 解析的 `@electron/node-gyp`，否则 `pnpm install` 报
   `ERR_PNPM_EXOTIC_SUBDEP`。
2. `nodeLinker: hoisted` 与 `shamefullyHoist: true`
   Electron Forge 的系统检查要求 pnpm 使用 hoisted 布局，否则 package 阶段报
   “node-linker must be set to hoisted”。
3. `allowBuilds`（取代旧的 `onlyBuiltDependencies`）
   - 对 electron、esbuild、sharp、node-pty、bufferutil、utf-8-validate、
     protobufjs、core-js、@posthog/cli、electron-winstaller 等设为 `true`，
     使其 install/postinstall 脚本正常执行。
   - 对所有 `nucleo-*` 图标包显式设为 `false`：这些包的 `preinstall` 会做
     Nucleo 许可证校验，无 key 时会失败并导致整个 `pnpm install` 退出码为 1；
     设为 `false` 后跳过脚本，包内 `dist` 资源本身已随 tarball 提供，可正常使用。
4. `overrides` 增加 `"@types/node": "22.15.2"`
   仓库本意是用 22.15.2，但部分包用 `^22.10.2` 会解析到 22.20.0，引入
   `Dirent<NonSharedBuffer>` 类型，导致 `@stagewise/agent-core` 的
   `tsc --emitDeclarationOnly` 类型报错。锁定到 22.15.2 后类型恢复正常。

## 三、ESLint server 打包脚本的 Windows 兼容修复
`apps/browser/scripts/bundle-eslint-server.ts`：
vscode-eslint 源码里 `server/src/shared` 与 `client/src/shared` 是指向根目录
`$shared` 的符号链接。Windows 上 `unzip` 会把符号链接解出成普通文本文件，导致
webpack 无法解析 `./shared/customMessages`、`./shared/settings`。
修复方式：解压后调用新增的 `materializeSharedSymlink()`，将 `$shared` 真实内容
复制到这两个 `shared` 目录，使 webpack 能正常打包。

## 四、Electron 二进制下载
GitHub 直连下载 electron `dist` 不稳定（fetch failed）。打包时设置环境变量：

```
ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/
```

下载后的二进制会缓存到 `%LOCALAPPDATA%\electron\Cache`，后续安装可复用。

## 五、.env
`apps/browser` 的 `package:fast` 使用 `dotenv -e ../../.env`，仓库根目录默认无
`.env`。已从 `.env.example` 复制生成根目录 `.env`（仅含开发默认值，密钥留空，
FAST 打包不需要签名/公证密钥）。`.env` 不纳入版本库。

## 六、执行步骤
1. `pnpm install`（首次因配置变更可能需要 `--no-frozen-lockfile`）。
2. 打包前先构建 browser 依赖的 workspace 包（Forge 不会自动构建依赖）：
   `pnpm turbo run build --filter="stagewise^..."`
3. 运行 `build-fast.bat`（或等价地依次执行）：
   - `pnpm exec tsx scripts/prepare-camoufox-assets.ts`
   - `pnpm package:fast`
   - 将 `apps/browser/assets/camoufox` 复制到 `out/**/resources/camoufox`

## 七、已知非致命告警
- PostHog source map 上传失败：使用的是占位 API key（`POSTHOG_CLI_API_KEY`），
  开发打包不影响产物。
- NuGet 下载 VC++ CRT 失败：会自动回退从 `System32` 复制所需 DLL。

## 八、产物
`apps/browser/out/dev/stagewise-dev-win32-x64/stagewise-dev.exe`
