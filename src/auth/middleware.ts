/**
 * Enforces token-based access control on protected routes.
 * Part of Evolunary's internal API security layer.
 */

import { Request, Response, NextFunction } from 'express';
import { verifyTokens } from './token';

/**
 * Request extended with verified user context
 */
export interface AuthenticatedRequest extends Request {
    user?: {
        userId: string;
        walletAddress: string;
    };
}

/**
 * Rejects unauthenticated requests.
 * Requires both bearer token and CSRF token to pass.
 */
export async function authenticatedMust(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const authHeader = req.headers.authorization;
        const csrfToken = req.headers['x-csrf-token'] as string;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or malformed authorization header' });
        }

        if (!csrfToken) {
            return res.status(401).json({ error: 'Missing CSRF token' });
        }

        const token = authHeader.split(' ')[1];
        const userData = await verifyTokens(token, csrfToken);

        req.user = userData;
        next();
    } catch (err) {
        console.error('Auth middleware error:', err);
        res.status(401).json({ error: 'Authentication failed' });
    }
}
