'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  ADMIN_COLORS,
  adminButtonPrimary,
  adminButtonPrimaryDisabled,
  adminInput,
  adminLabel,
} from '@/lib/admin/styles';

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/admin';

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (raw: LoginValues) => {
    setSubmitError(null);
    const parsed = loginSchema.safeParse(raw);
    if (!parsed.success) {
      setSubmitError(parsed.error.issues[0]?.message ?? 'Invalid input.');
      return;
    }

    setSubmitting(true);
    const res = await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
      callbackUrl,
    });
    setSubmitting(false);

    if (!res || res.error) {
      setSubmitError('Invalid email or password.');
      return;
    }

    router.push(res.url || callbackUrl);
    router.refresh();
  };

  const inputStyle = { ...adminInput, padding: '10px 12px', fontSize: 14 };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
    >
      <div>
        <label htmlFor="email" style={adminLabel}>
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          {...register('email')}
          style={inputStyle}
        />
        {errors.email && (
          <p style={{ margin: '6px 0 0', fontSize: 12, color: ADMIN_COLORS.danger }}>
            {errors.email.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="password" style={adminLabel}>
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
          style={inputStyle}
        />
        {errors.password && (
          <p style={{ margin: '6px 0 0', fontSize: 12, color: ADMIN_COLORS.danger }}>
            {errors.password.message}
          </p>
        )}
      </div>

      {submitError && (
        <div
          role="alert"
          style={{
            background: ADMIN_COLORS.dangerBg,
            border: `1px solid #FECACA`,
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 13,
            color: ADMIN_COLORS.danger,
          }}
        >
          {submitError}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{
          ...(submitting ? adminButtonPrimaryDisabled : adminButtonPrimary),
          padding: '11px 20px',
          width: '100%',
          fontSize: 13,
        }}
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
