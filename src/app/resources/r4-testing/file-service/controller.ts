// =========================================================================>> Core Library
import { Body, Controller, Post} from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';

// =========================================================================>> Custom Library
import { FileDto } from "./dto";


interface UploadBase64ImageBody {
    folder: string;
    image: string;
}



// ======================================= >> Code Starts Here << ========================== //
@Controller()
export class FileController {

    constructor(private readonly httpService: HttpService) { }

    // ====================================================>> Sum 1
    @Post('file')
    async uploadFile(
        @Body() body: FileDto // Catch file from Post
    ){


        // Prepare Payload
        const payload: UploadBase64ImageBody = {
            image   : body.image,
            folder  : body.folder
        };

        // Prepare Response from File Service and Return to Postman
        const result: { file?: File, error?: string } = {};

        // Call File Serivce
        try {

            const response = await firstValueFrom(this.httpService.post('http://localhost:4000/api/file/upload-base64', payload));
            result.file = response.data.data;

        } catch (error) {
            result.error = error?.response?.data?.message || 'Something went wrong';
        }

        // Return to Postman
        return {
            message: "File has been uploaded to file service", 
            result: result.file
        };


    }

    
    
}
