import { spawn } from 'node:child_process';
import * as path from 'node:path';
import type { LspServerInfo, LspServerHandle } from '../types';
import { BIOME_EXTENSIONS } from '../language-map';
import { hasAnyFile, fileExists } from './utils/root-finder';
import { spawnStdioLspServer } from './utils/spawn-helpers';

/**
 * Biome Language Server definition
 *
 * Resolution order:
 * 1. Project's @biomejs/biome from node_modules
 * 2. npx @biomejs/biome (global/fallback)
 *
 * Only activates if biome.json or biome.jsonc exists.
 */
export const biomeServer: LspServerInfo = {
  id: 'biome',
  name: 'Biome Language Server',
  extensions: BIOME_EXTENSIONS,

  async shouldActivate(projectRoot: string): Promise<boolean> {
    // Only activate if biome config exists
    return hasAnyFile(projectRoot, ['biome.json', 'biome.jsonc']);
  },

  async spawn(
    projectRoot: string,
    resolvedEnv?: Record<string, string> | null,
  ): Promise<LspServerHandle | undefined> {
    const env = resolvedEnv ?? globalThis.process.env;

    const nativeBin = await findNativeBiomeBinary(projectRoot);
    if (nativeBin) {
      return spawnStdioLspServer(nativeBin, ['lsp-proxy'], {
        cwd: projectRoot,
        env,
      });
    }

    const packageBin = await findBiomePackageBin(projectRoot);
    if (packageBin) {
      return spawnStdioLspServer(
        globalThis.process.execPath,
        [packageBin, 'lsp-proxy'],
        {
          cwd: projectRoot,
          env,
        },
      );
    }

    // Try npx fallback
    return spawnViaNpx(projectRoot, env);
  },
};

async function findNativeBiomeBinary(
  root: string,
): Promise<string | undefined> {
  const packageName = nativeBiomePackageName();
  if (!packageName) return undefined;
  const binaryName = process.platform === 'win32' ? 'biome.exe' : 'biome';
  const binary = path.join(root, 'node_modules', packageName, binaryName);
  if (await fileExists(binary)) return binary;
  return undefined;
}

function nativeBiomePackageName(): string | undefined {
  if (process.platform === 'win32') {
    if (process.arch === 'x64') return '@biomejs/cli-win32-x64';
    if (process.arch === 'arm64') return '@biomejs/cli-win32-arm64';
    return undefined;
  }
  if (process.platform === 'darwin') {
    if (process.arch === 'x64') return '@biomejs/cli-darwin-x64';
    if (process.arch === 'arm64') return '@biomejs/cli-darwin-arm64';
    return undefined;
  }
  if (process.platform === 'linux') {
    if (process.arch === 'x64') return '@biomejs/cli-linux-x64';
    if (process.arch === 'arm64') return '@biomejs/cli-linux-arm64';
  }
  return undefined;
}

async function findBiomePackageBin(root: string): Promise<string | undefined> {
  const packageBin = path.join(
    root,
    'node_modules',
    '@biomejs',
    'biome',
    'bin',
    'biome',
  );
  if (await fileExists(packageBin)) return packageBin;
  return undefined;
}

async function spawnViaNpx(
  root: string,
  env: Record<string, string> | NodeJS.ProcessEnv,
): Promise<LspServerHandle | undefined> {
  try {
    const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
    const args =
      process.platform === 'win32'
        ? ['/d', '/s', '/c', 'npx.cmd @biomejs/biome lsp-proxy']
        : ['@biomejs/biome', 'lsp-proxy'];
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: root,
      env,
    });

    return new Promise((resolve) => {
      let resolved = false;

      child.on('error', () => {
        if (!resolved) {
          resolved = true;
          resolve(undefined);
        }
      });

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({ process: child });
        }
      }, 100);
    });
  } catch {
    return undefined;
  }
}
