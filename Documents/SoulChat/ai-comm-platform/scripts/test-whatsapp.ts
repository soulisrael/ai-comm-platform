/**
 * Manual test script for WhatsApp adapter.
 * Sends a test message via WhatsApp Cloud API.
 *
 * Usage:
 *   WHATSAPP_PHONE_ID=xxx WHATSAPP_TOKEN=xxx npx tsx scripts/test-whatsapp.ts +1234567890
 */
import dotenv from 'dotenv';
dotenv.config();

import { WhatsAppAdapter } from '../src/channels/whatsapp-adapter';

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error('Usage: npx tsx scripts/test-whatsapp.ts <phone_number>');
    process.exit(1);
  }

  if (!process.env.WHATSAPP_PHONE_ID || !process.env.WHATSAPP_TOKEN) {
    console.error('Missing WHATSAPP_PHONE_ID or WHATSAPP_TOKEN env vars');
    process.exit(1);
  }

  const adapter = new WhatsAppAdapter();

  console.log(`Sending test message to ${to}...`);

  await adapter.sendMessage(to, {
    id: 'test-1',
    conversationId: 'test-conv',
    contactId: 'test-contact',
    direction: 'outbound',
    type: 'text',
    content: 'Hello from AI Communication Platform! This is a test message.',
    channel: 'whatsapp',
    metadata: {},
    timestamp: new Date(),
  });

  console.log('Message sent successfully!');

  // Test buttons
  console.log('Sending button test...');
  await adapter.sendButtons(to, 'How can we help you today?', [
    { id: 'sales', title: 'Sales' },
    { id: 'support', title: 'Support' },
    { id: 'other', title: 'Other' },
  ]);

  console.log('Button message sent!');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
