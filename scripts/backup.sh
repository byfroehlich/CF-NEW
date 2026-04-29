#!/bin/bash
# CreatorFlow — Tägliches Datenbank-Backup
# Läuft als Cron-Job auf einem separaten Server oder Render Cron Job
#
# Voraussetzungen:
#   apt install postgresql-client
#   npm install -g @backblaze/b2  (oder: pip install b2)
#
# Umgebungsvariablen setzen:
#   DATABASE_URL=postgresql://...
#   B2_KEY_ID=...
#   B2_APP_KEY=...
#   B2_BUCKET=creatorflow-backups

set -e

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_${DATE}.sql.gz"
TEMP_DIR="/tmp/creatorflow_backup"

mkdir -p $TEMP_DIR

echo "[$(date)] Starte Backup: $BACKUP_FILE"

# Datenbank dumpen und komprimieren
pg_dump "$DATABASE_URL" | gzip > "$TEMP_DIR/$BACKUP_FILE"

echo "[$(date)] Dump erstellt: $(du -sh $TEMP_DIR/$BACKUP_FILE)"

# Upload zu Backblaze B2
# b2 authorize-account $B2_KEY_ID $B2_APP_KEY
# b2 upload-file $B2_BUCKET "$TEMP_DIR/$BACKUP_FILE" "daily/$BACKUP_FILE"

# Alternativ: AWS S3 (EU-Region)
# aws s3 cp "$TEMP_DIR/$BACKUP_FILE" "s3://creatorflow-backups/daily/$BACKUP_FILE"

# Lokal aufräumen
rm "$TEMP_DIR/$BACKUP_FILE"

# Alte Backups löschen (älter als 7 Tage lokal)
find $TEMP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "[$(date)] Backup abgeschlossen"
