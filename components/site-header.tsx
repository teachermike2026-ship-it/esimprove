import Link from "next/link";
import { cookies } from "next/headers";
import { BrandMark } from "@/components/brand-mark";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/roles";
import { logoutAction } from "@/lib/auth/actions";
import { getDb } from "@/lib/db/client";
import { getCartView } from "@/lib/cart";
import { CART_COOKIE } from "@/lib/cart-cookie";
import {
  CartIcon,
  ChevronDownIcon,
  HeadsetIcon,
  MenuIcon,
  UserIcon,
} from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";

export async function SiteHeader() {
  const { t, href } = await getI18n();
  const user = await getCurrentUser();
  const token = (await cookies()).get(CART_COOKIE)?.value;
  let cartCount = 0;
  if (token) {
    const db = await getDb();
    const cart = await getCartView(db, token);
    cartCount = cart?.count ?? 0;
  }

  const navLinks = [
    { href: "/", label: t("nav.home"), className: "es-nav-home" },
    { href: "/destinations", label: t("nav.countries") },
    { href: "/plans", label: t("nav.plans") },
    { href: "/blog", label: t("nav.blog") },
    { href: "/guides", label: t("nav.guides") },
    { href: "/about", label: t("nav.about") },
    { href: "/contact", label: t("nav.contact") },
  ];

  const cartLabel =
    cartCount === 0
      ? t("header.cartEmpty")
      : cartCount === 1
        ? t("header.cartOne")
        : t("header.cartMany", { count: String(cartCount) });

  return (
    <header className="es-header">
      <div className="es-shell es-header-inner">
        <BrandMark href={href("/")} ariaLabel={t("nav.home")} />

        <nav className="es-nav" aria-label={t("nav.primary")}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={href(link.href)}
              className={link.className}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="es-header-actions">
          <LanguageSwitcher />

          <Link className="es-support-link" href={href("/contact")} aria-label={t("nav.support")}>
            <HeadsetIcon />
            <span>{t("nav.support")}</span>
          </Link>

          <Link className="es-cart" href={href("/cart")} aria-label={cartLabel}>
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
                <span>{t("header.account")}</span>
                <ChevronDownIcon className="es-chevron" />
              </summary>
              <div className="es-account-menu">
                <span className="es-account-name">
                  <small>{t("header.signedInAs")}</small>
                  {user.name || user.email}
                </span>
                <Link href={href("/portal")}>{t("nav.myEsims")}</Link>
                <Link href={href("/portal/profile")}>{t("nav.profile")}</Link>
                <Link href={href("/portal/support")}>{t("nav.support")}</Link>
                {isAdminRole(user.role) ? (
                  <Link href="/admin">{t("nav.admin")}</Link>
                ) : null}
                <form action={logoutAction}>
                  <button className="es-menu-button" type="submit">
                    {t("nav.signOut")}
                  </button>
                </form>
              </div>
            </details>
          ) : (
            <Link className="es-signin" href={href("/login")}>
              <UserIcon />
              <span>{t("nav.signIn")}</span>
            </Link>
          )}

          <Link className="es-get-esim" href={href("/plans")}>
            <CartIcon />
            <span>{t("nav.getEsim")}</span>
          </Link>

          <details className="es-mobile-nav">
            <summary className="es-menu-toggle" aria-label={t("header.menuAria")}>
              <MenuIcon />
            </summary>
            <div className="es-mobile-panel">
              <nav aria-label={t("nav.mobile")}>
                {navLinks.map((link) => (
                  <Link key={link.href} href={href(link.href)}>
                    {link.label}
                  </Link>
                ))}
              </nav>
              <LanguageSwitcher variant="mobile" />
              <div className="es-mobile-account">
                <Link href={href("/cart")}>
                  {t("nav.cart")} ({cartCount})
                </Link>
                {user ? (
                  <>
                    <Link href={href("/portal")}>{t("nav.myEsims")}</Link>
                    <Link href={href("/portal/profile")}>{t("nav.profile")}</Link>
                    <Link href={href("/portal/support")}>{t("nav.support")}</Link>
                    {isAdminRole(user.role) ? <Link href="/admin">{t("nav.admin")}</Link> : null}
                    <form action={logoutAction}>
                      <button className="es-menu-button" type="submit">
                        {t("nav.signOut")}
                      </button>
                    </form>
                  </>
                ) : (
                  <Link href={href("/login")}>{t("nav.signIn")}</Link>
                )}
              </div>
              <p className="es-mobile-note">{t("nav.mobileNote")}</p>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
