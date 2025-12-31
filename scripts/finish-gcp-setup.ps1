# Set UTF-8 encoding for proper text display
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['*:Encoding'] = 'utf8'

# PowerShell script to complete GCP setup
# Run after Cloud SQL instance is ready

$PROJECT_ID = "qa-space-482211"
$REGION = "us-central1"
$DB_INSTANCE = "qa-space-db"
$DB_NAME = "qa_space"
$DB_USER = "postgres"

Write-Host "🔍 Checking Cloud SQL instance status..." -ForegroundColor Cyan
$status = gcloud sql instances describe $DB_INSTANCE --format="value(state)" 2>&1

if ($status -ne "RUNNABLE") {
    Write-Host "❌ Instance is not ready yet. Current status: $status" -ForegroundColor Red
    Write-Host "   Wait a few minutes and run the script again." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Instance is ready!" -ForegroundColor Green

# Create database
Write-Host ""
Write-Host "🗄️  Creating database..." -ForegroundColor Cyan
gcloud sql databases create $DB_NAME --instance=$DB_INSTANCE 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Database created" -ForegroundColor Green
} else {
    Write-Host "⚠️  Database already exists or creation error" -ForegroundColor Yellow
}

# Get connection name
$CONNECTION_NAME = gcloud sql instances describe $DB_INSTANCE --format="value(connectionName)"
Write-Host "   Connection Name: $CONNECTION_NAME" -ForegroundColor Gray

# Read password
$DB_PASSWORD = Get-Content db-password.txt -ErrorAction SilentlyContinue
if (-not $DB_PASSWORD) {
    Write-Host "❌ File db-password.txt not found!" -ForegroundColor Red
    exit 1
}

# Read JWT secrets
$jwtSecrets = Get-Content jwt-secrets.json | ConvertFrom-Json
$JWT_ACCESS_SECRET = $jwtSecrets.ACCESS
$JWT_REFRESH_SECRET = $jwtSecrets.REFRESH

# Read GCS key
$gcsKey = Get-Content gcs-key.json | ConvertFrom-Json
$GCS_ACCESS_KEY = $gcsKey.client_email
$GCS_SECRET_KEY = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($gcsKey.private_key))

# Build DATABASE_URL
$DATABASE_URL = "postgresql://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${CONNECTION_NAME}"

# Request ALLOWED_ORIGINS
Write-Host ""
$ALLOWED_ORIGINS = Read-Host "Enter ALLOWED_ORIGINS (comma-separated, or * for all) [*]"
if ([string]::IsNullOrWhiteSpace($ALLOWED_ORIGINS)) {
    $ALLOWED_ORIGINS = "*"
}

# Create JSON for Secret Manager
$BUCKET_NAME = "${PROJECT_ID}-qa-space-files"
$GCS_ENDPOINT = "https://storage.googleapis.com"

$secretJson = @{
    DATABASE_URL = $DATABASE_URL
    JWT_ACCESS_SECRET = $JWT_ACCESS_SECRET
    JWT_REFRESH_SECRET = $JWT_REFRESH_SECRET
    S3_BUCKET = $BUCKET_NAME
    S3_REGION = $REGION
    S3_ENDPOINT = $GCS_ENDPOINT
    S3_ACCESS_KEY = $GCS_ACCESS_KEY
    S3_SECRET_KEY = $GCS_SECRET_KEY
    ALLOWED_ORIGINS = $ALLOWED_ORIGINS
} | ConvertTo-Json

# Save to temporary file
$secretJson | Out-File -FilePath secrets-temp.json -Encoding utf8

# Create or update secret
Write-Host ""
Write-Host "🔐 Creating Secret Manager secret..." -ForegroundColor Cyan
$secretExists = gcloud secrets describe qa-space-secrets 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   Updating existing secret..." -ForegroundColor Yellow
    gcloud secrets versions add qa-space-secrets --data-file=secrets-temp.json
} else {
    Write-Host "   Creating new secret..." -ForegroundColor Yellow
    gcloud secrets create qa-space-secrets --data-file=secrets-temp.json --replication-policy="automatic"
}

# Grant access to Service Account
$SA_EMAIL = "qa-space-backend@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud secrets add-iam-policy-binding qa-space-secrets `
    --member="serviceAccount:${SA_EMAIL}" `
    --role="roles/secretmanager.secretAccessor" | Out-Null

Write-Host "✅ Secret created/updated" -ForegroundColor Green

# Cleanup
Remove-Item secrets-temp.json -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "✅ Setup completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Run migrations: .\scripts\run-migrations-gcp.ps1" -ForegroundColor White
Write-Host "2. Deploy application: .\scripts\deploy-gcp.ps1" -ForegroundColor White
Write-Host ""
Write-Host "📊 Useful commands:" -ForegroundColor Cyan
Write-Host "   gcloud run services describe qa-space-backend --region=$REGION" -ForegroundColor Gray
Write-Host "   gcloud sql instances describe $DB_INSTANCE" -ForegroundColor Gray
Write-Host "   gsutil ls gs://$BUCKET_NAME" -ForegroundColor Gray



