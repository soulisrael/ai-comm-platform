/**
 * Webhook setup helper. Prints instructions and validates configuration
 * for each channel's webhook.
 *
 * Usage:
 *   npx tsx scripts/setup-webhooks.ts
 */
import dotenv from 'dotenv';
dotenv.config();

function check(name: string, value: string | undefined): string {
  return value ? '  OK' : '  MISSING';
}

function main() {
  const baseUrl = process.env.BASE_URL || 'https://your-domain.com';

  console.log('=== Channel Webhook Setup ===\n');

  // WhatsApp
  console.log('--- WhatsApp Cloud API ---');
  console.log(`Webhook URL:  ${baseUrl}/api/webhooks/whatsapp`);
  console.log(`Verify Token: ${process.env.WHATSAPP_VERIFY_TOKEN || '(not set)'}`);
  console.log('Env vars:');
  console.log(`  WHATSAPP_PHONE_ID:     ${check('WHATSAPP_PHONE_ID', process.env.WHATSAPP_PHONE_ID)}`);
  console.log(`  WHATSAPP_TOKEN:        ${check('WHATSAPP_TOKEN', process.env.WHATSAPP_TOKEN)}`);
  console.log(`  WHATSAPP_APP_SECRET:   ${check('WHATSAPP_APP_SECRET', process.env.WHATSAPP_APP_SECRET)}`);
  console.log(`  WHATSAPP_VERIFY_TOKEN: ${check('WHATSAPP_VERIFY_TOKEN', process.env.WHATSAPP_VERIFY_TOKEN)}`);
  console.log('Steps:');
  console.log('  1. Go to Meta for Developers > Your App > WhatsApp > Configuration');
  console.log('  2. Set Callback URL to the webhook URL above');
  console.log('  3. Set Verify Token to match WHATSAPP_VERIFY_TOKEN');
  console.log('  4. Subscribe to messages field\n');

  // Instagram
  console.log('--- Instagram Messaging API ---');
  console.log(`Webhook URL:  ${baseUrl}/api/webhooks/instagram`);
  console.log(`Verify Token: ${process.env.INSTAGRAM_VERIFY_TOKEN || '(not set)'}`);
  console.log('Env vars:');
  console.log(`  INSTAGRAM_PAGE_ID:      ${check('INSTAGRAM_PAGE_ID', process.env.INSTAGRAM_PAGE_ID)}`);
  console.log(`  INSTAGRAM_TOKEN:        ${check('INSTAGRAM_TOKEN', process.env.INSTAGRAM_TOKEN)}`);
  console.log(`  INSTAGRAM_APP_SECRET:   ${check('INSTAGRAM_APP_SECRET', process.env.INSTAGRAM_APP_SECRET)}`);
  console.log(`  INSTAGRAM_VERIFY_TOKEN: ${check('INSTAGRAM_VERIFY_TOKEN', process.env.INSTAGRAM_VERIFY_TOKEN)}`);
  console.log('Steps:');
  console.log('  1. Go to Meta for Developers > Your App > Instagram > Webhooks');
  console.log('  2. Set Callback URL to the webhook URL above');
  console.log('  3. Set Verify Token to match INSTAGRAM_VERIFY_TOKEN');
  console.log('  4. Subscribe to messages field\n');

  // Telegram
  console.log('--- Telegram Bot API ---');
  console.log(`Webhook URL: ${baseUrl}/api/webhooks/telegram`);
  console.log('Env vars:');
  console.log(`  TELEGRAM_BOT_TOKEN:     ${check('TELEGRAM_BOT_TOKEN', process.env.TELEGRAM_BOT_TOKEN)}`);
  console.log(`  TELEGRAM_SECRET_TOKEN:  ${check('TELEGRAM_SECRET_TOKEN', process.env.TELEGRAM_SECRET_TOKEN)}`);
  console.log('Steps:');
  console.log('  1. Create a bot via @BotFather on Telegram');
  console.log('  2. Run the following command to set up the webhook:');

  if (process.env.TELEGRAM_BOT_TOKEN) {
    const tgUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`;
    console.log(`     curl -X POST "${tgUrl}" \\`);
    console.log(`       -H "Content-Type: application/json" \\`);
    console.log(`       -d '{"url":"${baseUrl}/api/webhooks/telegram","secret_token":"${process.env.TELEGRAM_SECRET_TOKEN || 'YOUR_SECRET'}"}'`);
  } else {
    console.log('     (Set TELEGRAM_BOT_TOKEN first)');
  }

  console.log('\n=== Done ===');
}

main();
