import * as React from 'react';
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Hr,
  Link,
  render,
  toPlainText,
} from 'react-email';
import { noticeTitles, noticeSummary, type Notice } from '@/features/communications/messages';
export async function renderNotice(kind: string, n: Notice, audience: string, siteUrl: string) {
  const title = noticeTitles[kind] || 'Order update';
  const subject = `${n.snapshot.isTest ? '[LOCAL TEST] ' : ''}${title} · S & D Fruit and Veg`;
  const href = new URL(
    audience === 'ADMIN' ? `/admin/orders/${n.orderId}` : `/account/orders/${n.orderId}`,
    siteUrl,
  ).href;
  const html = await render(
    <Html lang="en">
      <Head />
      <Preview>{subject}</Preview>
      <Body
        style={{ backgroundColor: '#f8f6ee', fontFamily: 'Arial,sans-serif', color: '#173c2d' }}
      >
        <Container style={{ maxWidth: 600, padding: 32, backgroundColor: '#ffffff' }}>
          <Heading>S &amp; D Fruit and Veg</Heading>
          <Text>Freshness You Can Trust. Quality You Can Taste.</Text>
          <Hr />
          <Heading as="h2">{title}</Heading>
          {n.snapshot.isTest && (
            <Text style={{ fontWeight: 'bold' }}>
              Local test record — no real purchase or delivery.
            </Text>
          )}
          <Text>{audience === 'ADMIN' ? 'Store administrator' : `Hello ${n.snapshot.name}`},</Text>
          <Text>{noticeSummary(kind, n)}</Text>
          <Text>Order #{n.orderId}</Text>
          <Text>
            Order total R{n.total} · {n.method === 'COLLECTION' ? 'Collection' : 'Delivery'}
          </Text>
          {kind !== 'REFUND_COMPLETED' && (
            <Text>
              Order status: {n.status}. Payment: {n.paymentStatus}.
            </Text>
          )}
          {n.snapshot.lines.map((l, i) => (
            <Text key={i}>
              {l.quantity} × {l.name} · {l.label} · R{l.total}
            </Text>
          ))}
          <Text>Planning date: {n.snapshot.planningDate}. Arrangements require confirmation.</Text>
          <Link href={href}>Sign in to view the order</Link>
          <Hr />
          <Text>
            This is a transactional order update. Reply through the shop’s published contact
            channels if you need help.
          </Text>
        </Container>
      </Body>
    </Html>,
  );
  return { subject, html, text: toPlainText(html) };
}
