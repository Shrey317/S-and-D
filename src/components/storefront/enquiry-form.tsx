'use client';

import { useRef, useState, type FormEvent } from 'react';
import { MessageCircle, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { buildEnquiry } from '@/lib/whatsapp';

export function EnquiryForm({ phone = '+27835043385' }: { phone?: string }) {
  const submitRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<ReturnType<typeof buildEnquiry> | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    try {
      setDraft(
        buildEnquiry(String(fields.get('name') ?? ''), String(fields.get('message') ?? ''), phone),
      );
      setError('');
      setOpen(true);
    } catch {
      setError('Please enter your name and a message before continuing.');
    }
  }
  return (
    <>
      <form onSubmit={prepare} className="rounded-2xl border bg-card p-6 sm:p-9">
        <MessageCircle className="mb-4 size-7 text-primary" strokeWidth={1.5} aria-hidden="true" />
        <h2 className="text-2xl font-bold">What’s on your mind?</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Prepare an enquiry, review it, then send it yourself in WhatsApp. This form does not send
          or store your message.
        </p>
        <div className="mt-6 space-y-5">
          <div>
            <label htmlFor="enquiry-name" className="mb-2 block text-sm font-semibold">
              Your name
            </label>
            <Input
              id="enquiry-name"
              name="name"
              autoComplete="given-name"
              placeholder="Your first name"
              required
              maxLength={80}
            />
          </div>
          <div>
            <label htmlFor="enquiry-message" className="mb-2 block text-sm font-semibold">
              Your message
            </label>
            <textarea
              id="enquiry-message"
              name="message"
              rows={4}
              required
              maxLength={1000}
              placeholder="Ask us about a product, our shop or collection…"
              className="w-full resize-y rounded-lg border bg-background px-4 py-3 text-base placeholder:text-muted-foreground"
              aria-describedby="message-help"
            />
            <p id="message-help" className="mt-2 text-xs text-muted-foreground">
              Please don’t include payment details or other sensitive information.
            </p>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" ref={submitRef}>
            Prepare WhatsApp enquiry
            <ArrowUpRight aria-hidden="true" />
          </Button>
        </div>
      </form>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            submitRef.current?.focus();
          }}
        >
          <DialogTitle>Ready for WhatsApp</DialogTitle>
          <DialogDescription>
            Your message is prepared, not sent. Open WhatsApp to review and send it to the shop.
          </DialogDescription>
          <div className="mt-6 max-h-64 overflow-y-auto rounded-xl bg-secondary p-4 text-sm leading-7 whitespace-pre-wrap break-words">
            {draft?.text}
          </div>
          {draft ? (
            <Button asChild className="mt-6">
              <a href={draft.url} target="_blank" rel="noopener noreferrer">
                Open WhatsApp
                <ArrowUpRight aria-hidden="true" />
              </a>
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
