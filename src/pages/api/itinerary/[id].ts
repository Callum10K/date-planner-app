import { NextApiRequest, NextApiResponse } from 'next';
import { TripPlace } from '@prisma/client';
import { 
    updateTripPlace, 
    deleteTripPlace, 
    UpdateTripPlaceData 
} from '../../../services/prisma_service';
import { isAdminAuthorized } from '../../../utils/auth_utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse<TripPlace | { error: string }>) {
  
  // --- ADMIN AUTH CHECK ---
  if (!isAdminAuthorized(req)) {
    return res.status(403).json({ error: 'Forbidden: Admin access required for modification.' });
  }

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;

  if (!id) {
    return res.status(400).json({ error: 'TripPlace ID is required in the URL path.' });
  }

  try {
    if (req.method === 'PUT') {
      // --- UPDATE (Admin Protected) ---
      const updateData: UpdateTripPlaceData = req.body;
      const updatedPlace = await updateTripPlace(id, updateData);
      return res.status(200).json(updatedPlace);

    } else if (req.method === 'DELETE') {
      // --- DELETE (Admin Protected) ---
      const deletedPlace = await deleteTripPlace(id);
      return res.status(200).json(deletedPlace); 
    } 
    
    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error: any) {
    console.error(`Error in /api/itinerary/[id] handler (${req.method}):`, error);
    if (error.code === 'P2025') {
        return res.status(404).json({ error: `TripPlace not found with ID: ${id}` });
    }
    return res.status(500).json({ error: 'Failed to process itinerary request due to a server error.' });
  }
}
