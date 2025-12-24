# PowerShell СЃРєСЂРёРїС‚ РґР»СЏ Р·Р°РїСѓСЃРєР° РјРёРіСЂР°С†РёР№ Prisma РЅР° Cloud Run
# РСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ: .\scripts\run-migrations-gcp.ps1 [PROJECT_ID] [REGION]

param(
    [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT,
    [string]$Region = "us-central1"
)

if ([string]::IsNullOrWhiteSpace($ProjectId)) {
    Write-Host "вќЊ PROJECT_ID РЅРµ СѓРєР°Р·Р°РЅ. РСЃРїРѕР»СЊР·СѓР№С‚Рµ: .\scripts\run-migrations-gcp.ps1 PROJECT_ID [REGION]" -ForegroundColor Red
    exit 1
}

Write-Host "Running Prisma migrations on Cloud Run" -ForegroundColor Cyan
Write-Host "======================================"
Write-Host "Project ID: $ProjectId"
Write-Host "Region: $Region"
Write-Host ""

# РЈСЃС‚Р°РЅР°РІР»РёРІР°РµРј РїСЂРѕРµРєС‚
gcloud config set project $ProjectId | Out-Null

# РџРѕР»СѓС‡Р°РµРј connection name Cloud SQL
$DB_INSTANCE = "qa-space-db"
$CONNECTION_NAME = gcloud sql instances describe $DB_INSTANCE --format="value(connectionName)" 2>&1

if ([string]::IsNullOrWhiteSpace($CONNECTION_NAME) -or $CONNECTION_NAME -match "ERROR") {
    Write-Host "вќЊ Cloud SQL РёРЅСЃС‚Р°РЅСЃ РЅРµ РЅР°Р№РґРµРЅ. РЎРЅР°С‡Р°Р»Р° Р·Р°РїСѓСЃС‚РёС‚Рµ: .\scripts\finish-gcp-setup.ps1" -ForegroundColor Red
    exit 1
}

# РџРѕР»СѓС‡Р°РµРј Service Account
$SA_EMAIL = "qa-space-backend@${ProjectId}.iam.gserviceaccount.com"

# Prefer Secret Manager JSON; fallback to local secrets-temp.json for DATABASE_URL.
$DATABASE_URL = $null
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

if ([string]::IsNullOrWhiteSpace($DATABASE_URL)) {
    Write-Host "DATABASE_URL not found in Secret Manager or secrets-temp.json." -ForegroundColor Red
    exit 1
}

# РЎРѕР±РёСЂР°РµРј РѕР±СЂР°Р· РґР»СЏ РјРёРіСЂР°С†РёР№
Write-Host "Building migration image..." -ForegroundColor Yellow
if (Test-Path "cloudbuild.migrations.yaml") {
    gcloud builds submit --config=cloudbuild.migrations.yaml .
} else {
    Write-Host "   РСЃРїРѕР»СЊР·СѓРµРј РїСЂСЏРјРѕР№ docker build..." -ForegroundColor Gray
    docker build -f Dockerfile.migrations -t gcr.io/$ProjectId/qa-space-migrations:latest .
    docker push gcr.io/$ProjectId/qa-space-migrations:latest
}

# РџСЂРѕРІРµСЂСЏРµРј, СЃСѓС‰РµСЃС‚РІСѓРµС‚ Р»Рё job
Write-Host ""
Write-Host "рџљЂ РЎРѕР·РґР°РЅРёРµ/РѕР±РЅРѕРІР»РµРЅРёРµ Cloud Run Job РґР»СЏ РјРёРіСЂР°С†РёР№..." -ForegroundColor Yellow
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
    --args "-c,npx prisma migrate deploy; npx prisma generate" | Out-Null
if ($LASTEXITCODE -ne 0) { exit 1 }

# Р—Р°РїСѓСЃРєР°РµРј job
Write-Host ""
Write-Host "вЏі Р—Р°РїСѓСЃРє Р·Р°РґР°С‡Рё РјРёРіСЂР°С†РёР№..." -ForegroundColor Yellow
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
    Write-Host "вќЊ РћС€РёР±РєР° Р·Р°РїСѓСЃРєР° Р·Р°РґР°С‡Рё" -ForegroundColor Red
    Write-Host $executionOutput
    exit 1
}

Write-Host "вњ… Р—Р°РґР°С‡Р° Р·Р°РїСѓС‰РµРЅР°: $EXECUTION_NAME" -ForegroundColor Green
Write-Host ""
Write-Host "To monitor execution:" -ForegroundColor Cyan
Write-Host "   gcloud run jobs executions describe $EXECUTION_NAME --region=$Region" -ForegroundColor Gray
Write-Host ""
Write-Host "РџСЂРѕСЃРјРѕС‚СЂ Р»РѕРіРѕРІ:" -ForegroundColor Cyan
Write-Host "   gcloud logging read resource.type=cloud_run_job --limit=50" -ForegroundColor Gray

# Р–РґРµРј Р·Р°РІРµСЂС€РµРЅРёСЏ
Write-Host ""
Write-Host "вЏі РћР¶РёРґР°РЅРёРµ Р·Р°РІРµСЂС€РµРЅРёСЏ РјРёРіСЂР°С†РёР№ (СЌС‚Рѕ РјРѕР¶РµС‚ Р·Р°РЅСЏС‚СЊ РЅРµСЃРєРѕР»СЊРєРѕ РјРёРЅСѓС‚)..." -ForegroundColor Yellow
Write-Host "   Р’С‹ РјРѕР¶РµС‚Рµ РѕС‚СЃР»РµР¶РёРІР°С‚СЊ РїСЂРѕРіСЂРµСЃСЃ РІ Cloud Console РёР»Рё С‡РµСЂРµР· Р»РѕРіРё" -ForegroundColor Gray

# РСЃРїРѕР»СЊР·СѓРµРј РѕРїРµСЂР°С†РёРё РґР»СЏ РѕР¶РёРґР°РЅРёСЏ
Start-Sleep -Seconds 10

# РџСЂРѕРІРµСЂСЏРµРј СЃС‚Р°С‚СѓСЃ РЅРµСЃРєРѕР»СЊРєРѕ СЂР°Р·
$maxAttempts = 60
$attempt = 0
$completed = $false

while ($attempt -lt $maxAttempts -and -not $completed) {
    $status = gcloud run jobs executions describe $EXECUTION_NAME --region=$Region --format="value(status.conditions[0].type)" 2>&1
    
    if ($status -eq "Complete") {
        $completed = $true
        Write-Host ""
        Write-Host "вњ… РњРёРіСЂР°С†РёРё СѓСЃРїРµС€РЅРѕ РІС‹РїРѕР»РЅРµРЅС‹!" -ForegroundColor Green
        exit 0
    } elseif ($status -match "Failed" -or $status -match "ERROR") {
        Write-Host ""
        Write-Host "вќЊ РњРёРіСЂР°С†РёРё Р·Р°РІРµСЂС€РёР»РёСЃСЊ СЃ РѕС€РёР±РєРѕР№. РЎС‚Р°С‚СѓСЃ: $status" -ForegroundColor Red
        Write-Host "   РџСЂРѕРІРµСЂСЊС‚Рµ Р»РѕРіРё РґР»СЏ РґРµС‚Р°Р»РµР№" -ForegroundColor Yellow
        exit 1
    }
    
    $attempt++
    Start-Sleep -Seconds 10
    Write-Host "." -NoNewline
}

if (-not $completed) {
    Write-Host ""
    Write-Host "вљ пёЏ  РњРёРіСЂР°С†РёРё РµС‰Рµ РІС‹РїРѕР»РЅСЏСЋС‚СЃСЏ РёР»Рё РїСЂРµРІС‹С€РµРЅРѕ РІСЂРµРјСЏ РѕР¶РёРґР°РЅРёСЏ" -ForegroundColor Yellow
    Write-Host "   РџСЂРѕРІРµСЂСЊС‚Рµ СЃС‚Р°С‚СѓСЃ РІСЂСѓС‡РЅСѓСЋ:" -ForegroundColor Cyan
    Write-Host "   gcloud run jobs executions describe $EXECUTION_NAME --region=$Region" -ForegroundColor Gray
    exit 1
}


