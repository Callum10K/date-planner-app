import { PrismaClient, TripPlace, Suggestion, SuggestionStatus } from '../../app/generated/prisma';

// Prisma is exported as a module to handle connection pooling efficiently
// in a serverless environment like Vercel.
let prisma: PrismaClient;

// Check if we are running in development to prevent multiple client instances
if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // Use global variable in development to persist the client
  if (!(global as any).prisma) {
    (global as any).prisma = new PrismaClient();
  }
  prisma = (global as any).prisma;
}

/** Data required for creating a new Suggestion */
export interface CreateSuggestionData {
    userId: string;
    title: string;
    text: string;
}

/** Data required for creating a new TripPlace */
export interface CreateTripPlaceData {
    day: number;
    time: string;
    name: string;
    purpose: string;
    notes?: string;
    latitude: number;
    longitude: number;
}

/** Data required for updating an existing TripPlace */
export type UpdateTripPlaceData = Partial<Omit<CreateTripPlaceData, 'day'>> & { day?: number };


// --- 3. TRIPPLACE CRUD (Itinerary Management) ---

/**
 * Fetches the official trip itinerary places (Read).
 * @param day - Optional day number to filter.
 */
export async function getTripPlaces(day?: number): Promise<TripPlace[]> {
    const whereClause = day ? { day: day } : {};

    return prisma.tripPlace.findMany({
        where: whereClause,
        orderBy: {
            // Sorting by time ensures the day's events are sequential
            time: 'asc',
        },
    });
}

/**
 * Creates a new TripPlace record (Create).
 */
export async function createTripPlace(data: CreateTripPlaceData): Promise<TripPlace> {
    return prisma.tripPlace.create({ data });
}

/**
 * Updates an existing TripPlace record (Update).
 */
export async function updateTripPlace(id: string, data: UpdateTripPlaceData): Promise<TripPlace> {
    return prisma.tripPlace.update({
        where: { id },
        data,
    });
}

/**
 * Deletes a TripPlace record (Delete).
 */
export async function deleteTripPlace(id: string): Promise<TripPlace> {
    return prisma.tripPlace.delete({
        where: { id },
    });
}


// --- 4. SUGGESTION CRUD (User Submission & Inbox Management) ---

/**
 * Creates a new user suggestion (Create). Status is defaulted to PENDING.
 */
export async function createSuggestion(data: CreateSuggestionData): Promise<Suggestion> {
    return prisma.suggestion.create({
        data: {
            userId: data.userId,
            title: data.title,
            text: data.text,
            status: SuggestionStatus.Pending,
        },
    });
}

/**
 * Fetches all user suggestions (Read - Admin Inbox).
 * @param status - Optional status to filter by (PENDING, APPROVED, REJECTED).
 */
export async function getSuggestions(status?: SuggestionStatus): Promise<Suggestion[]> {
    const whereClause = status ? { status } : {};
    return prisma.suggestion.findMany({
        where: whereClause,
        orderBy: {
            createdAt: 'desc', // Show newest suggestions first
        },
    });
}

/**
 * Updates the status of a specific suggestion (Update - Admin Review).
 */
export async function updateSuggestionStatus(id: string, newStatus: SuggestionStatus): Promise<Suggestion> {
    return prisma.suggestion.update({
        where: { id },
        data: { status: newStatus },
    });
}

// Export the prisma client instance for direct use if needed
export default prisma;

