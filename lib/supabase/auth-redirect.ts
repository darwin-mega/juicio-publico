import { type NextRequest, NextResponse } from 'next/server';

export const DEFAULT_AUTH_REDIRECT = '/jugar';

export function getSafeAuthRedirect(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : DEFAULT_AUTH_REDIRECT;
}

export function redirectAuthRequest(request: NextRequest, pathname: string, error?: string) {
  const target = request.nextUrl.clone();
  target.pathname = pathname;
  target.search = '';
  if (error) target.searchParams.set('error', error);
  return NextResponse.redirect(target);
}
