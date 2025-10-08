import { NextApiRequest, NextApiResponse } from 'next';
import { TripPlace } from '../../../../app/generated/prisma';
import { 
    updateTripPlace, 
    deleteTripPlace, 
    UpdateTripPlaceData 
} from '../../../services/prisma_service';
import { 
    isAuthorized,
    isAdminOrTrustedAuthorized
} from '../../../utils/auth_utils';

type SingleTripPlaceResponse = TripPlace | { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<SingleTripPlaceResponse>) {
    
    const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;

    if (!id) {
        return res.status(400).json({ error: 'TripPlace ID is required in the URL path.' });
    }

    try {
        if (req.method === 'PUT') {
            // --- UPDATE (Trusted Protected) ---
            // Allow both Admin and Trusted User to update itinerary details.
            if (!isAdminOrTrustedAuthorized(req)) {
                return res.status(403).json({ error: 'Forbidden: Authentication required to update itinerary places.' });
            }

            const updateData: UpdateTripPlaceData = req.body;

            // Simple validation to ensure update data is not empty
            if (Object.keys(updateData).length === 0) {
                 return res.status(400).json({ error: 'Request body is empty. Please provide fields to update.' });
            }

            const updatedPlace = await updateTripPlace(id, updateData);
            return res.status(200).json(updatedPlace);

        } else if (req.method === 'DELETE') {
            // --- DELETE (Admin-Only Protected) ---
            // Restrict deletion to only the highest privilege role (Admin).
            if (!isAuthorized(req, 'admin')) {
                return res.status(403).json({ error: 'Forbidden: Only the Admin is authorized to delete itinerary places.' });
            }
            
            const deletedPlace = await deleteTripPlace(id);
            return res.status(200).json(deletedPlace); 
        } 
        
        return res.status(405).json({ error: 'Method Not Allowed' });

    } catch (error: any) {
        console.error(`Error in /api/itinerary/[id] handler (${req.method}):`, error);
        
        // Handle Prisma "Record not found" error
        if (error.code === 'P2025') {
            return res.status(404).json({ error: `TripPlace not found with ID: ${id}` });
        }
        
        return res.status(500).json({ error: 'Failed to process itinerary request due to a server error.' });
    }
}
