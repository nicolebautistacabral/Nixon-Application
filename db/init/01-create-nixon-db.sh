#!/bin/bash
# Runs once, on first container start with an empty data volume.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
    CREATE DATABASE nixon;
SQL
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname nixon -f /schema.sql
echo "nixon database created and schema applied."
