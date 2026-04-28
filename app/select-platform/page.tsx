import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isAuthenticatedFromTokenCookie } from '@/lib/shell/auth';
import { ACTIVE_PLATFORM_COOKIE, parseActivePlatform, platformHomePath } from '@/lib/shell/platform';
import { SelectPlatformClient } from './selectPlatformClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SelectPlatformPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  const authed = await isAuthenticatedFromTokenCookie(token);
  if (!authed) {
    redirect('/login');
  }

  const existing = parseActivePlatform(cookieStore.get(ACTIVE_PLATFORM_COOKIE)?.value);
  if (existing) {
    redirect(platformHomePath(existing));
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-10">
        <h1 className="text-2xl font-semibold">Select platform</h1>
        <p className="mt-2 text-sm text-neutral-300">
          Choose one platform to continue. You can change later from the shell.
        </p>

        <div className="mt-8">
          <SelectPlatformClient />
        </div>
      </div>
    </main>
  );
}

