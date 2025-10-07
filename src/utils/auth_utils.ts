import { NextApiRequest } from 'next';

/**
 * Checks for a valid admin secret key in the request headers.
 * This key must match the ADMIN_SECRET_KEY set in your environment variables.
 * @param req - The incoming NextApiRequest.
 * @returns True if the secret key matches, false otherwise.
 */
export function isAdminAuthorized(req: NextApiRequest): boolean {
    // We expect the admin secret to be passed in a dedicated header, 
    // e.g., 'x-admin-secret'.
    const secretFromHeader = req.headers['x-admin-secret'];
    const adminSecretKey = process.env.ADMIN_SECRET_KEY;

    // Critical check: Ensure the environment variable is set
    if (!adminSecretKey) {
        console.error("ADMIN_SECRET_KEY environment variable is not set!");
        // In production, you might return false here for security, 
        // but for development, we return false unless the secret is provided.
        return false; 
    }

    // Compare the header value against the environment variable
    return secretFromHeader === adminSecretKey;
}