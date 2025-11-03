import { calculatePagination } from './pagination.helper';
import { PaginationQueryDto } from '../dto/pagination-query.dto';

describe('calculatePagination', () => {
  it('should use default values when query is undefined', () => {
    const result = calculatePagination();

    expect(result).toEqual({
      page: 1,
      limit: 20,
      skip: 0,
    });
  });

  it('should use default values when query is empty object', () => {
    const result = calculatePagination({} as PaginationQueryDto);

    expect(result).toEqual({
      page: 1,
      limit: 20,
      skip: 0,
    });
  });

  it('should calculate skip correctly for page 1', () => {
    const query: PaginationQueryDto = { page: 1, limit: 20 };
    const result = calculatePagination(query);

    expect(result).toEqual({
      page: 1,
      limit: 20,
      skip: 0,
    });
  });

  it('should calculate skip correctly for page 2', () => {
    const query: PaginationQueryDto = { page: 2, limit: 20 };
    const result = calculatePagination(query);

    expect(result).toEqual({
      page: 2,
      limit: 20,
      skip: 20,
    });
  });

  it('should calculate skip correctly for page 3 with custom limit', () => {
    const query: PaginationQueryDto = { page: 3, limit: 10 };
    const result = calculatePagination(query);

    expect(result).toEqual({
      page: 3,
      limit: 10,
      skip: 20,
    });
  });

  it('should handle page 5 with limit 50', () => {
    const query: PaginationQueryDto = { page: 5, limit: 50 };
    const result = calculatePagination(query);

    expect(result).toEqual({
      page: 5,
      limit: 50,
      skip: 200,
    });
  });

  it('should use default page when only limit is provided', () => {
    const query: PaginationQueryDto = { limit: 30 };
    const result = calculatePagination(query);

    expect(result).toEqual({
      page: 1,
      limit: 30,
      skip: 0,
    });
  });

  it('should use default limit when only page is provided', () => {
    const query: PaginationQueryDto = { page: 4 };
    const result = calculatePagination(query);

    expect(result).toEqual({
      page: 4,
      limit: 20,
      skip: 60,
    });
  });

  it('should handle edge case with page 1 and limit 1', () => {
    const query: PaginationQueryDto = { page: 1, limit: 1 };
    const result = calculatePagination(query);

    expect(result).toEqual({
      page: 1,
      limit: 1,
      skip: 0,
    });
  });

  it('should handle large page numbers', () => {
    const query: PaginationQueryDto = { page: 100, limit: 20 };
    const result = calculatePagination(query);

    expect(result).toEqual({
      page: 100,
      limit: 20,
      skip: 1980,
    });
  });
});
