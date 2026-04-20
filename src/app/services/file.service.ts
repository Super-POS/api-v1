// =========================================================================>> Core Library
import { HttpService }      from '@nestjs/axios';
import { Injectable }       from '@nestjs/common';
import { firstValueFrom }   from 'rxjs';


interface UploadBase64ImageBody {
    folder: string;
    image: string;
}


@Injectable()
export class FileService {
    

    constructor(private readonly _httpService: HttpService) { }


    public async uploadBase64Image(folder: string, base64: string): Promise<any> {
        
        // Prepare Payload
        const payload: UploadBase64ImageBody = {
            folder  : folder,
            image   : base64
           
        };

        // Prepare Response from File Service and Return to Postman
        let result = {};

        // Call File Serivce
        try {

            const response = await firstValueFrom(this._httpService.post(process.env.FILE_BASE_URL + '/api/file/upload-base64', payload));
            result = response.data.data;
           
        } catch (error) {
            // result.error = error?.response?.data?.message || 'Something went wrong';

        }

        // Return to Postman
        return {
            message: "File has been uploaded to file service", 
            data: result
        };
       

    }

}
