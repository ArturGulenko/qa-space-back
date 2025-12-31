#!/bin/sh
set -e

npx prisma migrate deploy
npx prisma generate
printf "%s\n" "SELECT to_regclass('public.' || quote_ident('GoogleDriveToken')) as table;" | npx prisma db execute --stdin
