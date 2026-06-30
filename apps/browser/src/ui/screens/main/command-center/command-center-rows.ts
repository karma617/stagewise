import type {
  AgentCommandItem,
  CommandCenterItem,
  CommandCenterMode,
} from './command-center-model';

export type CommandCenterRenderRow =
  | { type: 'header'; key: string; label: string }
  | { type: 'item'; item: CommandCenterItem; itemIndex: number };

type AgentGroupLabel =
  | 'today'
  | 'yesterday'
  | 'last7Days'
  | 'last30Days'
  | 'older';

const AGENT_GROUP_ORDER: AgentGroupLabel[] = [
  'today',
  'yesterday',
  'last7Days',
  'last30Days',
  'older',
];

export type CommandCenterGroupLabels = {
  actions: string;
  agents: string;
  browser: string;
  files: string;
  last30Days: string;
  last7Days: string;
  older: string;
  settings: string;
  today: string;
  yesterday: string;
};

function getAgentGroupLabel(timestamp: number): AgentGroupLabel {
  if (!timestamp) return 'today';

  const now = new Date();
  const ts = new Date(timestamp);
  const nowMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const tsMidnight = new Date(
    ts.getFullYear(),
    ts.getMonth(),
    ts.getDate(),
  ).getTime();
  const diffDays = Math.round((nowMidnight - tsMidnight) / 86_400_000);

  if (diffDays < 0) return 'today';
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays <= 7) return 'last7Days';
  if (diffDays <= 30) return 'last30Days';
  return 'older';
}

function pushSection(
  rows: CommandCenterRenderRow[],
  label: string,
  items: { item: CommandCenterItem; itemIndex: number }[],
) {
  if (items.length === 0) return;
  rows.push({ type: 'header', key: `header:${label}`, label });
  rows.push(
    ...items.map(({ item, itemIndex }) => ({
      type: 'item' as const,
      item,
      itemIndex,
    })),
  );
}

function buildGlobalRows(
  items: CommandCenterItem[],
  labels: CommandCenterGroupLabels,
): CommandCenterRenderRow[] {
  const indexedItems = items.map((item, itemIndex) => ({ item, itemIndex }));
  const rows: CommandCenterRenderRow[] = [];

  pushSection(
    rows,
    labels.agents,
    indexedItems.filter(({ item }) => item.kind === 'agent'),
  );
  pushSection(
    rows,
    labels.browser,
    indexedItems.filter(({ item }) => item.kind === 'tab'),
  );
  pushSection(
    rows,
    labels.files,
    indexedItems.filter(({ item }) => item.kind === 'file'),
  );
  pushSection(
    rows,
    labels.settings,
    indexedItems.filter(({ item }) => item.kind === 'setting'),
  );
  pushSection(
    rows,
    labels.actions,
    indexedItems.filter(({ item }) => item.kind === 'action'),
  );

  return rows;
}

function buildAgentRows(
  items: CommandCenterItem[],
  labels: CommandCenterGroupLabels,
): CommandCenterRenderRow[] {
  const groupedItems = new Map<
    AgentGroupLabel,
    { item: CommandCenterItem; itemIndex: number }[]
  >();

  items.forEach((item, itemIndex) => {
    const group = getAgentGroupLabel((item as AgentCommandItem).lastMessageAt);
    const groupItems = groupedItems.get(group) ?? [];
    groupItems.push({ item, itemIndex });
    groupedItems.set(group, groupItems);
  });

  return AGENT_GROUP_ORDER.flatMap((group) => {
    const groupItems = groupedItems.get(group);
    if (!groupItems?.length) return [];

    return [
      {
        type: 'header' as const,
        key: `header:agents:${group}`,
        label: labels[group],
      },
      ...groupItems.map(({ item, itemIndex }) => ({
        type: 'item' as const,
        item,
        itemIndex,
      })),
    ];
  });
}

export function buildGroupedRows(
  items: CommandCenterItem[],
  mode: CommandCenterMode,
  options: { filesLabel?: string; labels: CommandCenterGroupLabels },
): CommandCenterRenderRow[] {
  if (mode === 'global') return buildGlobalRows(items, options.labels);
  if (mode === 'agents') return buildAgentRows(items, options.labels);

  const label =
    mode === 'browser'
      ? options.labels.browser
      : mode === 'files'
        ? (options.filesLabel ?? options.labels.files)
        : options.labels.settings;

  return [
    {
      type: 'header',
      key: `header:${mode}`,
      label,
    },
    ...items.map((item, itemIndex) => ({
      type: 'item' as const,
      item,
      itemIndex,
    })),
  ];
}
