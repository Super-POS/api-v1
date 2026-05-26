import { Module }                      from '@nestjs/common';
import { PublicMeetingRoomController } from './controller';
import { PublicMeetingRoomService }    from './service';

@Module({
    controllers: [PublicMeetingRoomController],
    providers  : [PublicMeetingRoomService],
})
export class PublicMeetingRoomModule {}
