// =========================================================================>> Core Library
import { HttpService }      from '@nestjs/axios';
import { BadRequestException, Injectable }       from '@nestjs/common';
import { firstValueFrom }   from 'rxjs';
import { AxiosError } from 'axios';

// ===========================================================================>> Custom Library
interface UploadBase64ImageBody {
    folder: string;
    image: string;
}

export interface FileServiceUploadData {
    uri: string;
    originalname?: string;
    mimetype?: string;
    size?: number;
}

/** HTTP JSON body returned by `file-v1` after a successful `upload-base64` call. */
type FileServiceHttpData = { data?: FileServiceUploadData; message?: string; status_code?: number };

@Injectable()
export class FileService {

    constructor(private readonly _httpService: HttpService) { }

    public async uploadBase64Image(
        folder: string,
        base64: string,
    ): Promise<{ message: string; data: FileServiceUploadData }> {
        const base = (process.env.FILE_BASE_URL || '').replace(/\/$/, '');
        if (!base) {
            throw new BadRequestException('FILE_BASE_URL is not set on the API. Point it at the file service base URL (e.g. http://localhost:9006).');
        }
        const url = `${base}/api/file/upload-base64`;
        const payload: UploadBase64ImageBody = { folder, image: base64 };

        try {
            const response = await firstValueFrom(
                this._httpService.post<FileServiceHttpData>(url, payload, {
                    timeout: 300_000,
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity,
                }),
            );
            const raw = response.data?.data;
            if (!raw || typeof raw !== 'object' || !raw.uri || typeof raw.uri !== 'string' || !String(raw.uri).trim()) {
                throw new BadRequestException(
                    'File service did not return a non-empty "uri" in response.data. Check the file service is running and the upload endpoint matches.',
                );
            }
            // Store a single, predictable shape: "api/file/<filename>" (no leading slash) for clients to join with FILE_BASE_URL
            const uri = String(raw.uri).trim().replace(/^\/+/, '');
            return {
                message: 'File has been uploaded to file service',
                data: { ...raw, uri },
            };
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            const ax = error as AxiosError<{ message?: string; error?: string }>;
            const body = ax?.response?.data;
            const remoteMsg =
                typeof body === 'object' && body !== null
                    ? (body as { message?: string }).message || (body as { error?: string }).error
                    : undefined;
            const msg =
                remoteMsg
                || ax?.message
                || (error as Error).message
                || 'File upload request failed';
            const code = ax?.response?.status;
            const suffix = code ? ` (HTTP ${code})` : '';
            throw new BadRequestException(`File service upload failed${suffix}: ${msg}`);
        }
    }
}
