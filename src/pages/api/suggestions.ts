import { NextApiRequest, NextApiResponse } from 'next';
import { Suggestion, SuggestionStatus } from '../../../app/generated/prisma';
import { 
    createSuggestion, 
    getSuggestions, 
    CreateSuggestionData,
    updateSuggestionStatus
} from '../../services/prisma_service';
import { isAuthorized, isAdminOrTrustedAuthorized  } from '../../utils/auth_utils';

// Define the response type for clarity
type SuggestionResponse = Suggestion[] | Suggestion | { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<SuggestionResponse>) {
    try {
        if (req.method === 'GET') {
            // --- READ INBOX (Admin Protected) ---
            // Only the Admin should view the full inbox, ensuring full visibility and control is centralized.
            if (!isAuthorized(req, 'admin')) {
                return res.status(403).json({ error: 'Forbidden: Admin access required to view the inbox.' });
            }

            const statusQuery = req.query.status as string;
            let statusFilter: SuggestionStatus | undefined = undefined;

            // Handle status filtering logic (e.g., /api/suggestions?status=pending)
            if (statusQuery) {
                const statusUpper = statusQuery.toUpperCase() as SuggestionStatus;
                if (Object.values(SuggestionStatus).includes(statusUpper)) {
                    statusFilter = statusUpper;
                } else {
                    return res.status(400).json({ error: 'Invalid status filter. Must be "pending", "approved", or "rejected".' });
                }
            }

            const suggestions = await getSuggestions(statusFilter);
            return res.status(200).json(suggestions);

        } else if (req.method === 'POST') {
            // --- CREATE (Public) ---
            // User submissions are public, so no auth check is needed here.
            const { userId, title, text } = req.body;

            if (!userId || !title || !text) {
                return res.status(400).json({ error: 'Missing required fields: userId, title, and text are mandatory.' });
            }

            const suggestionData: CreateSuggestionData = { userId, title, text };
            const newSuggestion = await createSuggestion(suggestionData);

            return res.status(201).json(newSuggestion);

        } else if (req.method === 'PATCH') {
            // --- UPDATE STATUS (Trusted User Protected) ---
            // Allow both Admin and Trusted User to approve/reject suggestions.
            if (!isAdminOrTrustedAuthorized(req)) {
                return res.status(403).json({ error: 'Forbidden: Trusted user access required to update suggestions.' });
            }

            const { id, status } = req.body;

            if (!id || !status) {
                return res.status(400).json({ error: 'Missing required fields: id and status are mandatory for updating.' });
            }
            
            const statusUpper = status.toUpperCase() as SuggestionStatus;

            if (!Object.values(SuggestionStatus).includes(statusUpper)) {
                return res.status(400).json({ error: 'Invalid status provided. Must be "pending", "approved", or "rejected".' });
            }

            const updatedSuggestion = await updateSuggestionStatus(id, statusUpper);
            return res.status(200).json(updatedSuggestion);
        }
        
        return res.status(405).json({ error: 'Method Not Allowed' });
    } catch (error) {
        console.error(`Error in /api/suggestions handler (${req.method}):`, error);
        return res.status(500).json({ error: 'Failed to process suggestion request due to a server error.' });
    }
}
