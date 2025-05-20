/**
 * Evolunary User Routes
 * Exposes user profile retrieval for authenticated identities
 * @module routes/users
 */

import { Router } from 'express';
import { authenticatedMust, AuthenticatedRequest } from '../auth/middleware';
import { getUser } from '../user/user';

const router = Router();

// GET /users/profile
// Returns full profile metadata for the currently authenticated user
router.get('/profile', authenticatedMust, async (req: AuthenticatedRequest, res) => {
    const { userId } = req.user!;

    try {
        const user = await getUser(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

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
            }
        });
    } catch (error) {
        console.error('Error loading user profile:', error);
        res.status(500).json({ error: 'Unable to fetch user profile' });
    }
});

export default router;
