#!/bin/sh
set -e

# Wikly PostgreSQL Automated Backup Script
HOST="${POSTGRES_HOST:-localhost}"
PORT="${POSTGRES_PORT:-5432}"
USER="${POSTGRES_USER:-wikly}"
DB="${POSTGRES_DB:-wikly}"
DIR="${BACKUP_DIR:-./backups}"
RETENTION="${BACKUP_RETENTION_DAYS:-7}"

mkdir -p "$DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="wikly_${DB}_${TIMESTAMP}.sql.gz"
FILEPATH="${DIR}/${FILENAME}"

echo "[backup] Memulai pencadangan database ${DB} dari ${HOST}:${PORT}..."

export PGPASSWORD="${POSTGRES_PASSWORD}"

pg_dump -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" --no-owner --clean --if-exists | gzip > "$FILEPATH"

if [ -s "$FILEPATH" ]; then
  SIZE=$(ls -lh "$FILEPATH" | awk '{print $5}')
  echo "[backup] Berhasil! Berkas cadangan tersimpan di ${FILEPATH} (${SIZE})."
else
  echo "[backup] Gagal! Berkas cadangan kosong atau tidak ditemukan." >&2
  rm -f "$FILEPATH"
  exit 1
fi

# Rotasi berkas lama sesuai retensi hari
echo "[backup] Membersihkan berkas cadangan lebih dari ${RETENTION} hari..."
find "$DIR" -name "wikly_${DB}_*.sql.gz" -type f -mtime +"$RETENTION" -exec rm -f {} +

echo "[backup] Operasi selesai dengan sukses."
