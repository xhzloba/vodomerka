import type { AiCatalogModel } from './ipc';

/** Curated Ollama models for Vodomerka AI recommendations. */
export const AI_MODEL_CATALOG: AiCatalogModel[] = [
  {
    id: 'qwen3.6:27b',
    name: 'Qwen 3.6 27B',
    description: 'Рекомендуем для подбора фильмов. Качественный JSON и русский язык.',
    sizeLabel: '~17 ГБ',
    recommended: true,
    priority: 100,
  },
  {
    id: 'qwen3.6:latest',
    name: 'Qwen 3.6 (latest)',
    description: 'Актуальный тег линейки 3.6. Тяжелее 27B, если качаешь 35B.',
    sizeLabel: '~24 ГБ',
    priority: 90,
  },
  {
    id: 'qwen2.5:7b',
    name: 'Qwen 2.5 7B',
    description: 'Лёгкая модель — быстрее на слабом железе, хуже сложные формулировки.',
    sizeLabel: '~4.7 ГБ',
    priority: 70,
  },
  {
    id: 'qwen2.5:14b',
    name: 'Qwen 2.5 14B',
    description: 'Компромисс между скоростью и качеством, если 3.6 не влезает.',
    sizeLabel: '~9 ГБ',
    priority: 75,
  },
];

function modelFamilyScore(name: string): number {
  const lower = name.toLowerCase();

  for (const entry of AI_MODEL_CATALOG) {
    if (lower === entry.id.toLowerCase() || lower.startsWith(`${entry.id.toLowerCase()}`)) {
      return entry.priority;
    }
  }

  if (lower.includes('qwen3.6') || lower.includes('qwen3_6')) {
    return 95;
  }
  if (lower.includes('qwen3.5') || lower.includes('qwen3_5')) {
    return 85;
  }
  if (lower.includes('qwen2.5')) {
    return 65;
  }
  if (lower.includes('qwen')) {
    return 50;
  }
  if (lower.includes('llama')) {
    return 30;
  }

  return 10;
}

/** Prefer Qwen 3.6 → Qwen 2.5 → any installed model. */
export function pickRecommendedAiModel(
  installedNames: string[],
  preferred?: string | null,
): string | null {
  const names = installedNames.map((name) => name.trim()).filter(Boolean);
  if (names.length === 0) {
    return null;
  }

  const preferredName = preferred?.trim();
  if (preferredName && names.some((name) => name === preferredName)) {
    return preferredName;
  }

  const ranked = [...names].sort((a, b) => {
    const byScore = modelFamilyScore(b) - modelFamilyScore(a);
    if (byScore !== 0) {
      return byScore;
    }
    return a.localeCompare(b, 'en');
  });

  return ranked[0] ?? null;
}

export function isCatalogModelInstalled(
  catalogId: string,
  installedNames: string[],
): boolean {
  const target = catalogId.toLowerCase();
  return installedNames.some((name) => {
    const lower = name.toLowerCase();
    return lower === target || lower.startsWith(`${target}-`);
  });
}

export function formatAiModelSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '';
  }

  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(gb >= 10 ? 0 : 1)} ГБ`;
  }

  const mb = bytes / (1024 * 1024);
  return `${Math.max(1, Math.round(mb))} МБ`;
}
