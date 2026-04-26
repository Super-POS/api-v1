// ===========================================================================>> Core Library
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

// ===========================================================================>> Third party Library
import { Sequelize } from "sequelize";

// ===========================================================================>> Custom Library
import { TelegramService } from "@app/resources/r4-testing/third-party/telegram/service";

import { FileService } from "@app/services/file.service";
import Menu from "@app/models/menu/menu.model";
import MenuType from "@app/models/menu/menu-type.model";
import { CreateMenuTypeDto, UpdateMenuTypeDto } from "./dto";

@Injectable()
export class MenuTypeService {
  constructor(
    private readonly _fileService: FileService,
    private readonly _telegramService: TelegramService
  ) {}

  // ==========================================>> get data
  async getData() {
    try {
      const data = await MenuType.findAll({
        attributes: [
          "id",
          "name",
          "image",
          "created_at",
          [
            Sequelize.fn("COUNT", Sequelize.col("menus.id")),
            "n_of_products",
          ],
        ],
        include: [
          {
            model: Menu,
            as: "menus",
            attributes: [],
            required: false,
          },
        ],
        group: ["MenuType.id"],
        order: [["name", "ASC"]],
      });

      return {
        data: data,
      };
    } catch (error) {
      throw new BadRequestException("admin/menu/category/getData", error);
    }
  }

  // ==========================================>> create
  async create(body: CreateMenuTypeDto): Promise<any> {
    // ===>> Upload Image
    const result = await this._fileService.uploadBase64Image(
      "productType", // Folder Name
      body.image // the image as base64 from client
    );

    // ===>> Save to DB
    // Save to DB
    const data = await MenuType.create({
      name: body.name,
      image: result.data.uri,
    });

    // Respon
    // ===>> Prepare format to Client
    const dataFormat = {
      data: data,
      message: "Menu category has been created.",
    };

    // ===>> Send to TG
    // await this._telegramService.sendMessage('7885972832:AAHsu-ttVH9h0QW0CLyndcMxEGe44aCdrh4', '-1002649512007', 'Menu Type: '+ body.name + ' has been created.');

    // ===>> Return to Client
    return dataFormat;
  }

  // ==========================================>> update
  async update(body: UpdateMenuTypeDto, id: number): Promise<any> {
    // Check if submitted data is valide.
    const checkedData = await MenuType.findByPk(id);

    if (!checkedData) {
      throw new NotFoundException("Menu category is not found.");
    }

    // Check if Image is submitted.
    if (this._isBase64(body.image)) {
      // Upload the image to file service.
      const result = await this._fileService.uploadBase64Image(
        "productType", // Folder Name
        body.image // the image as base64 from client
      );

      // Update the body.image from base64 to uri.
      body.image = result.data.uri;
    }

    // Save the updated data to DB.
    await MenuType.update(body, {
      where: { id: id },
    });

    // get the updated data from DB
    const data = await MenuType.findByPk(id);

    // Prepare response format.
    const dataFormat = {
      data: data,
      message: "Menu category has been updated.",
    };

    // return back to client
    return dataFormat;
  }

  // ==========================================>> delete
  async delete(id: number): Promise<any> {
    // Check if submitted data is valide.
    const checkedData = await MenuType.findByPk(id);

    if (!checkedData) {
      throw new NotFoundException("Menu category is not found.");
    }

    // Delete from DB.
    await MenuType.destroy({
      where: { id: id },
    });

    // Response back to client
    return { message: "Data has been deleted successfully." };
  }

  // for checking if a string is realy base64
  private _isBase64(input: string): boolean {
    if (!input || typeof input !== "string") return false;

    // If input is a data URI (e.g., data:image/png;base64,...), extract the Base64 part
    const base64Part = input.includes("base64,")
      ? input.split("base64,")[1]
      : input;

    // Remove any surrounding whitespace
    const trimmed = base64Part.trim();

    // Must be length divisible by 4
    if (trimmed.length % 4 !== 0) return false;

    // Validate using regex
    const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;

    return base64Regex.test(trimmed);
  }
}
