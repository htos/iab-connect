/**
 * Shared pagination types used across the application.
 * Consolidates PagedResult<T> / PagedResponse<T> previously duplicated in 6 files.
 */
export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
