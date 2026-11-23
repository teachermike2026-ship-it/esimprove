# Phase B1 — Owner Role Proposal (Pending Approval)

## 1. Current Role Model

- **Roles defined in `lib/auth/roles.ts`:**
  - `customer`
  - `support`
  - `finance`
  - `admin`
  - `super_admin`

- **Permission assignment (`ROLE_PERMISSIONS`):**
  - `customer`: no permissions.
  - `admin`: **ALL_PERMISSIONS** (full set).
  - `super_admin`: **ALL_PERMISSIONS** (identical to `admin`).
  - `support`: limited read/write (orders, support).
  - `finance`: read-only on `orders` and `invoices`.
  - `admin`/`super_admin`: full permissions including `orders.read`, `orders.write`, `refunds.write`, `invoices.read`, `refunds.write`, `support.read`, `support.write`, `coupons.manage`, `pricing.manage`, `plans.manage`, `destinations.manage`, `integrations.manage`, `users.manage`, `orders.read`, `orders.write`, `refunds.write`, `invoices.read`, `invoices.write`, `support.read`, `support.write`, `coupons.manage`, `pricing.manage`, `plans.manage`, `destinations.manage`, `integrations.manage`, `users.manage`.

- **Authorization decision points:**
  - Route guards (`requireAdmin`, `requireStaff`) check `isAdminRole` or `isStaffRole`.
  - API/Server Action guards (`requirePermissionFor`) check `hasPermission`.
  - UI components (`site-header.tsx`, `admin/page.tsx`) use `isAdminRole`.
  - Session guard (`requireUser`) checks `getCurrentUser()` existence.
  - Password change requirement (`passwordChangeRequired`) blocks admin access until reset.

## 2. Difference between `admin` and `super_admin`

- Currently **identical**: both have `ALL_PERMISSIONS` and are treated identically by all guards.
- No functional distinction exists in code; both are treated as administrators with full privileges.

## 3. Proposed distinct `owner` role

### 1. Role definition

Add a new role entry:

```ts
export const ROLES = [
  "customer",
  "support",
  "finance",
  "admin",
  "super_admin",
  "owner",   // NEW
] as const;
export type Role = (typeof ROLES)[number];
```

### 2. Permission assignment (`ROLE_PERMISSIONS`)

Extend `ROLE_PERMISSIONS`:

```ts
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // existing roles unchanged
  admin: ALL_PERMISSIONS,
  super_admin: ALL_PERMISSIONS,
  // NEW: owner has all admin permissions PLUS additional critical powers
  owner: [
    "orders.read", "orders.write", "orders.refund",
    "invoices.read", "refunds.write",
    "support.read", "support.write",
    "coupons.manage", "pricing.manage", "plans.manage",
    "destinations.manage", "integrations.manage", "users.manage",
    "finance.read", "finance.write",   // optional, only if needed
    "admin.reassign_roles",               // manage staff roles
    "admin.enable_live_mode",             // enable/disable live flags
    "admin.change_business_identity",     // update legal identity settings
    "admin.delete_owners",                // last-owner protection (see below)
    "admin.create_owner_account",         // create new verified owner (requires admin approval)
    "admin.reset_owner_password",         // reset owner password (owner-only flow)
    "admin.manage_api_credentials",       // manage integration credentials
    "admin.enable_owner_login",           // toggle owner login capability
    "admin.view_audit_trail_for_owner_actions", // audit of owner actions
    "admin.grant_owner_permission",       // grant owner permission to staff (if needed)
  ],
};
```

### 3. Owner-only powers (detailed)

- **Manage staff accounts and roles:**
  - Assign, promote, demote, or remove `admin`, `super_admin`, `support`, `finance` roles.
  - Restrict role changes to owner-only.

- **Manage integration credentials and live mode:**
  - Enable/disable live mode for suppliers, payments, email, etc.
  - Set `LIVE_MODE_ENABLED` for critical integrations.

- **Manage business/legal identity settings:**
  - Change legal business name, domain, or registered entity.
  - Update tax/FX/multi-currency configuration.
  - Modify retention policies, consent periods, and legal compliance settings.

- **Destructive account and data operations:**
  - Delete any user account (owner-only).
  - Delete any order record (owner-only).
  - Delete any payment record (owner-only).
  - Delete any supplier connection and its credentials (owner-only).

- **Critical security settings:**
  - Enable or disable owner login capability.
  - Grant or revoke owner permission to staff members.
  - Manage audit log retention and access.
  - Override payment/webhook secret keys (owner-only).

- **Last-owner protection:**
  - The first owner account created must not be removable or demoted by any other user.
  - Any attempt to delete or downgrade the owner role must be blocked unless a new owner is first verified.

### 4. Audit-log requirements

- All owner role changes must log:
  - Actor ID (owner ID)
  - Target role
  - Timestamp
  - Reason (optional)
- All privileged operations (account deletion, permission change, live-mode toggle) must log:
  - Actor ID
  - Action type (e.g., `admin.reassign_roles`, `admin.delete_owners`)
  - Affected entity ID (user ID, order ID, etc.)
  - Result (success/failure)
  - Reason (if any)

### 5. Database migration required

Add a new migration file `db/migrations/0010_owner_role_and_permissions.sql` that:

1. Adds the `owner` role to `ROLES` constant.
2. Extends `ROLE_PERMISSIONS` with the owner permission list above.
3. Updates any existing permission checks to reference the new role (if needed).
4. Ensures the migration is idempotent and safe to re-run.

### 6. Tests required

- **Unit tests** for role model and permission matrix.
- **Integration tests** verifying that `owner` cannot be granted to non-owner accounts.
- **Authorization tests** confirming:
  - `owner` can access all admin pages and server actions.
  - `admin` and `super_admin` cannot perform owner-only operations (e.g., `admin.delete_owners`).
  - `admin` and `super_admin` are denied `admin.delete_owners`, `admin.create_owner_account`, etc.
  - Owner can manage staff roles and enable live mode.
  - Owner cannot be removed or demoted without a new verified owner.

### 7. Last-owner protection

- The first `owner` account created must be **protected** from role demotion or deletion by any other role.
- Any server action that attempts to remove the `owner` role from the first account must reject with an error.
- Audit log must record the creation of the first owner and the protection mechanism.

### 8. Implementation plan

1. Add `owner` role to `ROLES` constant.
2. Extend `ROLE_PERMISSIONS` with the owner permission list.
3. Update all `isAdminRole`, `hasPermission`, and related guard functions to recognize `owner` as a distinct privileged role (not `admin`/`super_admin`).
4. Update admin UI components to hide/show owner-specific actions.
5. Add migration file `0010_owner_role_and_permissions.sql`.
6. Add unit and integration tests covering the new permissions and denial cases.
7. Document the migration and permission model in `docs/project/ADMIN_ACCESS.md`.

### 9. Next steps

- **Await explicit approval** from the user before implementing any of the above changes.
- Once approved, proceed with:
  - Schema changes (migration file).
  - Updated role model in `lib/auth/roles.ts` and `lib/db/schema.ts`.
  - Updated permission checks in `lib/auth/guards.ts`, `lib/auth/actions.ts`, and API routes.
  - Updated UI components for owner-specific actions.
  - New tests in `tests/owner-role.test.ts`.
  - Updated documentation in `docs/project/ADMIN_ACCESS.md`.

**STOP here.** The Phase B1 proposal is complete. Please review and approve before proceeding.