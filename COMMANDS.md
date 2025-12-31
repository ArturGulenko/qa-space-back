# 🚀 Команды для работы с проектом

## 📋 Быстрые команды

### Запуск миграций базы данных

**Вариант 1: PowerShell скрипт (рекомендуется для Windows)**
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-migrations-gcp.ps1 qa-space-482211 us-central1
```

**Вариант 2: Bash скрипт (если используете Git Bash или WSL)**
```bash
./scripts/run-migrations-gcp.sh qa-space-482211 us-central1
```

**Вариант 3: Через Cloud Build**
```powershell
gcloud builds submit --config=cloudbuild.migrations.yaml .
```

### Деплой на прод (Cloud Run)

**Вариант 1: PowerShell скрипт (рекомендуется для Windows)**
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-gcp.ps1 qa-space-482211 us-central1 latest
```

**Вариант 2: Bash скрипт (если используете Git Bash или WSL)**
```bash
./scripts/deploy-gcp.sh qa-space-482211 us-central1 latest
```

**Вариант 3: Через npm скрипт (с автоматическим PROJECT_ID)**
```powershell
npm run deploy:gcp
```


**Вариант 4: Через Cloud Build**
```powershell
gcloud builds submit --config=cloudbuild.yaml .
```

## 🔧 Дополнительные команды

### Проверка статуса миграций
```powershell
gcloud run jobs executions list --job=qa-space-migrations --region=us-central1 --limit=1
```

### Просмотр логов миграций
```powershell
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=qa-space-migrations" --limit=50
```

### Проверка статуса Cloud Run сервиса
```powershell
gcloud run services describe qa-space-backend --region=us-central1
```

### Просмотр логов приложения
```powershell
gcloud run services logs read qa-space-backend --region=us-central1 --limit=50
```

### Просмотр логов в реальном времени
```powershell
gcloud run services logs tail qa-space-backend --region=us-central1
```

### Просмотр последних логов с ошибками
```powershell
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=qa-space-backend" --limit=100 --format=json --order=desc
```

### Просмотр логов конкретной ревизии
```powershell
gcloud run services logs read qa-space-backend --region=us-central1 --revision=qa-space-backend-00017-k95
```

## 🔍 Troubleshooting

### Ошибка: "The user-provided container failed to start and listen on the port"

Эта ошибка означает, что приложение не успело запуститься в течение таймаута. Возможные причины:

1. **Проблема с подключением к базе данных**
   - Проверьте, что Cloud SQL инстанс запущен:
   ```powershell
   gcloud sql instances describe qa-space-db
   ```
   - Проверьте логи для деталей ошибки подключения

2. **Prisma Client не сгенерирован**
   - Убедитесь, что миграции выполнены успешно
   - Проверьте, что Prisma Client сгенерирован в образе

3. **Недостаточно времени на запуск**
   - Cloud Run по умолчанию дает 240 секунд на запуск
   - Можно увеличить timeout в скрипте деплоя

4. **Проблема с переменными окружения**
   - Проверьте, что все секреты правильно установлены:
   ```powershell
   gcloud run services describe qa-space-backend --region=us-central1 --format="value(spec.template.spec.containers[0].env)"
   ```

### Просмотр детальных логов для диагностики

```powershell
# Последние 100 строк логов
gcloud run services logs read qa-space-backend --region=us-central1 --limit=100

# Логи в реальном времени
gcloud run services logs tail qa-space-backend --region=us-central1

# Логи с фильтром по ошибкам
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=qa-space-backend AND severity>=ERROR" --limit=50
```

## 📝 Примечания

1. **PROJECT_ID** - замените `YOUR_PROJECT_ID` на ваш реальный Google Cloud Project ID
2. **REGION** - по умолчанию используется `us-central1`, можно указать другой регион
3. **IMAGE_TAG** - по умолчанию используется `latest`, можно указать конкретную версию

## ⚙️ Переменные окружения

Можно установить переменную окружения для PROJECT_ID, чтобы не указывать её каждый раз:

```powershell
$env:GOOGLE_CLOUD_PROJECT = "qa-space-482211"
```

Тогда команды можно запускать без указания PROJECT_ID:
```powershell
.\scripts\run-migrations-gcp.ps1
.\scripts\deploy-gcp.ps1
```


