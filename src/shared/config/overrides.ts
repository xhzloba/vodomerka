export const MEDIA_OVERRIDES_REPO = 'xhzloba/dbmovies';
export const MEDIA_OVERRIDES_BRANCH = 'main';
export const MEDIA_OVERRIDES_JSON_PATH = 'movie_overrides.json';
export const MEDIA_OVERRIDES_IMAGES_DIR = 'images';

export const MEDIA_OVERRIDES_JSON_URL = `https://raw.githubusercontent.com/${MEDIA_OVERRIDES_REPO}/${MEDIA_OVERRIDES_BRANCH}/${MEDIA_OVERRIDES_JSON_PATH}`;

export function buildOverrideImageRawUrl(filename: string): string {
  return `https://raw.githubusercontent.com/${MEDIA_OVERRIDES_REPO}/${MEDIA_OVERRIDES_BRANCH}/${MEDIA_OVERRIDES_IMAGES_DIR}/${filename}`;
}
