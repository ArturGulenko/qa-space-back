# QA Space Backend (NestJS)

Backend приложение для QA Space с multi-tenant архитектурой, Prisma, PostgreSQL, JWT аутентификацией, workspace/project сущностями и RBAC guards.

## 🚀 Быстрый старт

### Локальная разработка

1) Скопируйте `.env.example` в `.env` и настройте значения при необходимости.

2) Запустите Postgres + MinIO + приложение через Docker:

   ```bash
   docker-compose up --build
   ```

3) Внутри контейнера `app` или локально, запустите миграции и seed:

   ```bash
   yarn prisma:generate
   yarn prisma:migrate
   yarn prisma:seed
   ```

Пользователь по умолчанию: `admin@local` / пароль: `password` (обязательно измените в dev).

### Развертывание на GCP

Для развертывания на Google Cloud Platform см. [GCP_DEPLOYMENT.md](./GCP_DEPLOYMENT.md) или [scripts/QUICK_START_GCP.md](./scripts/QUICK_START_GCP.md).

**Быстрый старт:**
```bash
# 1. Настройка ресурсов
./scripts/setup-gcp.sh your-project-id us-central1

# 2. Запуск миграций
./scripts/run-migrations-gcp.sh your-project-id us-central1

# 3. Развертывание
./scripts/deploy-gcp.sh your-project-id us-central1
```

## 📡 API Endpoints

- `POST /api/auth/login` { email, password } → { accessToken, refreshToken }
- `POST /api/auth/refresh` { userId, refreshToken } → { accessToken, refreshToken }
- `GET /api/auth/me` (Bearer <accessToken>) → текущий пользователь

- `GET /api/workspaces` (Bearer) → список workspace, в которых пользователь является участником
- `POST /api/workspaces` (Bearer) {name, slug} → создать workspace; создатель становится владельцем
- `GET /api/workspaces/:id/projects` (Bearer) → проекты в workspace (требуется членство)
- `POST /api/workspaces/:id/projects` (Bearer, roles owner|admin) → создать проект

## 📝 Примечания

- Реализованы базовые RBAC guards (WorkspaceMemberGuard, RolesGuard)
- Prisma schema находится в `prisma/schema.prisma`, seed script в `prisma/seed.ts`
- Поддержка S3-совместимого хранилища (GCS, MinIO, S3)

## 📚 Документация

- [Развертывание на GCP](./GCP_DEPLOYMENT.md) - полное руководство
- [Быстрый старт GCP](./scripts/QUICK_START_GCP.md) - краткая инструкция
- [Скрипты](./scripts/README.md) - описание доступных скриптов

## 🔄 Следующие шаги

- Добавить валидацию, тесты и расширить RBAC проверки
- Реализовать flow приглашений и ротацию refresh-токенов
