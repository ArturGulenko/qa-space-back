param(
    [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT,
    [string]$Region = "us-central1",
    [string]$ImageTag = "latest"
)

# Set UTF-8 encoding for proper text display
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['*:Encoding'] = 'utf8'

# PowerShell script for deployment to Cloud Run
# Usage: .\scripts\deploy-gcp.ps1 [PROJECT_ID] [REGION] [IMAGE_TAG]


if ([string]::IsNullOrWhiteSpace($ProjectId)) {
    Write-Host "PROJECT_ID is required. Usage: .\\scripts\\deploy-gcp.ps1 PROJECT_ID [REGION] [IMAGE_TAG]" -ForegroundColor Red
    exit 1
}

Write-Host "Deploying QA Space Backend to Cloud Run" -ForegroundColor Cyan
Write-Host "=============================================="
Write-Host "Project ID: $ProjectId"
Write-Host "Region: $Region"
Write-Host "Image Tag: $ImageTag"
Write-Host ""

# Set the project
gcloud config set project $ProjectId | Out-Null

# Get Cloud SQL connection name
$DB_INSTANCE = "qa-space-db"
$CONNECTION_NAME = gcloud sql instances describe $DB_INSTANCE --format="value(connectionName)" 2>&1

if ([string]::IsNullOrWhiteSpace($CONNECTION_NAME) -or $CONNECTION_NAME -match "ERROR") {
    Write-Host "Cloud SQL instance not found. Run: .\\scripts\\finish-gcp-setup.ps1" -ForegroundColor Red
    exit 1
}

# Get Service Account
$SA_EMAIL = "qa-space-backend@${ProjectId}.iam.gserviceaccount.com"

# Load secrets JSON from Secret Manager or local file.
$secrets = $null
try {
    $secretJson = gcloud secrets versions access latest --secret=qa-space-secrets 2>$null
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($secretJson)) {
        $secrets = $secretJson | ConvertFrom-Json
    }
} catch {
    $secrets = $null
}

if (-not $secrets -and (Test-Path "secrets-temp.json")) {
    try {
        $secrets = Get-Content -Raw "secrets-temp.json" | ConvertFrom-Json
    } catch {
        $secrets = $null
    }
}

if (-not $secrets) {
    Write-Host "Secrets not found in Secret Manager or secrets-temp.json." -ForegroundColor Red
    exit 1
}

$databaseUrl = $secrets.DATABASE_URL
if ($databaseUrl -match "postgresql://[^@]+@/") {
    $databaseUrl = $databaseUrl -replace "@/", "@localhost/"
}
if ($databaseUrl -notmatch "connection_limit=") {
    if ($databaseUrl -match "\?") {
        $databaseUrl = "$databaseUrl&connection_limit=5"
    } else {
        $databaseUrl = "$databaseUrl?connection_limit=5"
    }
}

# Build image
Write-Host "Building Docker image..." -ForegroundColor Yellow
gcloud builds submit --config=cloudbuild-simple.yaml

if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker build failed." -ForegroundColor Red
    exit 1
}

# Deploy to Cloud Run
Write-Host ""
Write-Host "Deploying to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy qa-space-backend `
  --image gcr.io/$ProjectId/qa-space-backend:$ImageTag `
  --region $Region `
  --platform managed `
  --allow-unauthenticated `
  --service-account $SA_EMAIL `
  --add-cloudsql-instances $CONNECTION_NAME `
  --set-env-vars "NODE_ENV=production,DATABASE_URL=$databaseUrl,JWT_ACCESS_SECRET=$($secrets.JWT_ACCESS_SECRET),JWT_REFRESH_SECRET=$($secrets.JWT_REFRESH_SECRET),S3_BUCKET=$($secrets.S3_BUCKET),S3_REGION=$($secrets.S3_REGION),S3_ENDPOINT=$($secrets.S3_ENDPOINT),S3_ACCESS_KEY=$($secrets.S3_ACCESS_KEY),S3_SECRET_KEY=$($secrets.S3_SECRET_KEY),ALLOWED_ORIGINS=$($secrets.ALLOWED_ORIGINS),GOOGLE_DRIVE_CLIENT_ID=$($secrets.GOOGLE_DRIVE_CLIENT_ID),GOOGLE_DRIVE_CLIENT_SECRET=$($secrets.GOOGLE_DRIVE_CLIENT_SECRET),GOOGLE_DRIVE_REDIRECT_URI=$($secrets.GOOGLE_DRIVE_REDIRECT_URI)" `
  --memory 512Mi `
  --cpu 1 `
  --min-instances 0 `
  --max-instances 10 `
  --timeout 300 `
  --port 3000

if ($LASTEXITCODE -ne 0) {
    Write-Host "Cloud Run deploy failed." -ForegroundColor Red
    exit 1
}

# Get service URL
$SERVICE_URL = gcloud run services describe qa-space-backend --region=$Region --format="value(status.url)"

Write-Host ""
Write-Host "Deploy completed." -ForegroundColor Green
Write-Host ""
Write-Host "Service URL: $SERVICE_URL" -ForegroundColor Cyan
Write-Host "   Health check: $SERVICE_URL/health" -ForegroundColor Gray
Write-Host "   API: $SERVICE_URL/api" -ForegroundColor Gray
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Cyan
Write-Host "   gcloud run services describe qa-space-backend --region=$Region" -ForegroundColor Gray
Write-Host ""
Write-Host "Logs:" -ForegroundColor Cyan
Write-Host "   gcloud run services logs read qa-space-backend --region=$Region --limit=50" -ForegroundColor Gray



