/**
 * Seeds the Supabase database with sample data for development/testing.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.
 */

import dotenv from 'dotenv';
dotenv.config();

import { getSupabaseClient } from '../src/database/supabase-client';

async function seed() {
  console.log('=== Seeding Database ===\n');

  const client = getSupabaseClient();
  if (!client) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.');
    console.error('Add them to your .env file and try again.');
    process.exit(1);
  }

  // 1. Seed contacts
  console.log('Seeding contacts...');
  const contacts = [
    {
      id: 'contact-seed-1',
      name: 'Alice Johnson',
      phone: '+1234567890',
      email: 'alice@example.com',
      channel: 'web',
      channel_user_id: 'alice-web-001',
      tags: ['vip', 'early-adopter'],
      custom_fields: { company: 'Acme Corp' },
      first_seen_at: new Date('2025-01-15').toISOString(),
      last_seen_at: new Date().toISOString(),
      conversation_count: 3,
      metadata: { source: 'organic' },
    },
    {
      id: 'contact-seed-2',
      name: 'Bob Smith',
      phone: '+0987654321',
      email: 'bob@example.com',
      channel: 'whatsapp',
      channel_user_id: 'bob-wa-001',
      tags: ['new'],
      custom_fields: {},
      first_seen_at: new Date('2025-03-01').toISOString(),
      last_seen_at: new Date().toISOString(),
      conversation_count: 1,
      metadata: {},
    },
    {
      id: 'contact-seed-3',
      name: 'Carol Davis',
      phone: null,
      email: 'carol@example.com',
      channel: 'web',
      channel_user_id: 'carol-web-001',
      tags: ['premium'],
      custom_fields: { plan: 'enterprise' },
      first_seen_at: new Date('2025-02-20').toISOString(),
      last_seen_at: new Date().toISOString(),
      conversation_count: 7,
      metadata: { referral: 'partner' },
    },
  ];

  const { error: contactError } = await client.from('contacts').upsert(contacts);
  if (contactError) {
    console.error('Error seeding contacts:', contactError);
  } else {
    console.log(`  Inserted ${contacts.length} contacts`);
  }

  // 2. Seed conversations
  console.log('Seeding conversations...');
  const conversations = [
    {
      id: 'conv-seed-1',
      contact_id: 'contact-seed-1',
      channel: 'web',
      status: 'active',
      current_agent: 'sales',
      context: { intent: 'purchase', sentiment: 'positive', language: 'English', leadScore: 85, tags: [], customFields: {} },
      started_at: new Date('2025-06-01T10:00:00Z').toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'conv-seed-2',
      contact_id: 'contact-seed-2',
      channel: 'whatsapp',
      status: 'closed',
      current_agent: 'support',
      context: { intent: 'support', sentiment: 'neutral', language: 'English', leadScore: null, tags: [], customFields: {} },
      started_at: new Date('2025-05-15T14:00:00Z').toISOString(),
      updated_at: new Date('2025-05-15T14:30:00Z').toISOString(),
    },
    {
      id: 'conv-seed-3',
      contact_id: 'contact-seed-3',
      channel: 'web',
      status: 'handoff',
      current_agent: 'handoff',
      context: { intent: 'billing', sentiment: 'negative', language: 'English', leadScore: null, tags: ['escalated'], customFields: {} },
      started_at: new Date('2025-06-10T09:00:00Z').toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const { error: convError } = await client.from('conversations').upsert(conversations);
  if (convError) {
    console.error('Error seeding conversations:', convError);
  } else {
    console.log(`  Inserted ${conversations.length} conversations`);
  }

  // 3. Seed messages
  console.log('Seeding messages...');
  const messages = [
    {
      id: 'msg-seed-1',
      conversation_id: 'conv-seed-1',
      contact_id: 'contact-seed-1',
      direction: 'inbound',
      type: 'text',
      content: 'Hi, I\'m interested in your Pro plan.',
      channel: 'web',
      metadata: {},
      timestamp: new Date('2025-06-01T10:00:00Z').toISOString(),
    },
    {
      id: 'msg-seed-2',
      conversation_id: 'conv-seed-1',
      contact_id: 'contact-seed-1',
      direction: 'outbound',
      type: 'text',
      content: 'Great to hear! Our Pro plan includes unlimited contacts and priority support. Would you like to schedule a demo?',
      channel: 'web',
      metadata: { agent: 'sales', confidence: 0.92 },
      timestamp: new Date('2025-06-01T10:00:05Z').toISOString(),
    },
    {
      id: 'msg-seed-3',
      conversation_id: 'conv-seed-2',
      contact_id: 'contact-seed-2',
      direction: 'inbound',
      type: 'text',
      content: 'I can\'t log in to my account.',
      channel: 'whatsapp',
      metadata: {},
      timestamp: new Date('2025-05-15T14:00:00Z').toISOString(),
    },
    {
      id: 'msg-seed-4',
      conversation_id: 'conv-seed-2',
      contact_id: 'contact-seed-2',
      direction: 'outbound',
      type: 'text',
      content: 'I\'m sorry to hear that. Let me help you reset your password. Could you confirm the email address associated with your account?',
      channel: 'whatsapp',
      metadata: { agent: 'support', confidence: 0.95 },
      timestamp: new Date('2025-05-15T14:00:08Z').toISOString(),
    },
  ];

  const { error: msgError } = await client.from('messages').upsert(messages);
  if (msgError) {
    console.error('Error seeding messages:', msgError);
  } else {
    console.log(`  Inserted ${messages.length} messages`);
  }

  console.log('\nDone! Database seeded successfully.');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
