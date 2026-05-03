/**
 * Must be imported first from main.ts so api-v1/.env is loaded before AppModule.
 * Docker: image has no .env (see .dockerignore); compose mounts ./api-v1/.env -> /myapp/.env.
 */
import * as dotenv from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

const candidates = [join(process.cwd(), '.env'), join(__dirname, '..', '.env')];
for (const path of candidates) {
    if (existsSync(path)) {
        // Override existing keys so empty placeholders from the runtime do not block real values from .env.
        dotenv.config({ path, override: true });
        break;
    }
}
