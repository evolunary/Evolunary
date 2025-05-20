/**
 * Evolunary Auth Routes
 * Handles wallet-based authentication, token refresh, and identity verification
 * @module routes/auth
 */

import { Router } from 'express';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import { randomBytes } from 'crypto';
import { User, createUser, getUserByWallet } from '../user/user';
import { createTokenPair, refreshAccessToken } from '../auth/token';
import { authenticatedMust, AuthenticatedRequest } from '../auth/middleware';

const router = Router();

// Initialize wallet connection (returns message to sign)
router.get('/wallet/connect/init', async (req, res) => {
    const message = `Sign this message to connect your wallet: ${randomBytes(32).toString('hex')}`;
    res.json({ message, nonce: `${Math.floor(Date.now() / 1000)}` });
});

// Connect wallet and authenticate user
router.post('/wallet/connect', async (req, res) => {
    const { publicKey, signature, message } = req.body;

    if (!publicKey || !signature || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const verified = nacl.sign.detached.verify(
        Buffer.from(message),
        Buffer.from(signature, 'base64'),
        new PublicKey(publicKey).toBytes()
    );

    if (!verified) {
        return res.status(401).json({ error: 'Invalid signature', code: 'INVALID_SIGNATURE' });
    }

    let user = await getUserByWallet(publicKey);
    if (!user) {
        user = await createUser({
            id: randomBytes(16).toString('hex'),
            walletAddress: publicKey,
            username: `user_${randomBytes(4).toString('hex')}`,
            role: 'user',
            bio: '',
            avatarUrl: '',
            fullName: '',
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }

    const tokens = await createTokenPair(user.id, user.walletAddress);

    res.cookie('csrf-token', tokens.csrfToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
        user: {
            id: user.id,
            username: user.username,
            walletAddress: user.walletAddress,
            bio: user.bio,
            avatarUrl: user.avatarUrl,
            fullName: user.fullName,
            role: user.role,
            createdAt: user.createdAt
        },
        tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken
        }
    });
});

// Refresh access token using valid refresh + CSRF tokens
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    const csrfToken = req.headers['x-csrf-token'] as string;

    if (!refreshToken || !csrfToken) {
        return res.status(400).json({ error: 'Missing refresh or CSRF token' });
    }

    const tokens = await refreshAccessToken(refreshToken, csrfToken);

    res.cookie('csrf-token', tokens.csrfToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
        tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken
        }
    });
});

// Invalidate session (clears CSRF cookie, blacklisting optional)
router.post('/logout', authenticatedMust, async (_req: AuthenticatedRequest, res) => {
    res.clearCookie('csrf-token');
    res.json({ message: 'Logged out' });
});

// Verify identity of authenticated user
router.get('/verify', authenticatedMust, async (req: AuthenticatedRequest, res) => {
    const { walletAddress } = req.user!;
    const user = await getUserByWallet(walletAddress);

    if (!user) return res.status(401).json({ error: 'User not found' });

    res.json({
        authenticated: true,
        user: {
            id: user.id,
            username: user.username,
            walletAddress: user.walletAddress,
            role: user.role,
            bio: user.bio,
            avatarUrl: user.avatarUrl,
            fullName: user.fullName,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        }
    });
});

export default router;
