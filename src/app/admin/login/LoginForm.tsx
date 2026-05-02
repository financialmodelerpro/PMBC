'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div>
        <label
          htmlFor="email"
          className="block text-xs font-medium tracking-[0.14em] uppercase text-[#0F2540]"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          {...register('email')}
          className="mt-2 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-[15px] text-[#0F1B2D] outline-none transition focus:border-[#1B3A5F] focus:ring-2 focus:ring-[#1B3A5F]/15"
        />
        {errors.email && (
          <p className="mt-1.5 text-xs text-red-600">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-xs font-medium tracking-[0.14em] uppercase text-[#0F2540]"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
          className="mt-2 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-[15px] text-[#0F1B2D] outline-none transition focus:border-[#1B3A5F] focus:ring-2 focus:ring-[#1B3A5F]/15"
        />
        {errors.password && (
          <p className="mt-1.5 text-xs text-red-600">{errors.password.message}</p>
        )}
      </div>

      {submitError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {submitError}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-[#1B3A5F] px-4 py-3 text-sm font-medium tracking-wide text-white transition hover:bg-[#0F2540] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
