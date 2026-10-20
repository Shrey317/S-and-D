import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm, type FormField } from '@/components/account/action-form';
import { Button } from '@/components/ui/button';
import { serverEnv } from '@/config/env.server';
import {
  signInAction,
  registerAction,
  recoveryAction,
  resendAction,
  passwordAction,
  googleAction,
} from '@/server/auth/actions';
import { requireIdentity } from '@/server/auth/identity';
import { safeReturnTo } from '@/features/account/validation';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your account' };
const email: FormField = {
  name: 'email',
  label: 'Email address',
  type: 'email',
  required: true,
  autoComplete: 'email',
  maxLength: 254,
};
const newPasswords: FormField[] = [
  {
    name: 'password',
    label: 'New password',
    type: 'password',
    required: true,
    minLength: 12,
    maxLength: 128,
    autoComplete: 'new-password',
  },
  {
    name: 'confirmPassword',
    label: 'Confirm password',
    type: 'password',
    required: true,
    minLength: 12,
    maxLength: 128,
    autoComplete: 'new-password',
  },
];
const flows = {
  'sign-in': {
    title: 'Welcome back',
    description: 'Sign in to manage your addresses and keep your favourite produce close.',
    action: signInAction,
    label: 'Sign in',
    fields: [
      email,
      {
        name: 'password',
        label: 'Password',
        type: 'password',
        required: true,
        autoComplete: 'current-password',
        maxLength: 128,
      } as FormField,
    ],
  },
  register: {
    title: 'Make yourself at home',
    description:
      'Create your account with a password of at least 12 characters. Confirm your email before signing in.',
    action: registerAction,
    label: 'Create account',
    fields: [email, ...newPasswords],
  },
  'forgot-password': {
    title: 'Forgot your password?',
    description:
      'We’ll help you get back into your account. Open the recovery link in this browser.',
    action: recoveryAction,
    label: 'Request reset link',
    fields: [email],
  },
  verify: {
    title: 'Check your inbox',
    description:
      'Open the confirmation email in the browser where you registered. Need a new link?',
    action: resendAction,
    label: 'Resend confirmation',
    fields: [email],
  },
  'reset-password': {
    title: 'Choose a new password',
    description: 'Use 12–128 characters. After saving, sign in again with your new password.',
    action: passwordAction,
    label: 'Save new password',
    fields: newPasswords,
  },
};
export default async function AuthPage({
  params,
  searchParams,
}: {
  params: Promise<{ flow: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { flow } = await params;
  const query = await searchParams;
  if (flow === 'error')
    return (
      <main id="main-content" className="site-container py-20">
        <div className="mx-auto max-w-lg rounded-3xl border bg-card p-8">
          <h1 className="text-3xl font-bold">That sign-in link didn’t work</h1>
          <p className="my-6 leading-7 text-muted-foreground">
            It may have expired, already been used, or opened in a different browser. Request a new
            link and try again.
          </p>
          <Link className="underline" href="/auth/sign-in">
            Return to sign in
          </Link>
          <br />
          <Link className="mt-4 inline-block underline" href="/auth/forgot-password">
            Request a password reset
          </Link>
        </div>
      </main>
    );
  if (!(flow in flows)) notFound();
  if (flow === 'reset-password') await requireIdentity();
  const config = flows[flow as keyof typeof flows];
  return (
    <main id="main-content" className="site-container py-12 sm:py-20">
      <div className="mx-auto grid max-w-4xl overflow-hidden rounded-3xl border bg-card md:grid-cols-[0.8fr_1fr]">
        <div className="bg-secondary p-8 sm:p-10">
          <span className="eyebrow">Your neighbourhood shop</span>
          <h1 className="mt-4 text-3xl font-bold sm:text-4xl">{config.title}</h1>
          <p className="mt-5 leading-7 text-muted-foreground">{config.description}</p>
          <p className="mt-8 text-sm leading-6">
            A place for your favourites, saved details and future orders.
          </p>
        </div>
        <div className="p-8 sm:p-10">
          {!serverEnv.AUTH_ENABLED ? (
            <p role="status" className="mb-6 rounded-xl bg-secondary p-4 text-sm leading-6">
              Accounts are not available yet. You can still explore the shop and visit us in
              Lenasia.
            </p>
          ) : null}
          {query.changed === '1' ? (
            <p role="status" className="mb-6 text-sm text-primary">
              Password updated. Please sign in again.
            </p>
          ) : null}
          {query.signedOut === '1' ? (
            <p role="status" className="mb-6 text-sm text-primary">
              You have signed out.
            </p>
          ) : null}
          <ActionForm
            action={config.action}
            fields={config.fields}
            hidden={{ next: safeReturnTo(query.next) }}
            label={config.label}
            disabled={!serverEnv.AUTH_ENABLED}
          />
          {flow === 'sign-in' && serverEnv.GOOGLE_AUTH_ENABLED ? (
            <form action={googleAction} className="mt-5">
              <Button variant="outline" type="submit">
                Continue with Google
              </Button>
            </form>
          ) : null}
          <nav aria-label="Account help" className="mt-8 grid gap-3 border-t pt-6 text-sm">
            {flow !== 'sign-in' ? (
              <Link className="underline" href="/auth/sign-in">
                Already have an account? Sign in
              </Link>
            ) : (
              <>
                <Link className="underline" href="/auth/register">
                  Create an account
                </Link>
                <Link className="underline" href="/auth/forgot-password">
                  Forgot your password?
                </Link>
                <Link className="underline" href="/auth/verify">
                  Confirm your email
                </Link>
              </>
            )}
            <Link className="underline" href="/policies">
              Privacy and store policies
            </Link>
          </nav>
        </div>
      </div>
    </main>
  );
}
