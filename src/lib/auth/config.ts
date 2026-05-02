import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

import { createSupabaseServerClient } from '@/lib/supabase/server';

const SESSION_MAX_AGE_SECONDS = 60 * 60; // 1 hour

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  pages: {
    signIn: '/admin/login',
    error: '/admin/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        const supabase = createSupabaseServerClient();
        const { data: admin, error } = await supabase
          .from('admin_users')
          .select('id, email, name, role, password_hash')
          .eq('email', email)
          .maybeSingle();

        if (error || !admin) return null;

        const ok = await bcrypt.compare(password, admin.password_hash);
        if (!ok) return null;

        // Best-effort: stamp last_login_at and write audit row. Do not fail login if these fail.
        const nowIso = new Date().toISOString();
        await supabase
          .from('admin_users')
          .update({ last_login_at: nowIso })
          .eq('id', admin.id);

        await supabase.from('audit_log').insert({
          admin_id: admin.id,
          action: 'login',
          entity_type: 'admin_users',
          entity_id: admin.id,
          metadata: { email: admin.email },
        });

        return {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id,
        email: token.email ?? '',
        name: token.name ?? '',
        role: token.role,
      };
      return session;
    },
  },
};
