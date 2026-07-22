#!/usr/bin/env bash
# Deletes the local dev SQLite database so it gets recreated fresh from
# migrations on next launch.
#
# Why this is sometimes necessary during development: the db file lives in
# your OS's app-config directory (keyed by the app identifier in
# tauri.conf.json), NOT in this project folder. That means it persists
# across git checkouts/branches/patches. If you ever run a build whose
# migrations list doesn't match what a previous build recorded as applied
# (e.g. you jumped backward to an older commit, or a patch conflict quietly
# dropped a migration registration in main.rs), tauri-plugin-sql will refuse
# to start with an error like:
#   "migration N was previously applied but is missing in the resolved migrations"
# Deleting the db file and letting it rebuild from the current migrations
# is the correct, low-risk fix during development (this is a fresh dev
# database with test data, not anything you need to preserve).

set -euo pipefail

IDENTIFIER="com.rubans231.kotobanokizuna"

case "$(uname -s)" in
  Linux*)
    CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}"
    DB_PATH="$CONFIG_DIR/$IDENTIFIER/kotoba.db"
    ;;
  Darwin*)
    DB_PATH="$HOME/Library/Application Support/$IDENTIFIER/kotoba.db"
    ;;
  *)
    echo "Unrecognized OS. On Windows, delete this file manually:"
    echo "  %APPDATA%\\$IDENTIFIER\\kotoba.db"
    exit 1
    ;;
esac

if [ -f "$DB_PATH" ]; then
  rm -f "$DB_PATH" "$DB_PATH-journal" "$DB_PATH-wal" "$DB_PATH-shm"
  echo "Deleted $DB_PATH"
  echo "It will be recreated from migrations next time you run the app."
else
  echo "No db found at $DB_PATH (nothing to delete)."
fi
