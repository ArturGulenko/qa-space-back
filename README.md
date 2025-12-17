# QA Space Backend (NestJS) - Bootstrap

This repo contains a minimal NestJS backend with multi-tenant primitives, Prisma, Postgres, MinIO (optional), JWT auth (access + refresh), workspace/project entities, and RBAC guards.

Quick start (local):

1) Copy `.env.example` to `.env` and adjust values if needed.
2) Start Postgres + MinIO + app (dev watch) via Docker:

   docker-compose up --build

3) Inside the `app` container or locally, run migrations & seed if needed:

   yarn prisma:generate
   yarn prisma:migrate
   yarn prisma:seed

Seeded user: `admin@local` / password: `password` (be sure to change in dev).

API quick notes:

- POST /api/auth/login { email, password }  -> { accessToken, refreshToken }
- POST /api/auth/refresh { userId, refreshToken } -> { accessToken, refreshToken }
- GET /api/auth/me (Bearer <accessToken>) -> current user

- GET /api/workspaces (Bearer) -> list of workspaces the user is member of
- POST /api/workspaces (Bearer) {name, slug} -> create workspace; creator becomes owner
- GET /api/workspaces/:id/projects (Bearer) -> projects in workspace (member required)
- POST /api/workspaces/:id/projects (Bearer, roles owner|admin) -> create project

Notes:
- Basic RBAC guards are implemented (WorkspaceMemberGuard, RolesGuard)
- Prisma schema is in `prisma/schema.prisma` and seed script is `prisma/seed.ts`

Next steps:
- Add proper validation, tests, and expand RBAC checks
- Implement invitation flow and refresh-token rotation
