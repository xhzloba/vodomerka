export type MediatekaItemId =
  | 'movie'
  | 'serial'
  | 'anime'
  | 'multfilm'
  | 'multserial';

export interface MediatekaMenuItem {
  id: MediatekaItemId;
  title: string;
  /** Vokino browse `type=` — used by openBrowse({ categoryType }) */
  categoryType: MediatekaItemId;
  icon: 'film' | 'tv' | 'anime' | 'cartoon' | 'cartoon-series';
}

/** Built-in media library shortcuts into catalog categories. */
export const MEDIATEKA_MENU_ITEMS: MediatekaMenuItem[] = [
  { id: 'movie', title: 'Фильмы', categoryType: 'movie', icon: 'film' },
  { id: 'serial', title: 'Сериалы', categoryType: 'serial', icon: 'tv' },
  { id: 'anime', title: 'Аниме', categoryType: 'anime', icon: 'anime' },
  { id: 'multfilm', title: 'Мультфильмы', categoryType: 'multfilm', icon: 'cartoon' },
  { id: 'multserial', title: 'Мультсериалы', categoryType: 'multserial', icon: 'cartoon-series' },
];

const MEDIATEKA_ITEM_IDS = new Set(MEDIATEKA_MENU_ITEMS.map((item) => item.id));

export function normalizeHiddenMediatekaItemIds(value: unknown): MediatekaItemId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is MediatekaItemId => typeof item === 'string' && MEDIATEKA_ITEM_IDS.has(item as MediatekaItemId),
  );
}

export function getVisibleMediatekaItems(hiddenIds: readonly string[]): MediatekaMenuItem[] {
  const hidden = new Set(hiddenIds);
  return MEDIATEKA_MENU_ITEMS.filter((item) => !hidden.has(item.id));
}

export function getHiddenMediatekaItems(hiddenIds: readonly string[]): MediatekaMenuItem[] {
  const hidden = new Set(hiddenIds);
  return MEDIATEKA_MENU_ITEMS.filter((item) => hidden.has(item.id));
}

export function toggleMediatekaItemHidden(
  hiddenIds: readonly string[],
  itemId: MediatekaItemId,
): MediatekaItemId[] {
  const set = new Set(normalizeHiddenMediatekaItemIds(hiddenIds));
  if (set.has(itemId)) {
    set.delete(itemId);
  } else {
    set.add(itemId);
  }
  return MEDIATEKA_MENU_ITEMS.map((item) => item.id).filter((id) => set.has(id));
}
