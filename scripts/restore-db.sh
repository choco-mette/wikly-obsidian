#!/bin/sh
set -e

# Wikly PostgreSQL Database Restore Script
BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
  echo "Penggunaan: $0 <path-to-backup-file.sql.gz>"
  echo "Contoh: $0 ./backups/wikly_wikly_20260907_120000.sql.gz"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "[restore] Error: Berkas ${BACKUP_FILE} tidak ditemukan!" >&2
  exit 1
fi

HOST="${POSTGRES_HOST:-localhost}"
PORT="${POSTGRES_PORT:-5432}"
USER="${POSTGRES_USER:-wikly}"
DB="${POSTGRES_DB:-wikly}"

echo "[restore] Memulihkan database ${DB} di ${HOST}:${PORT} dari ${BACKUP_FILE}..."

export PGPASSWORD="${POSTGRES_PASSWORD}"

case "$BACKUP_FILE" in
  *.gz)
    gunzip -c "$BACKUP_FILE" | psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" -v ON_ERROR_STOP=1
    ;;
  *.sql)
    psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" -v ON_ERROR_STOP=1 < "$BACKUP_FILE"
    ;;
  *)
    echo "[restore] Format berkas tidak dikenali (harus .sql atau .sql.gz)" >&2
    exit 1
    ;;
esac

echo "[restore] Pemulihan database berhasil diselesaikan."
