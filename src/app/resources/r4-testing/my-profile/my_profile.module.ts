import { Module } from '@nestjs/common';

import { MyProfileController } from "./my_profile.controller";
import { MyProfileService } from './my_profile.service';


@Module({
    controllers   : [MyProfileController],
    providers     : [MyProfileService]
})

export class MyProfileModule { }
