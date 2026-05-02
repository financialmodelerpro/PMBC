import { getServerSession, type Session } from 'next-auth';

import { authOptions } from './config';

export type AdminSession = Session & {
  user: { id: string; email: string; name: string; role: string };
};

export async function getAdminSession(): Promise<AdminSession | null> {
  const session = (await getServerSession(authOptions)) as AdminSession | null;
  if (!session || session.user?.role !== 'admin') return null;
  return session;
}
