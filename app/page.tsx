import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isAuthenticatedFromTokenCookie } from '@/lib/shell/auth';
import { ACTIVE_PLATFORM_COOKIE, parseActivePlatform, platformHomePath } from '@/lib/shell/platform';
import dynamic from 'next/dynamic';

const WebsiteHomePage = dynamic(() => import('@/components/website/WebsiteHomePage'), { ssr: false });

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  const authed = await isAuthenticatedFromTokenCookie(token);
  if (!authed) {
    return <WebsiteHomePage />;
  }

  const activePlatform = parseActivePlatform(cookieStore.get(ACTIVE_PLATFORM_COOKIE)?.value);
  if (!activePlatform) {
    redirect('/select-platform');
  }

  redirect(platformHomePath(activePlatform));
}
