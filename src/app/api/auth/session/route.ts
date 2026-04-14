import { validateSession, unauthorized } from '@/lib/session';

export async function GET(request: Request) {
  try {
    const user = await validateSession(request);
    if (!user) return unauthorized();
    return Response.json({ user });
  } catch {
    return unauthorized();
  }
}
