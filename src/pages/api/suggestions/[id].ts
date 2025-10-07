import { NextApiRequest, NextApiResponse } from 'next';
import { Suggestion, SuggestionStatus } from '@prisma/client';
import { updateSuggestionStatus } from '../../../services/prisma_service';
import { 
    isAdminOrTrustedAuthorized 
} from '../../../utils/auth_utils'; // Using the collaborative authorization function

type SingleSuggestionResponse = Suggestion | { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<SingleSuggestionResponse>) {
    
    // --- AUTH CHECK (Trusted User Protected) ---
    // Allow both Admin and Trusted User to approve/reject suggestions.
    if (req.method === 'PATCH') {
        if (!isAdminOrTrustedAuthorized(req)) {
            return res.status(403).json({ error: 'Forbidden: Authentication required to update suggestion status.' });
        }
    } else {
        // Only PATCH is supported for this route
        return res.status(405).json({ error: 'Method Not Allowed. Only PATCH is supported for status updates.' });
    }

    const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;

    if (!id) {
        return res.status(400).json({ error: 'Suggestion ID is required in the URL path.' });
    }

    try {
        // 1. Get new status from body
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Missing required field: status is mandatory for PATCH request body.' });
        }

        // 2. Validate the status against the Enum
        // Note: We force validation to be case-insensitive by converting to uppercase before checking the enum.
        const statusUpper = status.toUpperCase() as SuggestionStatus;
        
        if (!Object.values(SuggestionStatus).includes(statusUpper)) {
            return res.status(400).json({ error: 'Invalid status value. Must be "pending", "approved", or "rejected".' });
        }

        // 3. Call the service to update
        const updatedSuggestion = await updateSuggestionStatus(id, statusUpper);

        // 4. Return the updated suggestion
        return res.status(200).json(updatedSuggestion);

    } catch (error: any) {
        console.error(`Error in /api/suggestions/[id] handler (PATCH):`, error);
        
        // Handle Prisma "Record not found" error
        if (error.code === 'P2025') {
            return res.status(404).json({ error: `Suggestion not found with ID: ${id}` });
        }
        
        return res.status(500).json({ error: 'Failed to update suggestion status due to a server error.' });
    }
}
