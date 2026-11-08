#!/usr/bin/env node
// scripts/smoke-test.mjs — cross-platform local route smoke test.
// Uses built-in http/https only. No external dependencies or external hosts.

import http from 'http';
import https from 'https';
import { URL } from 'url';

const BASE = (process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const COOKIE = process.env.SMOKE_AUTH_COOKIE || null;
const TIMEOUT = 10000;

const PUBLIC_ROUTES = [
  '/',
  '/about',
  '/contact',
  '/compatibility',
  '/destinations',
  '/destinations/japan',
  '/regions',
  '/regions/asia',
  '/plans',
  '/plans/japan-1000mb-7d',
  '/search',
  '/guides',
  '/guides/install-ios',
  '/cart',
  '/checkout',
  '/checkout/success',
  '/legal',
  '/legal/terms',
  '/legal/privacy',
  '/legal/refunds',
  '/legal/cookies',
  '/legal/faq',
  '/login',
  '/login/forgot',
  '/login/reset',
  '/register',
  '/blog',
  '/robots.txt',
  '/sitemap.xml',
];

const ANONYMOUS_REDIRECT_ROUTES = ['/login/2fa'];

const ADMIN_ROUTES = [
  '/admin',
  '/admin/analytics',
  '/admin/audit',
  '/admin/blog',
  '/admin/blog/new',
  '/admin/blog/categories',
  '/admin/blog/tags',
  '/admin/coupons',
  '/admin/customers',
  '/admin/emails',
  '/admin/finance',
  '/admin/help',
  '/admin/integrations',
  '/admin/integrations/new',
  '/admin/jobs',
  '/admin/legal',
  '/admin/monitoring',
  '/admin/orders',
  '/admin/payments',
  '/admin/plans',
  '/admin/pricing',
  '/admin/provider',
  '/admin/refunds',
  '/admin/seo',
  '/admin/settings',
  '/admin/support',
];

const PROTECTED_USER_ROUTES = ['/portal'];

function fetchStatus(pathname, headers = {}, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, BASE).toString();
    const client = url.startsWith('https:') ? https : http;
    const requestHeaders = options.body
      ? { 'content-type': 'application/json', ...headers }
      : headers;
    const req = client.request(
      url,
      { method: options.method || 'GET', headers: requestHeaders, timeout: TIMEOUT },
      (res) => {
        const chunks = [];
        let size = 0;
        res.on('data', (chunk) => {
          if (size < 65536) {
            chunks.push(chunk);
            size += chunk.length;
          }
        });
        res.on('end', () => {
          let status = res.statusCode || 0;
          let location = res.headers['location'] || '';
          // Next.js server components can stream a redirect as an HTTP 200 page
          // containing a NEXT_REDIRECT marker instead of an HTTP 3xx response.
          // Do not treat that as a successful render of the protected page.
          if (!location) {
            const body = Buffer.concat(chunks).toString('utf8');
            const marker = body.match(/NEXT_REDIRECT;(?:replace|push);([^;"]+);(\d{3})/);
            if (marker) {
              status = Number(marker[2]);
              location = marker[1];
            }
          }
          resolve({ status, location });
        });
      },
    );
    req.on('error', (e) => reject(e));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    if (options.body) req.write(options.body);
    req.end();
  });
}

function report(results, label, expected, actualStatus, actualLoc, blocked = false) {
  const locStr = actualLoc ? `Location=${actualLoc}` : 'Location=none';
  let pass = false;
  if (expected === '200') pass = actualStatus === 200;
  if (expected === '404') pass = actualStatus === 404;
  if (expected === '400') pass = actualStatus === 400;
  if (expected === '401') pass = actualStatus === 401;
  if (expected === '405') pass = actualStatus === 405;
  if (expected === 'redirect-login') {
    pass = actualStatus >= 300 && actualStatus < 400 && actualLoc.includes('/login');
  }
  if (expected === 'redirect-protected') {
    pass = actualStatus >= 300 && actualStatus < 400 && !actualLoc.includes('/login');
  }
  if (expected === 'redirect-cart') {
    pass = actualStatus >= 300 && actualStatus < 400 && actualLoc.includes('/cart');
  }
  if (expected === 'any-ok') pass = actualStatus === 200 || (actualStatus >= 300 && actualStatus < 400);

  const status = blocked ? 'BLOCKED' : pass ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${label} | expected=${expected} | status=${actualStatus} | ${locStr}`);
  results.push({ pass, blocked, label, actualStatus, actualLoc });
}

async function checkPublic(results) {
  for (const route of PUBLIC_ROUTES) {
    try {
      // /checkout correctly redirects to /cart when no cart cookie is present.
      const expected = route === '/legal' ? 'any-ok' : route === '/checkout' ? 'redirect-cart' : '200';
      const result = await fetchStatus(route);
      report(results, `Public ${route}`, expected, result.status, result.location);
    } catch (error) {
      report(results, `Public ${route}`, '200', 0, `connection-refused: ${error.message}`);
    }
  }
  for (const route of ANONYMOUS_REDIRECT_ROUTES) {
    try {
      const result = await fetchStatus(route);
      report(results, `Public ${route}`, 'redirect-login', result.status, result.location);
    } catch (error) {
      report(results, `Public ${route}`, 'redirect-login', 0, `connection-refused: ${error.message}`);
    }
  }
  try {
    const result = await fetchStatus('/api/health');
    report(results, 'API /api/health', '200', result.status, result.location);
  } catch (error) {
    report(results, 'API /api/health', '200', 0, `connection-refused: ${error.message}`);
  }
  try {
    const result = await fetchStatus('/this-route-does-not-exist');
    report(results, '404 contract', '404', result.status, result.location);
  } catch (error) {
    report(results, '404 contract', '404', 0, `connection-refused: ${error.message}`);
  }
}

async function checkApiContracts(results) {
  const checks = [
    {
      label: 'API POST /api/jobs/run without secret',
      path: '/api/jobs/run',
      expected: '401',
      options: { method: 'POST', body: '{}' },
    },
    {
      label: 'API GET /api/jobs/run is not allowed',
      path: '/api/jobs/run',
      expected: '405',
    },
    {
      label: 'API POST /api/webhooks/payments/mock without signature',
      path: '/api/webhooks/payments/mock',
      expected: '400',
      options: { method: 'POST', body: '{}' },
    },
    {
      label: 'API POST /api/track rejects invalid payloads',
      path: '/api/track',
      expected: '400',
      options: { method: 'POST', body: '{"events":[]}' },
    },
    {
      label: 'API GET /api/track is not allowed',
      path: '/api/track',
      expected: '405',
    },
  ];
  for (const check of checks) {
    try {
      const result = await fetchStatus(check.path, {}, check.options || {});
      report(results, check.label, check.expected, result.status, result.location);
    } catch (error) {
      report(
        results,
        check.label,
        check.expected,
        0,
        `connection-refused: ${error.message}`,
      );
    }
  }
}

async function checkAnonymousProtected(results) {
  for (const route of [...ADMIN_ROUTES, ...PROTECTED_USER_ROUTES]) {
    // Both admin and customer-protected pages send anonymous visitors to the
    // sign-in page with a safe `next` parameter.
    const expected = 'redirect-login';
    try {
      const result = await fetchStatus(route);
      report(results, `Unauthenticated ${route}`, expected, result.status, result.location);
    } catch (error) {
      report(results, `Unauthenticated ${route}`, expected, 0, `connection-refused: ${error.message}`);
    }
  }
}

async function checkAuthenticatedAdmin(results) {
  if (!COOKIE) {
    for (const route of ADMIN_ROUTES) {
      console.log(`[BLOCKED] Authenticated admin ${route} — SMOKE_AUTH_COOKIE not set`);
      results.push({
        pass: false,
        blocked: true,
        label: `Authenticated admin ${route}`,
        actualStatus: 0,
        actualLoc: 'no-auth-cookie',
      });
    }
    console.log('[BLOCKED] Set SMOKE_AUTH_COOKIE to a real session cookie to verify authenticated admin routes.');
    return;
  }

  for (const route of ADMIN_ROUTES) {
    try {
      const result = await fetchStatus(route, { Cookie: COOKIE });
      if (result.status === 200) {
        report(results, `Authenticated admin ${route}`, '200', result.status, result.location);
      } else if (result.status >= 300 && result.status < 400) {
        console.log(`[BLOCKED] Authenticated admin ${route} — redirected to ${result.location || 'unknown'} (invalid or insufficient session); cookie value not printed`);
        results.push({
          pass: false,
          blocked: true,
          label: `Authenticated admin ${route}`,
          actualStatus: result.status,
          actualLoc: result.location,
        });
      } else {
        report(results, `Authenticated admin ${route}`, '200', result.status, result.location);
      }
    } catch (error) {
      report(results, `Authenticated admin ${route}`, '200', 0, `connection-refused: ${error.message}`);
    }
  }
}

async function run() {
  console.log('Smoke test — base:', BASE, '| auth cookie:', COOKIE ? '(provided)' : '(none)');
  try {
    new URL(BASE);
  } catch {
    console.error('FAIL: Invalid SMOKE_BASE_URL:', BASE);
    process.exit(1);
  }

  const results = [];
  await checkPublic(results);
  await checkApiContracts(results);
  await checkAnonymousProtected(results);
  await checkAuthenticatedAdmin(results);

  const failCount = results.filter((item) => !item.pass && !item.blocked).length;
  const blockCount = results.filter((item) => item.blocked).length;
  const passCount = results.filter((item) => item.pass).length;

  console.log('--- Summary ---');
  console.log('PASS:', passCount, '| FAIL:', failCount, '| BLOCKED:', blockCount);

  if (failCount > 0) {
    console.log('FAIL: Unexpected result detected (404/500/wrong redirect).');
    process.exit(1);
  }
  console.log('PASS: All executed checks completed; blocked checks require authentication evidence.');
}

run();
