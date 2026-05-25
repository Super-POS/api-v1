import { Module }             from '@nestjs/common';
import { AdminRoomController } from './room.controller';
import { AdminRoomService }    from './room.service';

@Module({
    controllers: [AdminRoomController],
    providers  : [AdminRoomService],
})
export class AdminMeetingRoomModule {}
