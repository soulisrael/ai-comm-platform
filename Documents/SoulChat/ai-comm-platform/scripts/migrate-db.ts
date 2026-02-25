/**
 * Database migration helper.
 * Reads SQL migration files and outputs instructions for running them
 * in the Supabase dashboard SQL Editor.
 */

import fs from 'fs';
import path from 'path';

const migrationsDir = path.resolve(__dirname, '../src/database/migrations');

function main() {
  console.log('=== AI Communication Platform - Database Migration ===\n');

  if (!fs.existsSync(migrationsDir)) {
    console.error(`Migrations directory not found: ${migrationsDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }

  console.log('Instructions:');
  console.log('1. Open your Supabase project dashboard');
  console.log('2. Go to SQL Editor → New Query');
  console.log('3. Paste and run the SQL below\n');
  console.log('─'.repeat(60));

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`\n-- Migration: ${file}`);
    console.log('─'.repeat(60));
    console.log(sql);
    console.log('─'.repeat(60));
  }

  console.log('\nDone! Copy the SQL above into the Supabase SQL Editor to apply.');
}

main();
