// ===========================================================================>> Custom Library
import { IsBase64Image } from "@app/core/decorators/base64-image.decorator";
import { IsNotEmpty, IsString } from "class-validator";

export class FileDto {

  @IsString()
  @IsNotEmpty()
  @IsBase64Image({
    message: "Invalid image format. Image must be base64 encoded JPEG or PNG.",
  })
  image: string;

  @IsString()
  @IsNotEmpty()
  folder: string;

 
}
