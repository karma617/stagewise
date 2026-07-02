# Windows 正式包打包说明（build-release.bat）

本文件记录通过 `build-release.bat` 在 Windows 上生成正式发布包的流程。
该脚本面向 release channel，不使用 FAST_BUILD。

## 一、前置环境
- Node 18+。
- pnpm 11.x。
- 仓库根目录建议存在 `.env.prod`。
- 如果 `.env.prod` 缺失，脚本会优先从 `.env` 复制生成；如果 `.env` 也缺失，则从 `.env.example` 复制生成。
- 正式对外发布前，应检查 `.env.prod` 是否已填写生产环境值，例如生产 API、更新服务器、签名配置与 Nucleo license。

## 二、脚本行为
`build-release.bat` 会执行以下步骤：

1. 切换到仓库根目录。
2. 检查 `pnpm` 是否可用。
3. 检查 `.env.prod` 是否存在；缺失时从 `.env` 或 `.env.example` 自动生成本地 `.env.prod`。
4. 关闭正在运行的 `stagewise.exe`，避免输出目录被占用。
5. 执行 `pnpm exec tsx scripts/prepare-camoufox-assets.ts`。
6. 在 `apps/browser` 下设置 `RELEASE_CHANNEL=release` 并执行 `pnpm make`。
7. 将 `apps/browser/assets/camoufox` 复制到 `apps/browser/out/release/**/resources/camoufox`。

## 三、产物
正式应用目录：

```text
apps/browser/out/release/stagewise-win32-x64/stagewise.exe
```

Electron Forge maker 产物目录：

```text
apps/browser/out/release/make
```

Windows 下通常会包含 Squirrel 安装包和 Forge 生成的 zip 产物，具体文件名由
`apps/browser/forge.config.mts` 和当前版本号决定。

## 四、注意事项
- 正式包名称为 `stagewise`，不是 `stagewise-dev`。
- 正式包使用 `assets/icons/release` 图标资源。
- `.env.prod` 属于本地环境文件，已被 `.gitignore` 忽略，不会纳入版本库。
- 如果未配置 Windows Azure Trusted Signing 环境变量，Forge 会跳过签名或按当前配置执行；是否签名以打包日志为准。
- 如果旧的正式版应用正在运行，脚本会先尝试关闭 `stagewise.exe`。
