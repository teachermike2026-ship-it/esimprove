import Link from "next/link";
import { cookies } from "next/headers";
import { BrandMark } from "@/components/brand-mark";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/roles";
import { logoutAction } from "@/lib/auth/actions";
import { getDb } from "@/lib/db/client";
import { getCartView } from "@/lib/cart";
import { CART_COOKIE } from "@/lib/cart-cookie";
import { demoMode } from "@/lib/config";
import {
  AdminIcon,
  CartIcon,
  CheckIcon,
  ChevronDownIcon,
  GlobeIcon,
  HeadsetIcon,
  MenuIcon,
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

  const navLinks = [
    { href: "/", label: "Home", className: "es-nav-home" },
    { href: "/destinations", label: "Countries" },
    { href: "/plans", label: "Plans" },
    { href: "/guides", label: "Guides" },
    { href: "/about", label: "About us" },
    { href: "/contact", label: "Contact us" },
  ];

  return (
    <header className="es-header">
      <div className="es-shell es-header-inner">
        <BrandMark />

        <nav className="es-nav" aria-label="Primary navigation">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className={link.className}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="es-header-actions">
          <details className="es-lang">
            <summary aria-label="Language: English">
              <GlobeIcon />
              <span>EN</span>
              <ChevronDownIcon className="es-chevron" />
            </summary>
            <div className="es-lang-menu" role="group" aria-label="Available languages">
              <span className="es-lang-current">
                <CheckIcon /> English
              </span>
              <span className="es-lang-note">More languages are planned.</span>
              <span className="es-lang-unavailable" aria-disabled="true">
                Español
              </span>
              <span className="es-lang-unavailable" aria-disabled="true">
                Français
              </span>
            </div>
          </details>

          <Link className="es-support-link" href="/contact" aria-label="Support">
            <HeadsetIcon />
            <span>Support</span>
          </Link>

          <Link
            className="es-cart"
            href="/cart"
            aria-label={cartCount === 1 ? "Cart, 1 item" : `Cart, ${cartCount} items`}
          >
            <CartIcon />
            {cartCount > 0 ? (
              <span className="es-cart-count" aria-hidden="true">
                {cartCount}
              </span>
            ) : null}
          </Link>

          {user ? (
            <details className="es-account">
              <summary className="es-signin">
                <UserIcon />
                <span>Account</span>
                <ChevronDownIcon className="es-chevron" />
              </summary>
              <div className="es-account-menu">
                <span className="es-account-name">
                  <small>Signed in as</small>
                  {user.name || user.email}
                </span>
                <Link href="/portal">My eSIMs &amp; orders</Link>
                {isAdminRole(user.role) ? (
                  <Link href="/admin">
                    <AdminIcon /> Admin area
                  </Link>
                ) : null}
                <form action={logoutAction}>
                  <button className="es-menu-button" type="submit">
                    Sign out
                  </button>
                </form>
              </div>
            </details>
          ) : (
            <Link className="es-signin" href="/login">
              <UserIcon />
              <span>Sign in</span>
            </Link>
          )}

          <details className="es-mobile-nav">
            <summary className="es-menu-toggle" aria-label="Navigation menu">
              <MenuIcon />
            </summary>
            <div className="es-mobile-panel">
              <nav aria-label="Mobile navigation">
                {navLinks.map((link) => (
                  <Link key={link.href} href={link.href}>
                    {link.label}
                  </Link>
                ))}
              </nav>
              <div className="es-mobile-account">
                <Link href="/cart">Cart ({cartCount})</Link>
                {user ? (
                  <>
                    <Link href="/portal">My eSIMs &amp; orders</Link>
                    {isAdminRole(user.role) ? <Link href="/admin">Admin area</Link> : null}
                    <form action={logoutAction}>
                      <button className="es-menu-button" type="submit">
                        Sign out
                      </button>
                    </form>
                  </>
                ) : (
                  <Link href="/login">Sign in</Link>
                )}
                {demoMode ? <Link href="/admin">Demo admin</Link> : null}
              </div>
              <p className="es-mobile-note">
                English only in this build. Support channels are not live.
              </p>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
