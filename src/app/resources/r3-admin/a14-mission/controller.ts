// ===========================================================================>> Core Library
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { AdminMissionService } from './mission.service';
import { AdminStampService }   from './stamp.service';
import { CreateMissionDto, UpdateMissionDto, CreateStampDto, UpdateStampDto } from './dto';

@Controller()
export class AdminMissionController {

    constructor(
        private readonly _missionService: AdminMissionService,
        private readonly _stampService  : AdminStampService,
    ) {}

    // =============================================>> Stamp endpoints

    @Get('stamps')
    async listStamps() {
        return { data: await this._stampService.list() };
    }

    @Get('stamps/:id')
    async getStamp(@Param('id') id: string) {
        return { data: await this._stampService.findOne(Number(id)) };
    }

    @Post('stamps')
    async createStamp(@Body() body: CreateStampDto) {
        const data = await this._stampService.create(body);
        return { data, message: 'Stamp created successfully.' };
    }

    @Patch('stamps/:id')
    async updateStamp(@Param('id') id: string, @Body() body: UpdateStampDto) {
        const data = await this._stampService.update(Number(id), body);
        return { data, message: 'Stamp updated successfully.' };
    }

    @Delete('stamps/:id')
    async removeStamp(@Param('id') id: string) {
        await this._stampService.remove(Number(id));
        return { message: 'Stamp deleted successfully.' };
    }

    // =============================================>> Mission endpoints

    @Get()
    async listMissions() {
        return { data: await this._missionService.list() };
    }

    @Get(':id')
    async getMission(@Param('id') id: string) {
        return { data: await this._missionService.findOne(Number(id)) };
    }

    @Post()
    async createMission(@Body() body: CreateMissionDto) {
        const data = await this._missionService.create(body);
        return { data, message: 'Mission created successfully.' };
    }

    @Patch(':id')
    async updateMission(@Param('id') id: string, @Body() body: UpdateMissionDto) {
        const data = await this._missionService.update(Number(id), body);
        return { data, message: 'Mission updated successfully.' };
    }

    @Delete(':id')
    async removeMission(@Param('id') id: string) {
        await this._missionService.remove(Number(id));
        return { message: 'Mission deleted successfully.' };
    }

    @Get(':id/participants')
    async listParticipants(@Param('id') id: string) {
        return { data: await this._missionService.listParticipants(Number(id)) };
    }
}
