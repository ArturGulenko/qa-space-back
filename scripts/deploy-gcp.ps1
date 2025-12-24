# PowerShell СЃРєСЂРёРїС‚ РґР»СЏ СЂР°Р·РІРµСЂС‚С‹РІР°РЅРёСЏ РЅР° Cloud Run
# РСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ: .\scripts\deploy-gcp.ps1 [PROJECT_ID] [REGION] [IMAGE_TAG]

param(
    [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT,
    [string]$Region = "us-central1",
    [string]$ImageTag = "latest"
)

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

# РЈСЃС‚Р°РЅР°РІР»РёРІР°РµРј РїСЂРѕРµРєС‚
gcloud config set project $ProjectId | Out-Null

# РџРѕР»СѓС‡Р°РµРј connection name Cloud SQL
$DB_INSTANCE = "qa-space-db"
$CONNECTION_NAME = gcloud sql instances describe $DB_INSTANCE --format="value(connectionName)" 2>&1

if ([string]::IsNullOrWhiteSpace($CONNECTION_NAME) -or $CONNECTION_NAME -match "ERROR") {
    Write-Host "Cloud SQL instance not found. Run: .\\scripts\\finish-gcp-setup.ps1" -ForegroundColor Red
    exit 1
}

# РџРѕР»СѓС‡Р°РµРј Service Account
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

# РЎРѕР±РёСЂР°РµРј РѕР±СЂР°Р·
Write-Host "Building Docker image..." -ForegroundColor Yellow
gcloud builds submit --config=cloudbuild-simple.yaml

if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker build failed." -ForegroundColor Red
    exit 1
}

# Р Р°Р·РІРµСЂС‚С‹РІР°РµРј РЅР° Cloud Run
Write-Host ""
Write-Host "Deploying to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy qa-space-backend `
  --image gcr.io/$ProjectId/qa-space-backend:$ImageTag `
  --region $Region `
  --platform managed `
  --allow-unauthenticated `
  --service-account $SA_EMAIL `
  --add-cloudsql-instances $CONNECTION_NAME `
  --set-env-vars "NODE_ENV=production,DATABASE_URL=$databaseUrl,JWT_ACCESS_SECRET=$($secrets.JWT_ACCESS_SECRET),JWT_REFRESH_SECRET=$($secrets.JWT_REFRESH_SECRET),S3_BUCKET=$($secrets.S3_BUCKET),S3_REGION=$($secrets.S3_REGION),S3_ENDPOINT=$($secrets.S3_ENDPOINT),S3_ACCESS_KEY=$($secrets.S3_ACCESS_KEY),S3_SECRET_KEY=$($secrets.S3_SECRET_KEY),ALLOWED_ORIGINS=$($secrets.ALLOWED_ORIGINS)" `
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

# РџРѕР»СѓС‡Р°РµРј URL СЃРµСЂРІРёСЃР°
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

