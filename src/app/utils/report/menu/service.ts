//===> core library
import { Injectable } from "@nestjs/common";
//===> custom library
import { MenuPDFService }         from "./pdf-service";
import { MenuExcelReportService } from "./excel-service";

@Injectable()
export class MenuReportService {

    constructor(
        private readonly _productPDFservice  : MenuPDFService,
        private readonly _productExcelService: MenuExcelReportService,
    ) { }
    // ===> Method to generate report
    async generate(
        // params?:{
        //     page?       : number,
        //     limit?      : number,
        //     key?        : string,
        //     type?       : number,
        //     creator?    : number,
        userId      : number,
        startDate?  : string,
        endDate?    : string,
        //     sort_by?    : string,
        //     order?      : string,
        // }
        report_type : string = 'PDF'
    ){
        if(report_type === 'PDF'){
            return await this._productPDFservice.generate(startDate, endDate, userId);
        }else{
            return await this._productExcelService.generate(startDate, endDate,userId);
        }
    }
}