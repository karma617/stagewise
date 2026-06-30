import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

const repo = 'P3TERX/GeoLite.mmdb';
const assetDir = path.resolve('assets', 'camoufox');
const targetFile = path.join(assetDir, 'GeoLite2-City.mmdb');
const tempFile = `${targetFile}.tmp`;
const downloadTimeoutMs = 120_000;
const maxMindMarker = Buffer.from([
  0xab,
  0xcd,
  0xef,
  ...Buffer.from('MaxMind.com'),
]);

async function isValidMmdb(file: string): Promise<boolean> {
  try {
    const stat = await fs.stat(file);
    if (stat.size < 1024 * 1024) return false;
    const handle = await fs.open(file, 'r');
    try {
      const readSize = Math.min(stat.size, 128 * 1024);
      const buffer = Buffer.alloc(readSize);
      await handle.read(buffer, 0, readSize, stat.size - readSize);
      return buffer.includes(maxMindMarker);
    } finally {
      await handle.close();
    }
  } catch {
    return false;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), downloadTimeoutMs);
  const response = await fetch(url, {
    signal: controller.signal,
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'stagewise-camoufox-asset-preparer',
    },
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

async function download(url: string, dest: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), downloadTimeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'stagewise-camoufox-asset-preparer' },
    });
    if (!response.ok || !response.body) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    await pipeline(response.body, createWriteStream(dest), {
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  if (await isValidMmdb(targetFile)) {
    console.log(
      `[camoufox-assets] GeoIP database already exists: ${targetFile}`,
    );
    return;
  }
  if (await isValidMmdb(tempFile)) {
    await fs.rename(tempFile, targetFile);
    console.log(
      `[camoufox-assets] recovered completed download: ${targetFile}`,
    );
    return;
  }

  await fs.mkdir(assetDir, { recursive: true });
  await fs.rm(targetFile, { force: true });

  console.log('[camoufox-assets] downloading GeoLite2-City.mmdb...');
  const release = await fetchJson<{
    assets: Array<{ name: string; browser_download_url: string }>;
  }>(`https://api.github.com/repos/${repo}/releases/latest`);
  const asset = release.assets.find((item) => item.name.endsWith('-City.mmdb'));
  if (!asset) {
    throw new Error(`No *-City.mmdb asset found in ${repo} latest release`);
  }

  await fs.rm(tempFile, { force: true });
  await download(asset.browser_download_url, tempFile);
  if (!(await isValidMmdb(tempFile))) {
    await fs.rm(tempFile, { force: true });
    throw new Error('Downloaded GeoLite2-City.mmdb is not a valid MMDB file');
  }

  await fs.rename(tempFile, targetFile);
  console.log(`[camoufox-assets] saved ${targetFile}`);
}

main().catch((error) => {
  console.error(
    '[camoufox-assets] failed:',
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
