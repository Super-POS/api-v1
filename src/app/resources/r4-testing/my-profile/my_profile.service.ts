import MyProfile from "@app/models/my-profile/my_profile.model";
import User from "@app/models/user/user.model";
import { BadRequestException, HttpStatus, Injectable } from "@nestjs/common";
import { MyProfileDto } from "./my_profile.dto";


@Injectable()
export class MyProfileService {

    constructor() { };

    async getMyProfile() {
        try {

            const data = await MyProfile.findAll({
                attributes: ['id', 'creator_id', 'title', 'first_name', 'last_name', 'year', 'school'],
                include: [
                    {
                        model: User,
                        attributes: ['id', 'name', 'email']
                    }
                ],
                order: [["id", "DESC"]]
            })

            return {
                status: HttpStatus.OK,
                data: data,
            }

        } catch (error) {
            throw new BadRequestException(error)
        }
    }


    async create(userId: number, req: MyProfileDto) {
        try {

            const data = await MyProfile.create({
                creator_id: userId,
                title: req.title,
                first_name: req.first_name,
                last_name: req.last_name,
                school: req.school,
                year: req.year
            });

            return {
                status: HttpStatus.CREATED,
                data: data,
                message: "My profile create successfully"
            }

        } catch (error) {
            throw new BadRequestException(error)
        }
    }

}