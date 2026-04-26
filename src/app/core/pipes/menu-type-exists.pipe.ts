// ================================================================>> Core Library
import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

// ================================================================>> Costom Library
import MenuType from '@app/models/menu/menu-type.model';

@Injectable()
export class MenuTypeExistsPipe implements PipeTransform {

    async transform(value: any, metadata: ArgumentMetadata) {
        if (metadata.type === 'body' && value?.type_id) {
            const typeId = value.type_id;
            const type = await MenuType.findByPk(typeId);
            if (!type) {
                throw new BadRequestException(`Invalid type_id value: ${typeId}`);
            }
        }
        return value;
    }
}
