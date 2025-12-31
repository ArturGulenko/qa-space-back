#!/bin/bash

# Стабильный скрипт для выполнения миграций Prisma
# Usage: ./scripts/run-migrations.sh [DATABASE_URL]

set -e

echo "🔄 Running Prisma migrations"
echo "======================================"
echo ""

# Determine DATABASE_URL
DATABASE_URL=""

# 1. Check if provided as parameter
if [ -n "$1" ]; then
    DATABASE_URL="$1"
    echo "✓ Using DATABASE_URL from parameter"
# 2. Check environment variable
elif [ -n "$DATABASE_URL" ]; then
    echo "✓ Using DATABASE_URL from environment variable"
# 3. Check secrets-temp.json (for local development)
elif [ -f "secrets-temp.json" ]; then
    if command -v jq &> /dev/null; then
        DATABASE_URL=$(jq -r '.DATABASE_URL // empty' secrets-temp.json)
        if [ -n "$DATABASE_URL" ] && [ "$DATABASE_URL" != "null" ]; then
            echo "✓ Using DATABASE_URL from secrets-temp.json"
        fi
    fi
fi

# 4. Default to local docker-compose database
if [ -z "$DATABASE_URL" ]; then
    DATABASE_URL="postgresql://postgres:postgres@localhost:5432/qa_space?schema=public"
    echo "⚠️  Using default local DATABASE_URL (docker-compose)"
    echo "   To use a different database, set DATABASE_URL environment variable or pass as parameter"
fi

export DATABASE_URL

# Mask password in output
MASKED_URL=$(echo "$DATABASE_URL" | sed 's/:[^:@]*@/:****@/')
echo ""
echo "Database: $MASKED_URL"
echo ""

# Check if Prisma is installed
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js and npm."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
fi

# Check database connection
echo "🔍 Checking database connection..."
if echo "SELECT 1;" | npx prisma db execute --stdin --schema=./prisma/schema.prisma > /dev/null 2>&1; then
    echo "✓ Database connection successful"
else
    echo "❌ Cannot connect to database. Please check:"
    echo "   1. Database is running"
    echo "   2. DATABASE_URL is correct"
    echo "   3. Network connectivity"
    exit 1
fi

echo ""

# Generate Prisma Client first (required for migrations)
echo "📦 Generating Prisma Client..."
npx prisma generate --schema=./prisma/schema.prisma
if [ $? -ne 0 ]; then
    echo "❌ Failed to generate Prisma Client"
    exit 1
fi
echo "✓ Prisma Client generated"
echo ""

# Apply migrations
echo "🚀 Applying migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma
if [ $? -ne 0 ]; then
    echo "❌ Migrations failed"
    echo ""
    echo "Troubleshooting:"
    echo "   1. Check database connection"
    echo "   2. Verify DATABASE_URL is correct"
    echo "   3. Check if database exists"
    echo "   4. Review migration files in prisma/migrations/"
    exit 1
fi

echo "✓ Migrations applied successfully"
echo ""

# Regenerate Prisma Client after migrations
echo "📦 Regenerating Prisma Client..."
npx prisma generate --schema=./prisma/schema.prisma
if [ $? -ne 0 ]; then
    echo "⚠️  Failed to regenerate Prisma Client, but migrations were successful"
else
    echo "✓ Prisma Client regenerated"
fi

echo ""
echo "✅ All migrations completed successfully!"
echo ""

# Show migration status
echo "📊 Migration status:"
npx prisma migrate status --schema=./prisma/schema.prisma

exit 0



