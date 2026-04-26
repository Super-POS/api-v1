// =========================================================================>> Core Library
import {
    CallHandler,
    ConflictException,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';

// =========================================================================>> Third Party Library
import { Observable, of, tap } from 'rxjs';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
    response  : unknown;
    expiresAt : number;
    processing: boolean;
}

// Module-level singleton so the cache survives across request scopes
const idempotencyStore = new Map<string, CacheEntry>();

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const request = context.switchToHttp().getRequest<any>();
        const key     = request.headers?.['idempotency-key'] as string | undefined;

        // If no key provided, pass through without caching
        if (!key) return next.handle();

        const userId   = request.user?.id ?? 'anon';
        const cacheKey = `${userId}:${key}`;

        const cached = idempotencyStore.get(cacheKey);

        if (cached) {
            // Another concurrent request with the same key is still in-flight
            if (cached.processing) {
                throw new ConflictException(
                    'A request with this Idempotency-Key is already being processed. Please retry after a moment.'
                );
            }

            // Valid cached response — return it immediately (idempotent replay)
            if (cached.expiresAt > Date.now()) {
                return of(cached.response);
            }

            // Expired entry — remove and re-process
            idempotencyStore.delete(cacheKey);
        }

        // Mark as in-flight
        idempotencyStore.set(cacheKey, {
            response  : null,
            expiresAt : Date.now() + CACHE_TTL_MS,
            processing: true,
        });

        return next.handle().pipe(
            tap({
                next: (response) => {
                    idempotencyStore.set(cacheKey, {
                        response,
                        expiresAt : Date.now() + CACHE_TTL_MS,
                        processing: false,
                    });
                },
                error: () => {
                    // On error, evict the entry so the client can retry
                    idempotencyStore.delete(cacheKey);
                },
            }),
        );
    }
}
