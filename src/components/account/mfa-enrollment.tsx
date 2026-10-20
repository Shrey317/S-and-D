'use client';
import { useActionState } from 'react';
import { enrollMfaAction, verifyMfaAction, type MfaResult } from '@/server/auth/actions';
import { Button } from '@/components/ui/button';
import { ActionForm } from './action-form';
export function MfaEnrollment() {
  const [state, action, pending] = useActionState<MfaResult, FormData>(enrollMfaAction, {
    status: 'idle',
    message: '',
  });
  return (
    <div>
      <form action={action}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Preparing…' : 'Set up authenticator'}
        </Button>
      </form>
      <p role={state.status === 'error' ? 'alert' : 'status'} className="my-4 text-sm leading-6">
        {state.message}
      </p>
      {state.secret && state.factorId ? (
        <>
          <p
            className="mb-5 break-all rounded-lg bg-secondary p-4 font-mono"
            aria-label="Authenticator setup key"
          >
            {state.secret}
          </p>
          <ActionForm
            action={verifyMfaAction}
            hidden={{ factorId: state.factorId }}
            label="Verify authenticator"
            fields={[
              {
                name: 'code',
                label: 'Six-digit authenticator code',
                required: true,
                pattern: '[0-9]{6}',
                minLength: 6,
                maxLength: 6,
                autoComplete: 'one-time-code',
              },
            ]}
          />
        </>
      ) : null}
    </div>
  );
}
