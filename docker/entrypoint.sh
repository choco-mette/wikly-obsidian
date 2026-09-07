#!/bin/sh
set -e

echo "[entrypoint] Memeriksa koneksi database..."
DB_HOST="${POSTGRES_HOST:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-wikly}"
DB_NAME="${POSTGRES_DB:-wikly}"

# Tunggu PostgreSQL siap menerima koneksi
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; do
  echo "[entrypoint] Menunggu PostgreSQL di $DB_HOST:$DB_PORT..."
  sleep 2
done

echo "[entrypoint] PostgreSQL siap. Menjalankan migrasi skema database..."
if [ -f "./docker/migrate.js" ]; then
  node ./docker/migrate.js || {
    echo "[entrypoint] Peringatan: Migrasi gagal atau skema telah mutakhir."
  }
fi

echo "[entrypoint] Memulai aplikasi Wikly..."
exec "$@"
