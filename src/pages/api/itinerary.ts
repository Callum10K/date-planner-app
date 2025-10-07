import { NextApiRequest, NextApiResponse } from 'next';
import { TripPlace } from '@prisma/client';
import { 
    getTripPlaces, 
    createTripPlace, 
    CreateTripPlaceData 
} from '../../services/prisma_service';
import { 
    isAdminOrTrustedAuthorized, 
    isAuthorized // Keep for potential use
} from '../../utils/auth_utils'; // Import the unified authorization functions

type TripPlaceResponse = TripPlace[] | TripPlace | { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<TripPlaceResponse>) {
    try {
        if (req.method === 'GET') {
            // --- READ (Public) ---
            // Anyone can view the itinerary.
            const dayQuery = req.query.day;
            let dayFilter: number | undefined = undefined;

            if (dayQuery) {
                const day = Array.isArray(dayQuery) ? dayQuery[0] : dayQuery;
                const parsedDay = parseInt(day, 10);

                if (isNaN(parsedDay) || parsedDay < 1) { 
                    return res.status(400).json({ error: 'Invalid day parameter. Must be a positive integer.' }); 
                }
                dayFilter = parsedDay;
            }
            
            const itinerary = await getTripPlaces(dayFilter);
            return res.status(200).json(itinerary);

        } else if (req.method === 'POST') {
            // --- CREATE (Trusted Protected) ---
            // This action is privileged but shared between Admin and Trusted User.
            if (!isAuthorized(req, 'admin')) {
                return res.status(403).json({ error: 'Forbidden: Authentication required to create new itinerary places.' });
            }

            const { day, time, name, purpose, notes, latitude, longitude } = req.body;
            
            // Basic data validation
            if (!day || typeof day !== 'number' || !time || !name || !purpose || 
                latitude === undefined || typeof latitude !== 'number' || 
                longitude === undefined || typeof longitude !== 'number') {
                return res.status(400).json({ error: 'Missing or invalid required fields for TripPlace creation. Ensure day, time, name, purpose, latitude, and longitude are correctly provided.' });
            }

            const placeData: CreateTripPlaceData = { 
                day, 
                time, 
                name, 
                purpose, 
                notes: notes || null, 
                latitude, 
                longitude 
            };
            const newPlace = await createTripPlace(placeData);
            
            return res.status(201).json(newPlace);
        } 
        
        return res.status(405).json({ error: 'Method Not Allowed' });
    } catch (error) {
        console.error(`Error in /api/itinerary handler (${req.method}):`, error);
        return res.status(500).json({ error: 'Failed to process itinerary request due to a server error.' });
    }
}
