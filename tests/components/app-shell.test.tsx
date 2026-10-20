import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EnquiryForm } from '@/components/storefront/enquiry-form';
import ErrorPage from '@/app/error';
import NotFound from '@/app/not-found';

describe('foundation user experience', () => {
  it('prepares an enquiry for review without claiming it was sent', async () => {
    const user = userEvent.setup();
    render(<EnquiryForm />);
    await user.type(screen.getByLabelText('Your name'), 'Asha');
    await user.type(screen.getByLabelText('Your message'), 'Do you have apples & pears?');
    await user.click(screen.getByRole('button', { name: 'Prepare WhatsApp enquiry' }));
    expect(screen.getByRole('dialog', { name: 'Ready for WhatsApp' })).toBeVisible();
    expect(screen.getByText(/Your message is prepared, not sent/)).toBeVisible();
    const link = screen.getByRole('link', { name: 'Open WhatsApp' });
    expect(new URL(link.getAttribute('href')!).searchParams.get('text')).toContain(
      'apples & pears?',
    );
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Prepare WhatsApp enquiry' })).toHaveFocus();
  });

  it('retries an error without displaying sensitive exception content', async () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error('database-secret')} reset={reset} />);
    expect(screen.queryByText(/database-secret/)).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it('offers a real recovery route for missing pages', () => {
    render(<NotFound />);
    expect(screen.getByRole('link', { name: 'Return to the homepage' })).toHaveAttribute(
      'href',
      '/',
    );
  });
});
