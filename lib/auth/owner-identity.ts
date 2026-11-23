export const OWNER_EMAIL = "teacher.mike2026@gmail.com";

/** Both the dedicated role and verified identity are required for owner authority. */
export function isVerifiedOwner(user: {
  role: string;
  email: string;
  emailVerifiedAt: Date | null;
}): boolean {
  return user.role === "owner" && user.email === OWNER_EMAIL &&
    user.emailVerifiedAt instanceof Date && Number.isFinite(user.emailVerifiedAt.getTime());
}
