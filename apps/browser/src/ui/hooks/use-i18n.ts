import { useKartonState } from '@ui/hooks/use-karton';
import { useCallback } from 'react';
import type { AppLanguage } from '@shared/karton-contracts/ui/shared-types';
import { dict } from '@ui/i18n';

/**
 * Application i18n hook.
 *
 * Reads the active language from Karton globalConfig.appLanguage.
 * Defaults to 'zh-CN' when not set.
 *
 * Translation entries live in src/ui/i18n/dict/*.ts (modular by feature).
 * If a key is missing in the dict, the key itself is returned as fallback,
 * so a forgotten string remains visible during incremental migration.
 */
export function useI18n() {
  const lang: AppLanguage =
    useKartonState((s) => s.globalConfig.appLanguage) ?? 'zh-CN';

  const t = useCallback(
    (key: string): string => {
      const entry = dict[key];
      if (!entry) return key;
      return entry[lang] ?? entry['zh-CN'] ?? key;
    },
    [lang],
  );

  return { lang, t };
}
