import { PaginationQueryDto } from '../dto/pagination-query.dto';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

/**
 * Calculate pagination parameters from query DTO
 * @param query - Optional pagination query with page and limit
 * @returns Pagination parameters with page, limit, and skip (offset)
 */
export function calculatePagination(
  query?: PaginationQueryDto,
): PaginationParams {
  const page = query?.page || 1;
  const limit = query?.limit || 20;
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}
