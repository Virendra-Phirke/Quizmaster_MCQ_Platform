export type CanonicalRole = 'teacher' | 'student';

/**
 * Normalize role strings coming from Clerk metadata to a canonical set.
 * Accepts common variants (plural forms) and returns undefined for unknown values.
 */
export function canonicalizeRole(raw?: string | null): CanonicalRole | undefined {
  if (!raw) return undefined;
  const s = String(raw).trim().toLowerCase();
  if (s === 'teacher' || s === 'teachers' || s === 'org:teacher' || s === 'role:teacher') return 'teacher';
  if (s === 'student' || s === 'students' || s === 'learner' || s === 'org:students' || s === 'role:students') return 'student';
  return undefined;
}

export function isTeacher(raw?: string | null): boolean {
  return canonicalizeRole(raw) === 'teacher';
}

export function isStudent(raw?: string | null): boolean {
  return canonicalizeRole(raw) === 'student';
}
