import './bootstrap-env';

// ===========================================================================>> Core Library
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
// ===========================================================================>> Third Party Library
import * as express from 'express';
import * as expressHandlebars from 'express-handlebars';
import { join } from 'path';
// ===========================================================================>> Costom Library
import { AppModule } from './app/app.module';

class AppInitializer {

    private readonly logger = new Logger(AppInitializer.name);
    private app: NestExpressApplication;

    private async initializeApplication() {
        this.app = await NestFactory.create<NestExpressApplication>(AppModule);
        this.configureMiddlewares();
        this.configureViews();
        this.configuareAssets();
    }

    private configureMiddlewares() {
        const defaultOrigins = [
            'http://localhost:3000',
            'http://localhost:4444',
            'http://localhost:4200',
            'https://33c8-103-206-69-209.ngrok-free.app',
            // 'https://9f63-96-9-79-108.ngrok-free.app',
            'http://localhost:9007',
            'http://localhost',
            'http://localhost:9004',
            'http://localhost:9008',
            'http://localhost:9003',
            'http://localhost:9006',
            'http://localhost:3001',
            'http://pos.navahub.org',
            'https://pos.navahub.org',
            'http://www.pos.navahub.org',
            'https://www.pos.navahub.org',
            'http://34.142.211.96',
        ];
        const envOrigins = (process.env.CORS_ORIGINS || '')
            .split(',')
            .map((origin) => origin.trim())
            .filter(Boolean);
        const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

        // Hostname patterns we always allow — common dev tunneling services. Telegram requires HTTPS,
        // so customer_web_v1 + telegram-mini-app are typically reached through ngrok / cloudflared
        // tunnels whose hostnames rotate on every restart. We accept any subdomain of those services
        // so devs don't have to redeploy the API every time the tunnel URL changes.
        const allowedOriginHostPatterns: RegExp[] = [
            /\.ngrok-free\.app$/i,
            /\.ngrok\.io$/i,
            /\.ngrok\.app$/i,
            /\.ngrok\.dev$/i,
            /\.trycloudflare\.com$/i,
            /\.loca\.lt$/i,
        ];
        const matchesAllowedPattern = (origin: string): boolean => {
            try {
                const host = new URL(origin).hostname;
                return allowedOriginHostPatterns.some((re) => re.test(host));
            } catch {
                return false;
            }
        };

        this.app.enableCors({
            origin: (origin, callback) => {
                // Allow non-browser tools (Postman/curl) and same-machine server calls.
                if (!origin) {
                    return callback(null, true);
                }
                if (allowedOrigins.includes(origin) || matchesAllowedPattern(origin)) {
                    return callback(null, true);
                }
                this.logger.warn(`CORS blocked for origin: ${origin}`);
                return callback(new Error(`CORS blocked for origin: ${origin}`), false);
            },
            credentials: true,
            allowedHeaders: [
                'Content-Type',
                'Authorization',
                'Accept',
                'Origin',
                'X-Requested-With',
                'withcredentials',
                'Cache-Control',
                'Pragma',
            ],
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        });
        this.app.useGlobalPipes(new ValidationPipe({
            whitelist: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }));
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ limit: '50mb', extended: true }));
    }

    private configureViews() {
        this.app.setBaseViewsDir(join(__dirname, '..', 'src'));
        const hbs = expressHandlebars.create({
            extname: '.html',
            layoutsDir: join(__dirname, '..', 'src'),
            defaultLayout: null
        });
        this.app.engine('html', hbs.engine);
        this.app.setViewEngine('html');
    }

    private configuareAssets() {
        this.app.useStaticAssets(join(__dirname, '..', 'public'));
    }

    public async start(port: number) {
        try {

            await this.initializeApplication();
            await this.app.listen(port);
            
            this.logger.log(`\x1b[32m Application running on host: \x1b[34mhttp://localhost:${port}\x1b[37m`);
        
        } catch (error) {
            this.logger.error(`\x1b[31mError starting the server: ${error.message}\x1b[0m`);
            process.exit(1);
        }
    }
    
}

const appInitializer = new AppInitializer();
appInitializer.start(Number(process.env.PORT) || 3000);
