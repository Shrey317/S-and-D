'use client';

import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { business } from '@/config/business';

export function CopyAddress({ address = business.address }: { address?: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      toast.success('Shop address copied');
    } catch {
      toast.error('Could not copy the address. Please select and copy the address above.');
    }
  }
  return (
    <Button variant="outline" onClick={copy}>
      <Copy aria-hidden="true" />
      Copy address
    </Button>
  );
}
