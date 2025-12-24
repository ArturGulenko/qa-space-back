# PowerShell скрипт для завершения настройки GCP
# Запустите после того, как Cloud SQL инстанс будет готов

$PROJECT_ID = "qa-space-482211"
$REGION = "us-central1"
$DB_INSTANCE = "qa-space-db"
$DB_NAME = "qa_space"
$DB_USER = "postgres"

Write-Host "🔍 Проверка статуса Cloud SQL инстанса..." -ForegroundColor Cyan
$status = gcloud sql instances describe $DB_INSTANCE --format="value(state)" 2>&1

if ($status -ne "RUNNABLE") {
    Write-Host "❌ Инстанс еще не готов. Текущий статус: $status" -ForegroundColor Red
    Write-Host "   Подождите несколько минут и запустите скрипт снова." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Инстанс готов!" -ForegroundColor Green

# Создаем базу данных
Write-Host ""
Write-Host "🗄️  Создание базы данных..." -ForegroundColor Cyan
gcloud sql databases create $DB_NAME --instance=$DB_INSTANCE 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ База данных создана" -ForegroundColor Green
} else {
    Write-Host "⚠️  База данных уже существует или ошибка создания" -ForegroundColor Yellow
}

# Получаем connection name
$CONNECTION_NAME = gcloud sql instances describe $DB_INSTANCE --format="value(connectionName)"
Write-Host "   Connection Name: $CONNECTION_NAME" -ForegroundColor Gray

# Читаем пароль
$DB_PASSWORD = Get-Content db-password.txt -ErrorAction SilentlyContinue
if (-not $DB_PASSWORD) {
    Write-Host "❌ Файл db-password.txt не найден!" -ForegroundColor Red
    exit 1
}

# Читаем JWT секреты
$jwtSecrets = Get-Content jwt-secrets.json | ConvertFrom-Json
$JWT_ACCESS_SECRET = $jwtSecrets.ACCESS
$JWT_REFRESH_SECRET = $jwtSecrets.REFRESH

# Читаем GCS ключ
$gcsKey = Get-Content gcs-key.json | ConvertFrom-Json
$GCS_ACCESS_KEY = $gcsKey.client_email
$GCS_SECRET_KEY = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($gcsKey.private_key))

# Формируем DATABASE_URL
$DATABASE_URL = "postgresql://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${CONNECTION_NAME}"

# Запрашиваем ALLOWED_ORIGINS
Write-Host ""
$ALLOWED_ORIGINS = Read-Host "Введите ALLOWED_ORIGINS (через запятую, или * для всех) [*]"
if ([string]::IsNullOrWhiteSpace($ALLOWED_ORIGINS)) {
    $ALLOWED_ORIGINS = "*"
}

# Создаем JSON для Secret Manager
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

# Сохраняем во временный файл
$secretJson | Out-File -FilePath secrets-temp.json -Encoding utf8

# Создаем или обновляем secret
Write-Host ""
Write-Host "🔐 Создание Secret Manager secret..." -ForegroundColor Cyan
$secretExists = gcloud secrets describe qa-space-secrets 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   Обновление существующего secret..." -ForegroundColor Yellow
    gcloud secrets versions add qa-space-secrets --data-file=secrets-temp.json
} else {
    Write-Host "   Создание нового secret..." -ForegroundColor Yellow
    gcloud secrets create qa-space-secrets --data-file=secrets-temp.json --replication-policy="automatic"
}

# Даем доступ Service Account
$SA_EMAIL = "qa-space-backend@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud secrets add-iam-policy-binding qa-space-secrets `
    --member="serviceAccount:${SA_EMAIL}" `
    --role="roles/secretmanager.secretAccessor" | Out-Null

Write-Host "✅ Secret создан/обновлен" -ForegroundColor Green

# Очистка
Remove-Item secrets-temp.json -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "✅ Настройка завершена!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Следующие шаги:" -ForegroundColor Cyan
Write-Host "1. Запустите миграции: .\scripts\run-migrations-gcp.ps1" -ForegroundColor White
Write-Host "2. Разверните приложение: .\scripts\deploy-gcp.ps1" -ForegroundColor White
Write-Host ""
Write-Host "📊 Полезные команды:" -ForegroundColor Cyan
Write-Host "   gcloud run services describe qa-space-backend --region=$REGION" -ForegroundColor Gray
Write-Host "   gcloud sql instances describe $DB_INSTANCE" -ForegroundColor Gray
Write-Host "   gsutil ls gs://$BUCKET_NAME" -ForegroundColor Gray

