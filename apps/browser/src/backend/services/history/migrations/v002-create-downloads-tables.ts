import { sql } from 'drizzle-orm';
import type { MigrationScript } from '@stagewise/agent-core/migrate-database';

export const createDownloadsTables: MigrationScript = {
  version: 2,
  name: 'create-downloads-tables',
  async up(db) {
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS downloads (
        id INTEGER PRIMARY KEY,
        guid LONGVARCHAR NOT NULL,
        current_path LONGVARCHAR NOT NULL,
        target_path LONGVARCHAR NOT NULL,
        start_time INTEGER NOT NULL,
        received_bytes INTEGER NOT NULL,
        total_bytes INTEGER NOT NULL,
        state INTEGER NOT NULL,
        danger_type INTEGER NOT NULL,
        interrupt_reason INTEGER NOT NULL,
        hash BLOB NOT NULL,
        end_time INTEGER NOT NULL,
        opened BOOLEAN NOT NULL,
        last_access_time INTEGER NOT NULL,
        transient BOOLEAN NOT NULL,
        referrer LONGVARCHAR NOT NULL,
        site_url LONGVARCHAR NOT NULL,
        embedder_download_data LONGVARCHAR NOT NULL,
        tab_url LONGVARCHAR NOT NULL,
        tab_referrer_url LONGVARCHAR NOT NULL,
        http_method VARCHAR NOT NULL,
        by_ext_id VARCHAR NOT NULL,
        by_ext_name VARCHAR NOT NULL,
        by_web_app_id VARCHAR NOT NULL,
        etag VARCHAR NOT NULL,
        last_modified VARCHAR NOT NULL,
        mime_type VARCHAR NOT NULL,
        original_mime_type VARCHAR NOT NULL
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS downloads_url_chains (
        id INTEGER NOT NULL,
        chain_index INTEGER NOT NULL,
        url LONGVARCHAR NOT NULL,
        PRIMARY KEY(id, chain_index)
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS downloads_slices (
        download_id INTEGER NOT NULL,
        offset INTEGER NOT NULL,
        received_bytes INTEGER NOT NULL,
        finished BOOLEAN DEFAULT FALSE NOT NULL,
        PRIMARY KEY(download_id, offset)
      )
    `);
  },
};
