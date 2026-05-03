// ===========================================================================>> Core Library
import { BadRequestException, Body, Controller, Headers, HttpCode, HttpStatus, Logger, Post, Req, UnauthorizedException, UsePipes } from '@nestjs/common';

// ===========================================================================>> Costom Library
import UserDecorator from '@app/core/decorators/user.decorator';
import { RoleExistsPipe } from '@app/core/pipes/role.pipe';
import User from '@app/models/user/user.model';
import { LoginRequestDto, LoginRequestOTPDto, RegisterDto, TelegramBotLoginDto, TelegramWebAppLoginDto } from './dto';
import { AuthService } from './service';

@Controller()
export class AuthController {

    private readonly logger = new Logger(AuthController.name);

    constructor(private readonly authService: AuthService) { }

    @Post('register')
    async register(@Body() body: RegisterDto) {
        return await this.authService.register(body);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(@Body() data: LoginRequestDto, @Req() req: Request) {
        return await this.authService.login(data, req);
    }

    @Post('check-user')
    async checkExistUser(@Body('username') username: string) {
        if (!username) {
            throw new BadRequestException('Email or phone is required');
        }
        return await this.authService.checkExistUser(username);
    }

    @Post('send-otp')
    async sendOTP(@Body('username') username: string) {
        if (!username) {
            throw new BadRequestException('Email or phone is required');
        }
        return await this.authService.sendOTP(username);
    }

    @Post('verify-otp')
    async verifyOTP(@Body() body: LoginRequestOTPDto, @Req() req: Request
    ) {
        return await this.authService.verifyOTP(body, req);
    }

    @Post('telegram-webapp')
    @HttpCode(HttpStatus.OK)
    async telegramWebAppLogin(@Body() body: TelegramWebAppLoginDto, @Req() req: Request) {
        return await this.authService.telegramWebAppLogin(body, req);
    }

    /** Server-to-server: Telegram bot calls this after /start with shared secret (not callable by browsers). */
    @Post('telegram-bot')
    @HttpCode(HttpStatus.OK)
    async telegramBotLogin(
        @Body() body: TelegramBotLoginDto,
        @Req() req: Request,
        @Headers('x-telegram-bot-secret') secret: string | undefined,
    ) {
        const expectedRaw = process.env.TELEGRAM_BOT_SERVER_SECRET ?? '';
        const expected = expectedRaw.trim();
        const provided = (secret ?? '').trim();

        this.logger.log(
            `[telegram-bot] POST body.platform=${body.platform} telegram_user_id=${body.user?.id} ` +
                `secretHeader=present(headerLen=${provided.length}) apiSecretConfigured=${Boolean(expected)}(envLen=${expected.length})`,
        );

        if (!expected) {
            this.logger.warn('[telegram-bot] Reject: TELEGRAM_BOT_SERVER_SECRET is empty or whitespace on API');
            throw new UnauthorizedException('Invalid bot credentials');
        }
        if (!provided) {
            this.logger.warn('[telegram-bot] Reject: missing X-Telegram-Bot-Secret header');
            throw new UnauthorizedException('Invalid bot credentials');
        }
        if (provided !== expected) {
            this.logger.warn(
                `[telegram-bot] Reject: secret mismatch after trim ` +
                    `(headerLen=${provided.length} envLen=${expected.length} ` +
                    `headerHadWhitespace=${(secret ?? '') !== provided} envHadWhitespace=${expectedRaw !== expected})`,
            );
            throw new UnauthorizedException('Invalid bot credentials');
        }

        const out = await this.authService.telegramBotTrustedLogin(body, req);
        this.logger.log(`[telegram-bot] Success telegram_user_id=${body.user.id}`);
        return out;
    }

    @Post('switch')
    @UsePipes(RoleExistsPipe)
    async switch(@UserDecorator() auth: User, @Body() body: { role_id: number }) {
        return await this.authService.switchDefaultRole(auth, Number(body.role_id));
    }

}
