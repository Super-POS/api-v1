import { ForbiddenException, Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class SuperUserMiddleware implements NestMiddleware {

    use(req: Request, res: Response, next: NextFunction) {
        const userRoles = res.locals.userRoles as { id: number; slug: string; is_default: boolean }[] | undefined;

        if (!userRoles || userRoles.length === 0) {
            throw new UnauthorizedException('Unauthorized: No roles found.');
        }

        const superUserRole = userRoles.find(role => role.slug === 'super-user');

        if (superUserRole) {
            res.locals.roleId = superUserRole.id;
            superUserRole.is_default = true;
        } else {
            throw new ForbiddenException('Access denied. Super User role required to access ERP.');
        }

        next();
    }
}
