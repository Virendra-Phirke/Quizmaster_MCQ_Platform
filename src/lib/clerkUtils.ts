/**
 * Utility function to generate a deterministic UUID from a Clerk user ID
 * This ensures consistent UUIDs for the same Clerk ID across the application
 */
export const generateUUIDFromClerkId = async (clerkId: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(clerkId);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Format as UUID v4
  return [
    hashHex.slice(0, 8),
    hashHex.slice(8, 12),
    '4' + hashHex.slice(13, 16),
    '8' + hashHex.slice(17, 20),
    hashHex.slice(20, 32)
  ].join('-');
};

/**
 * Cache for Clerk ID to UUID mappings to avoid repeated crypto operations
 */
const clerkIdToUUIDCache = new Map<string, string>();

/**
 * Cached version of the UUID generator for better performance
 */
export const getCachedUUIDFromClerkId = async (clerkId: string): Promise<string> => {
  if (clerkIdToUUIDCache.has(clerkId)) {
    return clerkIdToUUIDCache.get(clerkId)!;
  }

  const uuid = await generateUUIDFromClerkId(clerkId);
  clerkIdToUUIDCache.set(clerkId, uuid);
  return uuid;
};

import { supabase } from './supabase';

export type UserRole = 'teacher' | 'student';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at?: string;
  updated_at?: string;
}

/**
 * Upserts a user profile in the database, ensuring the profile exists before creating related records
 * This prevents foreign key constraint violations when creating tests, test results, etc.
 */
export const upsertUserProfile = async (
  clerkUserId: string,
  name: string,
  email: string,
  role: UserRole = 'student'
): Promise<UserProfile> => {
  try {
    // Generate deterministic UUID from Clerk ID
    const userUUID = await getCachedUUIDFromClerkId(clerkUserId);

    // Attempt to upsert the profile
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: userUUID,
        name,
        email,
        role,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting user profile:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to upsert user profile:', error);
    throw error;
  }
};

/**
 * Per-session cache: tracks user IDs whose profiles have already been upserted.
 */
const ensuredProfilesCache = new Set<string>();
const pendingEnsures = new Map<string, Promise<UserProfile>>();

/**
 * Ensures a user profile exists for the given Clerk user, creating it if necessary
 * This is a convenience function that extracts user info from Clerk user object
 */
export const ensureUserProfile = async (
  clerkUser: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    emailAddresses: Array<{ emailAddress: string }>;
  },
  role: UserRole = 'student'
): Promise<UserProfile> => {
  const cacheKey = `${clerkUser.id}:${role}`;

  // 1. Check if we already finished this sync
  if (ensuredProfilesCache.has(cacheKey)) {
    const userUUID = await getCachedUUIDFromClerkId(clerkUser.id);
    return { id: userUUID, name: '', email: '', role } as UserProfile;
  }

  // 2. Check if a sync is already in progress for this user+role
  if (pendingEnsures.has(cacheKey)) {
    return pendingEnsures.get(cacheKey)!;
  }

  // 3. Start a new sync and cache the promise
  const ensurePromise = (async () => {
    try {
      const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Unknown User';
      const email = clerkUser.emailAddresses[0]?.emailAddress || 'unknown@example.com';

      const profile = await upsertUserProfile(clerkUser.id, name, email, role);
      ensuredProfilesCache.add(cacheKey);
      return profile;
    } finally {
      pendingEnsures.delete(cacheKey);
    }
  })();

  pendingEnsures.set(cacheKey, ensurePromise);
  return ensurePromise;
};
