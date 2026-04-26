import { Pagination } from "@app/shared/pagination.interface";
import Menu from "@app/models/menu/menu.model";

export interface List {
    status: string;
    data: Menu[];
    pagination: Pagination;
}
