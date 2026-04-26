// ===========================================================================>> Custom Library
import { IsBase64Image } from "@app/core/decorators/base64-image.decorator";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateMenuTypeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @IsBase64Image({
    message: "Invalid image format. Image must be base64 encoded JPEG or PNG.",
  })
  image: string;
}

export class UpdateMenuTypeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  @IsBase64Image({
    message: "Invalid image format. Image must be base64 encoded JPEG or PNG.",
  })
  image: string;
}
