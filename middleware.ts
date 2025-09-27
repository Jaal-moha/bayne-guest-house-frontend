import { NextRequest, NextResponse } from 'next/server';

function decodeJwt(token: string | undefined): any | null {
  if (!token) return null;
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 2 ? '==' : b64.length % 4 === 3 ? '=' : '';
    const json = atob(b64 + pad);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function findTokenFromCookies(req: NextRequest): string | undefined {
  const preferred = [
    'token',
    'accessToken',
    'authToken',
    'jwt',
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
  ];
  for (const name of preferred) {
    const v = req.cookies.get(name)?.value;
    if (v) return v;
  }
  for (const c of req.cookies.getAll()) {
    if (c.value && c.value.split('.').length === 3) {
      return c.value;
    }
  }
  return undefined;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Redirect ONLY from root to avoid dashboard loops
  if (pathname !== '/') {
    return NextResponse.next();
  }

  const token = findTokenFromCookies(req);
  const payload = decodeJwt(token);

  let roles: string[] = [];
  const roleCookie = req.cookies.get('role')?.value;
  const rolesCookie = req.cookies.get('roles')?.value;
  if (Array.isArray(payload?.roles)) {
    roles = payload.roles;
  } else if (payload?.role) {
    roles = [payload.role];
  } else if (rolesCookie) {
    try {
      const parsed = JSON.parse(rolesCookie);
      roles = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    } catch {}
  } else if (roleCookie) {
    roles = [roleCookie];
  }

  if (roles.includes('store')) {
    const url = req.nextUrl.clone();
    url.pathname = '/inventory';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/'],
};
