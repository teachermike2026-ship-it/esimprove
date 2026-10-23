import Link from "next/link";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { logoutAction } from "@/lib/auth/actions";
import { getDb } from "@/lib/db/client";
import { getCartView } from "@/lib/cart";
import { CART_COOKIE } from "@/lib/cart-cookie";
import { demoMode } from "@/lib/config";
import {
  AdminIcon,
  CartIcon,
  MenuIcon,
  SearchIcon,
  UserIcon,
} from "@/components/icons";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const token = (await cookies()).get(CART_COOKIE)?.value;
  let cartCount = 0;
  if (token) {
    const db = await getDb();
    const cart = await getCartView(db, token);
    cartCount = cart?.count ?? 0;
  }

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand" href="/" aria-label="eSIMprove home">
          <span className="brand-mark" aria-hidden="true">
            e
          </span>
          <span className="brand-text">
            eSIM<span>prove</span>
          </span>
        </Link>

        <nav className="desktop-nav" aria-label="Primary navigation">
          <Link href="/destinations">Destinations</Link>
          <Link href="/plans">Plans</Link>
          <Link href="/compatibility">Compatibility</Link>
          <Link href="/guides">Install guides</Link>
        </nav>

        <div className="header-actions">
          <Link className="icon-button" href="/search" aria-label="Search plans">
            <SearchIcon />
          </Link>
          <Link className="cart-link" href="/cart" aria-label={`Cart, ${cartCount} items`}>
            <CartIcon />
            <span className="cart-count" aria-hidden="true">
              {cartCount}
            </span>
          </Link>
          {user ? (
            <>
              {user.role === "admin" ? (
                <Link className="account-link" href="/admin">
                  <AdminIcon />
                  <span>Admin</span>
                </Link>
              ) : null}
              <Link className="account-link" href="/portal">
                <UserIcon />
                <span>Account</span>
              </Link>
              <form action={logoutAction} className="inline-form">
                <button className="text-button" type="submit">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link className="account-link" href="/login">
              <UserIcon />
              <span>Sign in</span>
            </Link>
          )}
        </div>

        <details className="mobile-menu">
          <summary className="icon-button" aria-label="Open navigation menu">
            <MenuIcon />
          </summary>
          <nav aria-label="Mobile navigation">
            <Link href="/destinations">Destinations</Link>
            <Link href="/plans">Plans</Link>
            <Link href="/compatibility">Compatibility</Link>
            <Link href="/guides">Install guides</Link>
            <Link href="/search">Search</Link>
            <Link href="/cart">Cart ({cartCount})</Link>
            {user ? (
              <>
                {user.role === "admin" ? <Link href="/admin">Admin</Link> : null}
                <Link href="/portal">Account</Link>
                <form action={logoutAction}>
                  <button className="text-button" type="submit">
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <Link href="/login">Sign in</Link>
            )}
            {demoMode ? <Link href="/admin">Demo admin</Link> : null}
          </nav>
        </details>
      </div>
    </header>
  );
}
