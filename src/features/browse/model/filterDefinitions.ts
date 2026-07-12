import type { BrowseFilterFieldDefinition, BrowseFilterOptionsResponse } from './types';

const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_YEARS_START = 1980;

function buildYearOptions(from = DEFAULT_YEARS_START, to = CURRENT_YEAR): BrowseFilterFieldDefinition['options'] {
  const options: BrowseFilterFieldDefinition['options'] = [];

  for (let year = to; year >= from; year -= 1) {
    options.push({ value: String(year), label: String(year) });
  }

  return options;
}

const DEFAULT_RATING_OPTIONS = [9, 8, 7, 6, 5].map((value) => ({
  value: String(value),
  label: `${value}+`,
}));

const DEFAULT_GENRES: BrowseFilterFieldDefinition['options'] = [
  { value: 'боевик', label: 'боевик' },
  { value: 'фэнтези', label: 'фэнтези' },
  { value: 'фантастика', label: 'фантастика' },
  { value: 'триллер', label: 'триллер' },
  { value: 'военный', label: 'военный' },
  { value: 'детектив', label: 'детектив' },
  { value: 'комедия', label: 'комедия' },
  { value: 'драма', label: 'драма' },
  { value: 'ужасы', label: 'ужасы' },
  { value: 'криминал', label: 'криминал' },
  { value: 'мелодрама', label: 'мелодрама' },
  { value: 'вестерн', label: 'вестерн' },
  { value: 'биография', label: 'биография' },
  { value: 'аниме', label: 'аниме' },
  { value: 'детский', label: 'детский' },
  { value: 'мультфильм', label: 'мультфильм' },
  { value: 'фильм-нуар', label: 'фильм-нуар' },
  { value: 'для взрослых', label: 'для взрослых' },
  { value: 'документальный', label: 'документальный' },
  { value: 'игра', label: 'игра' },
  { value: 'история', label: 'история' },
  { value: 'концерт', label: 'концерт' },
  { value: 'короткометражка', label: 'короткометражка' },
  { value: 'музыка', label: 'музыка' },
  { value: 'мюзикл', label: 'мюзикл' },
  { value: 'новости', label: 'новости' },
  { value: 'приключения', label: 'приключения' },
  { value: 'реальное ТВ', label: 'реальное ТВ' },
  { value: 'семейный', label: 'семейный' },
  { value: 'спорт', label: 'спорт' },
  { value: 'ток-шоу', label: 'ток-шоу' },
  { value: 'церемония', label: 'церемония' },
  { value: 'дорама', label: 'дорама' },
];

const DEFAULT_POPULAR_COUNTRIES: BrowseFilterFieldDefinition['options'] = [
  { value: 'США', label: 'США' },
  { value: 'Россия', label: 'Россия' },
  { value: 'Великобритания', label: 'Великобритания' },
  { value: 'Франция', label: 'Франция' },
  { value: 'Германия', label: 'Германия' },
  { value: 'Италия', label: 'Италия' },
  { value: 'Испания', label: 'Испания' },
  { value: 'Канада', label: 'Канада' },
  { value: 'Япония', label: 'Япония' },
  { value: 'Южная Корея', label: 'Южная Корея' },
  { value: 'Китай', label: 'Китай' },
  { value: 'Индия', label: 'Индия' },
  { value: 'Австралия', label: 'Австралия' },
  { value: 'Украина', label: 'Украина' },
  { value: 'Казахстан', label: 'Казахстан' },
  { value: 'Турция', label: 'Турция' },
  { value: 'Польша', label: 'Польша' },
  { value: 'Чехия', label: 'Чехия' },
  { value: 'Швеция', label: 'Швеция' },
  { value: 'Норвегия', label: 'Норвегия' },
  { value: 'Бельгия', label: 'Бельгия' },
  { value: 'Нидерланды', label: 'Нидерланды' },
  { value: 'Дания', label: 'Дания' },
  { value: 'Финляндия', label: 'Финляндия' },
  { value: 'Аргентина', label: 'Аргентина' },
  { value: 'Бразилия', label: 'Бразилия' },
  { value: 'Мексика', label: 'Мексика' },
  { value: 'Гонконг', label: 'Гонконг' },
  { value: 'Тайвань', label: 'Тайвань' },
  { value: 'Израиль', label: 'Израиль' },
];

export function createBrowseFilterFields(
  options: Partial<BrowseFilterOptionsResponse> = {},
): BrowseFilterFieldDefinition[] {
  const genres = options.genres ?? DEFAULT_GENRES;
  const countries = options.countries ?? DEFAULT_POPULAR_COUNTRIES;
  const years = options.years ?? buildYearOptions();
  const ratings = options.ratings ?? DEFAULT_RATING_OPTIONS;

  return [
    {
      id: 'genre',
      label: 'Жанр',
      placeholder: 'Любой жанр',
      kind: 'chips',
      options: genres,
    },
    {
      id: 'country',
      label: 'Страна',
      placeholder: 'Любая страна',
      kind: 'select',
      options: countries,
    },
    {
      id: 'year',
      label: 'Год',
      placeholder: 'Любой год',
      kind: 'select',
      options: years,
    },
    {
      id: 'rating',
      label: 'Рейтинг',
      placeholder: 'Любой рейтинг',
      kind: 'rating',
      options: ratings,
    },
  ];
}
