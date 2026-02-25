#!/bin/bash
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/${TIMESTAMP}"

echo "=== Backup — ${TIMESTAMP} ==="
mkdir -p "$BACKUP_DIR"

# 1. Backup brain files
echo "Backing up brain data..."
cp -r brain/ "$BACKUP_DIR/brain/"
echo "  Done: brain/"

# 2. Export Supabase data (if CLI available)
if command -v supabase &> /dev/null; then
  echo "Exporting Supabase data..."
  supabase db dump --data-only > "$BACKUP_DIR/supabase_data.sql" 2>/dev/null || echo "  Supabase export skipped (not configured)"
else
  echo "  Supabase CLI not found — skipping database export"
  echo "  Install with: npm i -g supabase"
  echo "  Or export manually from Supabase dashboard → SQL Editor"
fi

# 3. Backup environment config (without secrets)
echo "Saving config snapshot..."
if [ -f .env ]; then
  # Strip values, keep only key names
  grep -oP '^[A-Z_]+(?==)' .env > "$BACKUP_DIR/env_keys.txt" 2>/dev/null || true
fi
echo "  Done"

# 4. Save git state
echo "Saving git state..."
git log --oneline -20 > "$BACKUP_DIR/git_log.txt" 2>/dev/null || true
git rev-parse HEAD > "$BACKUP_DIR/git_hash.txt" 2>/dev/null || true

# 5. Create archive
echo "Creating archive..."
tar -czf "backups/backup_${TIMESTAMP}.tar.gz" -C backups "$TIMESTAMP"
rm -rf "$BACKUP_DIR"

echo ""
echo "=== Backup complete ==="
echo "File: backups/backup_${TIMESTAMP}.tar.gz"
echo ""
echo "To upload to cloud storage:"
echo "  AWS:   aws s3 cp backups/backup_${TIMESTAMP}.tar.gz s3://your-bucket/backups/"
echo "  GCS:   gsutil cp backups/backup_${TIMESTAMP}.tar.gz gs://your-bucket/backups/"
