import { TOP250_COMPILATION_ID } from '@/shared/api/vokino/top250';

export interface CompilationNavigationTarget {
  compilationId: string;
}

export const TOP250_COMPILATION_TARGET: CompilationNavigationTarget = {
  compilationId: TOP250_COMPILATION_ID,
};
