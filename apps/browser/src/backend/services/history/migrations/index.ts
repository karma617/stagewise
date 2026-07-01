import type { MigrationScript } from '@stagewise/agent-core/migrate-database';
import { createDownloadsTables } from './v002-create-downloads-tables';

const registry: MigrationScript[] = [createDownloadsTables];
const schemaVersion = 2;

export { registry, schemaVersion };
