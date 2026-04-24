export interface Pagination {
    page: number;
    limit: number;
    totalPage: number;
    total: number;
    // Optional aliases for clients expecting different pagination keys
    currentPage?: number;
    perPage?: number;
    totalItems?: number;
    totalPages?: number;
}