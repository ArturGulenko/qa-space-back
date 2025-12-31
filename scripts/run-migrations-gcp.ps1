param(
    [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT,
    [string]$Region = "us-central1",
    [string]$DatabaseUrl = $null
)

# Set UTF-8 encoding for proper text display
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['*:Encoding'] = 'utf8'

# PowerShell script to run Prisma migrations on Cloud Run
# Usage: .\scripts\run-migrations-gcp.ps1 [PROJECT_ID] [REGION]


if ([string]::IsNullOrWhiteSpace($ProjectId)) {
    Write-Host "вќЊ PROJECT_ID not specified. Use: .\scripts\run-migrations-gcp.ps1 PROJECT_ID [REGION]" -ForegroundColor Red
    exit 1
}

Write-Host "Running Prisma migrations on Cloud Run" -ForegroundColor Cyan
Write-Host "======================================"
Write-Host "Project ID: $ProjectId"
Write-Host "Region: $Region"
Write-Host ""

# Set the project
gcloud config set project $ProjectId | Out-Null

# Get Cloud SQL connection name
$DB_INSTANCE = "qa-space-db"
$CONNECTION_NAME = gcloud sql instances describe $DB_INSTANCE --format="value(connectionName)" 2>&1

if ([string]::IsNullOrWhiteSpace($CONNECTION_NAME) -or $CONNECTION_NAME -match "ERROR") {
    Write-Host "вќЊ Cloud SQL instance not found. Run first: .\scripts\finish-gcp-setup.ps1" -ForegroundColor Red
    exit 1
}

# Get Service Account
$SA_EMAIL = "qa-space-backend@${ProjectId}.iam.gserviceaccount.com"

# Prefer explicit DatabaseUrl param, then Secret Manager JSON, then local secrets-temp.json.
$DATABASE_URL = $null
if (-not [string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    $DATABASE_URL = $DatabaseUrl
} else {
    try {
        $secretJson = gcloud secrets versions access latest --secret=qa-space-secrets 2>$null
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($secretJson)) {
            $DATABASE_URL = ($secretJson | ConvertFrom-Json).DATABASE_URL
        }
    } catch {
        $DATABASE_URL = $null
    }

    if ([string]::IsNullOrWhiteSpace($DATABASE_URL) -and (Test-Path "secrets-temp.json")) {
        try {
            $DATABASE_URL = (Get-Content -Raw "secrets-temp.json" | ConvertFrom-Json).DATABASE_URL
        } catch {
            $DATABASE_URL = $null
        }
    }
}

if ([string]::IsNullOrWhiteSpace($DATABASE_URL)) {
    Write-Host "DATABASE_URL not found in Secret Manager or secrets-temp.json." -ForegroundColor Red
    exit 1
}

# Prisma CLI expects a host in the URL; use localhost for Cloud SQL unix socket.
if ($DATABASE_URL -match "postgresql://[^@]+@/") {
    $DATABASE_URL = $DATABASE_URL -replace "@/", "@localhost/"
}


# Build migration image
Write-Host "Building migration image..." -ForegroundColor Yellow
if (Test-Path "cloudbuild.migrations.yaml") {
    gcloud builds submit --config=cloudbuild.migrations.yaml .
} else {
    Write-Host "   Using direct docker build..." -ForegroundColor Gray
    docker build -f Dockerfile.migrations -t gcr.io/$ProjectId/qa-space-migrations:latest .
    docker push gcr.io/$ProjectId/qa-space-migrations:latest
}

# Check if job exists
Write-Host ""
Write-Host "рџ”„ Creating/updating Cloud Run Job for migrations..." -ForegroundColor Yellow
$jobExists = gcloud run jobs describe qa-space-migrations --region=$Region 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   Job exists, deleting to reset config..." -ForegroundColor Gray
    gcloud run jobs delete qa-space-migrations --region=$Region --quiet | Out-Null
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

Write-Host "   Creating Cloud Run Job..." -ForegroundColor Gray
gcloud run jobs create qa-space-migrations `
    --image gcr.io/$ProjectId/qa-space-migrations:latest `
    --region $Region `
    --service-account $SA_EMAIL `
    --set-cloudsql-instances $CONNECTION_NAME `
    --set-env-vars "NODE_ENV=production,DATABASE_URL=$DATABASE_URL" `
    --memory 512Mi `
    --cpu 1 `
    --task-timeout 600 `
    --max-retries 1 `
    --command "sh" `
    --args="-c,./scripts/run-migrations-verify.sh" | Out-Null
if ($LASTEXITCODE -ne 0) { exit 1 }

# Execute job
Write-Host ""
Write-Host "вЏі Starting migration task..." -ForegroundColor Yellow
$executionOutput = gcloud run jobs execute qa-space-migrations --region=$Region --format="value(metadata.name)" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host $executionOutput
    exit 1
}
$EXECUTION_NAME = $executionOutput | Select-Object -First 1

if ([string]::IsNullOrWhiteSpace($EXECUTION_NAME) -or $EXECUTION_NAME -match "Creating execution") {
    $EXECUTION_NAME = gcloud run jobs executions list --job=qa-space-migrations --region=$Region --limit=1 --format="value(name)" 2>$null | Select-Object -First 1
}

if ([string]::IsNullOrWhiteSpace($EXECUTION_NAME) -or $EXECUTION_NAME -match "ERROR") {
    Write-Host "вќЊ Error starting task" -ForegroundColor Red
    Write-Host $executionOutput
    exit 1
}

Write-Host "вњ… Task started: $EXECUTION_NAME" -ForegroundColor Green
Write-Host ""
Write-Host "To monitor execution:" -ForegroundColor Cyan
Write-Host "   gcloud run jobs executions describe $EXECUTION_NAME --region=$Region" -ForegroundColor Gray
Write-Host ""
Write-Host "View logs:" -ForegroundColor Cyan
Write-Host "   gcloud logging read resource.type=cloud_run_job --limit=50" -ForegroundColor Gray

# Wait for completion
Write-Host ""
Write-Host "вЏі Waiting for migrations to complete (this may take several minutes)..." -ForegroundColor Yellow
Write-Host "   You can track progress in Cloud Console or through logs" -ForegroundColor Gray

# Use operations for waiting
Start-Sleep -Seconds 10

# Check status multiple times
$maxAttempts = 60
$attempt = 0
$completed = $false

while ($attempt -lt $maxAttempts -and -not $completed) {
    $status = gcloud run jobs executions describe $EXECUTION_NAME --region=$Region --format="value(status.conditions[0].type)" 2>&1
    
    if ($status -eq "Complete") {
        $completed = $true
        Write-Host ""
        Write-Host "вњ… Migrations completed successfully!" -ForegroundColor Green
        exit 0
    } elseif ($status -match "Failed" -or $status -match "ERROR") {
        Write-Host ""
        Write-Host "вќЊ Migrations failed. Status: $status" -ForegroundColor Red
        Write-Host "   Check logs for details" -ForegroundColor Yellow
        exit 1
    }
    
    $attempt++
    Start-Sleep -Seconds 10
    Write-Host "." -NoNewline
}

if (-not $completed) {
    Write-Host ""
    Write-Host "вЏ°  Migrations are still running or timeout exceeded" -ForegroundColor Yellow
    Write-Host "   Check status manually:" -ForegroundColor Cyan
    Write-Host "   gcloud run jobs executions describe $EXECUTION_NAME --region=$Region" -ForegroundColor Gray
    exit 1
}
