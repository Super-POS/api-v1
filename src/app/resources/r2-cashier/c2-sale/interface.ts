import { Pagination } from "@app/shared/pagination.interface";

export interface List {
    status: string;
    data: any[];
    pagination: Pagination;
}
