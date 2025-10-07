import { NextApiRequest } from 'next';

// --- Note: This function checks for a specific role key but is not yet fully utilized in the current API routes. ---
export function isAuthorized(req: NextApiRequest, requiredRole: 'admin' | 'trusted'): boolean {
    const secretFromHeader = req.headers['x-auth-secret'];
    
    let requiredKey: string | undefined;

    if (requiredRole === 'admin') {
        requiredKey = process.env.NEXT_PUBLIC_ADMIN_SECRET;
    } else if (requiredRole === 'trusted') {
        requiredKey = process.env.NEXT_PUBLIC_TRUSTED_SECRET;
    }
    
    // Check if the required environment variable is actually set
    if (!requiredKey) {
        console.error(`${requiredRole.toUpperCase()}_SECRET_KEY environment variable is not set!`);
        return false; 
    }

    // Compare the header value against the required key
    return secretFromHeader === requiredKey;
}

/**
 * Checks if the request header contains EITHER the Admin Key or the Trusted User Key.
 * This is the primary function to protect all administrative/privileged endpoints.
 * All API routes that handle modification (POST, PUT, DELETE, PATCH) should use this.
 */
export function isAdminOrTrustedAuthorized(req: NextApiRequest): boolean {
    const secretFromHeader = req.headers['x-auth-secret'];
    const adminKey = process.env.ADMIN_SECRET_KEY;
    const trustedKey = process.env.TRUSTED_USER_KEY;
    
    // Security check: Must have a header value and EITHER key must match
    if (!secretFromHeader) return false;

    const isAdmin = secretFromHeader === adminKey;
    const isTrusted = secretFromHeader === trustedKey;
    
    // For now, allow both to pass the access gate, but you can later use isAuthorized
    // for endpoints only the admin should access (like deleting records).
    return isAdmin || isTrusted;
}
