import { resolveVokinoUrl } from '@/shared/config/api';

export function getVokinoMainUrl(): string {
  return resolveVokinoUrl('/main');
}
