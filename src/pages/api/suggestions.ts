import { NextApiRequest, NextApiResponse } from 'next';
import { Suggestion, SuggestionStatus } from '@prisma/client';
import { 
    createSuggestion, 
    getSuggestions, 
    CreateSuggestionData 
} from '../../services/prisma_service';
import { isAdminAuthorized } from '../../utils/auth_utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse<Suggestion[] | Suggestion | { error: string }>) {
  try {
    if (req.method === 'GET') {
      // --- READ INBOX (Admin Protected) ---
      if (!isAdminAuthorized(req)) {
        return res.status(403).json({ error: 'Forbidden: Admin access required to view the inbox.' });
      }

      const statusQuery = req.query.status as string;
      let statusFilter: SuggestionStatus | undefined = undefined;

      // [ ... status filtering logic ... ]
      if (statusQuery) {
        const statusUpper = statusQuery.charAt(0).toUpperCase() + statusQuery.slice(1).toLowerCase();
        if (Object.values(SuggestionStatus).includes(statusUpper as SuggestionStatus)) {
            statusFilter = statusUpper as SuggestionStatus;
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
    } 
    
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error(`Error in /api/suggestions handler (${req.method}):`, error);
    return res.status(500).json({ error: 'Failed to process suggestion request due to a server error.' });
  }
}
