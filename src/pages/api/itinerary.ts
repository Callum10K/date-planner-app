import { NextApiRequest, NextApiResponse } from 'next';
import { TripPlace } from '@prisma/client';
import { isAdminAuthorized } from '../../utils/auth_utils';
import { 
    getTripPlaces, 
    createTripPlace, 
    CreateTripPlaceData 
} from '../../services/prisma_service';

export default async function handler(req: NextApiRequest, res: NextApiResponse<TripPlace[] | TripPlace | { error: string }>) {
  try {
    if (req.method === 'GET') {
      // --- READ (Public) ---
      // Reading the itinerary is public, so no authorization check is needed here.
      const dayQuery = req.query.day;
      let dayFilter: number | undefined = undefined;

      // [... day filtering logic ...]
      if (dayQuery) {
        const day = Array.isArray(dayQuery) ? dayQuery[0] : dayQuery;
        const parsedDay = parseInt(day, 10);
        if (isNaN(parsedDay) || parsedDay < 1) { return res.status(400).json({ error: 'Invalid day parameter.' }); }
        dayFilter = parsedDay;
      }
      
      const itinerary = await getTripPlaces(dayFilter);
      return res.status(200).json(itinerary);

    } else if (req.method === 'POST') {
      // --- CREATE (Admin Protected) ---
      if (!isAdminAuthorized(req)) {
        return res.status(403).json({ error: 'Forbidden: Admin access required for creation.' });
      }

      const { day, time, name, purpose, notes, latitude, longitude } = req.body;
      
      if (!day || !time || !name || !purpose || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'Missing required fields for TripPlace creation.' });
      }

      const placeData: CreateTripPlaceData = { day, time, name, purpose, notes, latitude, longitude };
      const newPlace = await createTripPlace(placeData);
      
      return res.status(201).json(newPlace);
    } 
    
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error(`Error in /api/itinerary handler (${req.method}):`, error);
    return res.status(500).json({ error: 'Failed to process itinerary request due to a server error.' });
  }
}