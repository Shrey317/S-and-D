'use client';
import { useActionState, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { initialFormResult, type FormResult } from '@/features/account/validation';

export type FormField = {
  name: string;
  label: string;
  type?:
    | 'text'
    | 'email'
    | 'password'
    | 'tel'
    | 'checkbox'
    | 'textarea'
    | 'select'
    | 'number'
    | 'datetime-local'
    | 'time';
  options?: { value: string; label: string }[];
  required?: boolean;
  autoComplete?: string;
  value?: string | undefined;
  checked?: boolean | undefined;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
};
export function ActionForm({
  action,
  fields = [],
  hidden = {},
  label,
  disabled = false,
}: {
  action: (previous: FormResult, form: FormData) => Promise<FormResult>;
  fields?: FormField[];
  hidden?: Record<string, string>;
  label: string;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormResult);
  const prefix = useId();
  return (
    <form action={formAction} className="grid gap-5">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {fields.map(
        ({ name, label: fieldLabel, type = 'text', value, checked, options, ...props }) => (
          <div key={name}>
            {type === 'checkbox' ? (
              <label className="flex min-h-11 items-center gap-3" htmlFor={`${prefix}-${name}`}>
                <input
                  id={`${prefix}-${name}`}
                  name={name}
                  type="checkbox"
                  defaultChecked={checked}
                  disabled={disabled || pending}
                  className="size-5 accent-primary"
                />
                {fieldLabel}
              </label>
            ) : (
              <>
                <label className="mb-2 block text-sm font-semibold" htmlFor={`${prefix}-${name}`}>
                  {fieldLabel}
                </label>
                {type === 'select' ? (
                  <select
                    id={`${prefix}-${name}`}
                    name={name}
                    defaultValue={value}
                    disabled={disabled || pending}
                    required={props.required}
                    className="min-h-12 w-full rounded-lg border bg-card px-3"
                  >
                    {options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : type === 'textarea' ? (
                  <textarea
                    id={`${prefix}-${name}`}
                    name={name}
                    defaultValue={value}
                    disabled={disabled || pending}
                    rows={4}
                    {...props}
                    className="w-full rounded-lg border bg-card p-3"
                  />
                ) : (
                  <Input
                    id={`${prefix}-${name}`}
                    name={name}
                    type={type}
                    defaultValue={value}
                    disabled={disabled || pending}
                    {...props}
                  />
                )}
              </>
            )}
          </div>
        ),
      )}
      <Button type="submit" disabled={disabled || pending} className="justify-self-start">
        {pending ? 'Please wait…' : label}
      </Button>
      <p
        role={state.status === 'error' ? 'alert' : 'status'}
        aria-live="polite"
        className={state.status === 'error' ? 'text-sm text-destructive' : 'text-sm text-primary'}
      >
        {state.message}
      </p>
    </form>
  );
}
