# Стабильный скрипт для выполнения миграций Prisma
# Usage: .\scripts\run-migrations.ps1 [DATABASE_URL]

param(
    [string]$DatabaseUrl = $null
)

# Set UTF-8 encoding for proper text display
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['*:Encoding'] = 'utf8'

Write-Host "[*] Running Prisma migrations" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Determine DATABASE_URL
$DATABASE_URL = $null

# 1. Check if provided as parameter
if (-not [string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    $DATABASE_URL = $DatabaseUrl
    Write-Host "[OK] Using DATABASE_URL from parameter" -ForegroundColor Green
}
# 2. Check environment variable
elseif (-not [string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
    $DATABASE_URL = $env:DATABASE_URL
    Write-Host "[OK] Using DATABASE_URL from environment variable" -ForegroundColor Green
}
# 3. Check secrets-temp.json (for local development)
elseif (Test-Path "secrets-temp.json") {
    try {
        $secrets = Get-Content -Raw "secrets-temp.json" | ConvertFrom-Json
        if ($secrets.DATABASE_URL) {
            $DATABASE_URL = $secrets.DATABASE_URL
            Write-Host "[OK] Using DATABASE_URL from secrets-temp.json" -ForegroundColor Green
        }
    } catch {
        Write-Host "[WARN] Could not read secrets-temp.json: $_" -ForegroundColor Yellow
    }
}
# 4. Default to local docker-compose database
else {
    $DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/qa_space?schema=public"
    Write-Host "[WARN] Using default local DATABASE_URL (docker-compose)" -ForegroundColor Yellow
    Write-Host "   To use a different database, set DATABASE_URL environment variable or pass as parameter" -ForegroundColor Gray
}

if ([string]::IsNullOrWhiteSpace($DATABASE_URL)) {
    Write-Host "[ERROR] DATABASE_URL not found. Please provide it as:" -ForegroundColor Red
    Write-Host "   1. Parameter: .\scripts\run-migrations.ps1 'postgresql://user:pass@host:5432/db'" -ForegroundColor Gray
    Write-Host "   2. Environment variable: `$env:DATABASE_URL='...'" -ForegroundColor Gray
    Write-Host "   3. secrets-temp.json file with DATABASE_URL field" -ForegroundColor Gray
    exit 1
}

# Set environment variable for Prisma
$env:DATABASE_URL = $DATABASE_URL

Write-Host ""
Write-Host "Database: $($DATABASE_URL -replace ':[^:@]+@', ':****@')" -ForegroundColor Gray
Write-Host ""

# Check if Prisma is installed
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] npx not found. Please install Node.js and npm." -ForegroundColor Red
    exit 1
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "[*] Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
}

# Check database connection
Write-Host "[*] Checking database connection..." -ForegroundColor Yellow
try {
    $testQuery = "SELECT 1;" | npx prisma db execute --stdin --schema=./prisma/schema.prisma 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Cannot connect to database. Please check:" -ForegroundColor Red
        Write-Host "   1. Database is running" -ForegroundColor Gray
        Write-Host "   2. DATABASE_URL is correct" -ForegroundColor Gray
        Write-Host "   3. Network connectivity" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Error: $testQuery" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Database connection successful" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Could not verify database connection, continuing anyway..." -ForegroundColor Yellow
}

Write-Host ""

# Generate Prisma Client first (required for migrations)
Write-Host "[*] Generating Prisma Client..." -ForegroundColor Yellow
npx prisma generate --schema=./prisma/schema.prisma
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to generate Prisma Client" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Prisma Client generated" -ForegroundColor Green
Write-Host ""

# Apply migrations
Write-Host "[*] Applying migrations..." -ForegroundColor Yellow
npx prisma migrate deploy --schema=./prisma/schema.prisma
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Migrations failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   1. Check database connection" -ForegroundColor Gray
    Write-Host "   2. Verify DATABASE_URL is correct" -ForegroundColor Gray
    Write-Host "   3. Check if database exists" -ForegroundColor Gray
    Write-Host "   4. Review migration files in prisma/migrations/" -ForegroundColor Gray
    exit 1
}

Write-Host "[OK] Migrations applied successfully" -ForegroundColor Green
Write-Host ""

# Regenerate Prisma Client after migrations
Write-Host "[*] Regenerating Prisma Client..." -ForegroundColor Yellow
npx prisma generate --schema=./prisma/schema.prisma
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARN] Failed to regenerate Prisma Client, but migrations were successful" -ForegroundColor Yellow
} else {
    Write-Host "[OK] Prisma Client regenerated" -ForegroundColor Green
}

Write-Host ""
Write-Host "[SUCCESS] All migrations completed successfully!" -ForegroundColor Green
Write-Host ""

# Show migration status
Write-Host "[*] Migration status:" -ForegroundColor Cyan
npx prisma migrate status --schema=./prisma/schema.prisma

exit 0

