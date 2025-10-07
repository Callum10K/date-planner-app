import { NextApiRequest, NextApiResponse } from 'next';
import { Suggestion, SuggestionStatus } from '@prisma/client';
import { updateSuggestionStatus } from '../../../services/prisma_service'; // Assumes service path
import { isAdminAuthorized } from '../../../utils/auth_utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse<Suggestion | { error: string }>) {
  
  // --- ADMIN AUTH CHECK ---
  if (!isAdminAuthorized(req)) {
    return res.status(403).json({ error: 'Forbidden: Admin access required to update suggestion status.' });
  }

  // 1. Enforce PATCH method
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method Not Allowed. Only PATCH is supported for status updates.' });
  }
  
  // 2. Extract dynamic ID
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;

  if (!id) {
    return res.status(400).json({ error: 'Suggestion ID is required in the URL path.' });
  }

  try {
    // 3. Get new status from body
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ error: 'Missing required field: status is mandatory for PATCH request body.' });
    }

    // 4. Validate the status against the Enum
    const statusUpper = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    
    if (!Object.values(SuggestionStatus).includes(statusUpper as SuggestionStatus)) {
        return res.status(400).json({ error: 'Invalid status value. Must be "Pending", "Approved", or "Rejected".' });
    }

    // 5. Call the service to update
    const updatedSuggestion = await updateSuggestionStatus(id, statusUpper as SuggestionStatus);

    // 6. Return the updated suggestion
    return res.status(200).json(updatedSuggestion);

  } catch (error: any) {
    console.error(`Error in /api/suggestions/[id] handler (PATCH):`, error);
    if (error.code === 'P2025') {
        return res.status(404).json({ error: `Suggestion not found with ID: ${id}` });
    }
    return res.status(500).json({ error: 'Failed to update suggestion status due to a server error.' });
  }
}
