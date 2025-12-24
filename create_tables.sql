-- SQL скрипт для создания всех таблиц базы данных QA Space
-- PostgreSQL

-- ВНИМАНИЕ: Этот скрипт удалит все существующие таблицы перед созданием новых!
-- Если вы хотите сохранить данные, закомментируйте блок DROP TABLE ниже

-- Удаление триггеров (если существуют)
DROP TRIGGER IF EXISTS update_rolepermissionset_updated_at ON "RolePermissionSet";
DROP TRIGGER IF EXISTS update_doctemplate_updated_at ON "DocTemplate";
DROP TRIGGER IF EXISTS update_docreviewworkflow_updated_at ON "DocReviewWorkflow";
DROP TRIGGER IF EXISTS update_doc_updated_at ON "Doc";
DROP TRIGGER IF EXISTS update_docfolder_updated_at ON "DocFolder";
DROP TRIGGER IF EXISTS update_testrunitem_updated_at ON "TestRunItem";
DROP TRIGGER IF EXISTS update_testrun_updated_at ON "TestRun";
DROP TRIGGER IF EXISTS update_testcase_updated_at ON "TestCase";
DROP TRIGGER IF EXISTS update_suite_updated_at ON "Suite";
DROP TRIGGER IF EXISTS update_user_updated_at ON "User";

-- Удаление функции (если существует)
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Удаление таблиц в обратном порядке зависимостей
DROP TABLE IF EXISTS "RolePermissionSet" CASCADE;
DROP TABLE IF EXISTS "DocAttachment" CASCADE;
DROP TABLE IF EXISTS "DocTemplate" CASCADE;
DROP TABLE IF EXISTS "DocComment" CASCADE;
DROP TABLE IF EXISTS "DocLink" CASCADE;
DROP TABLE IF EXISTS "DocReviewAction" CASCADE;
DROP TABLE IF EXISTS "DocReviewWorkflow" CASCADE;
DROP TABLE IF EXISTS "DocVersion" CASCADE;
DROP TABLE IF EXISTS "Doc" CASCADE;
DROP TABLE IF EXISTS "DocFolder" CASCADE;
DROP TABLE IF EXISTS "FileAsset" CASCADE;
DROP TABLE IF EXISTS "Attachment" CASCADE;
DROP TABLE IF EXISTS "TestRunItem" CASCADE;
DROP TABLE IF EXISTS "TestRun" CASCADE;
DROP TABLE IF EXISTS "TestStep" CASCADE;
DROP TABLE IF EXISTS "TestCase" CASCADE;
DROP TABLE IF EXISTS "Suite" CASCADE;
DROP TABLE IF EXISTS "ProjectRole" CASCADE;
DROP TABLE IF EXISTS "Project" CASCADE;
DROP TABLE IF EXISTS "WorkspaceMember" CASCADE;
DROP TABLE IF EXISTS "Workspace" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;

-- 1. Таблица пользователей
CREATE TABLE "User" (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "refreshToken" VARCHAR(255),
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Таблица рабочих пространств
CREATE TABLE "Workspace" (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL
);

-- 3. Таблица участников workspace
CREATE TABLE "WorkspaceMember" (
    id SERIAL PRIMARY KEY,
    "workspaceId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    role VARCHAR(255) NOT NULL,
    "customPermissions" TEXT[],
    UNIQUE ("workspaceId", "userId"),
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id) ON DELETE CASCADE,
    FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE INDEX "WorkspaceMember_workspaceId_idx" ON "WorkspaceMember"("workspaceId");

-- 4. Таблица проектов
CREATE TABLE "Project" (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id) ON DELETE CASCADE
);

CREATE INDEX "Project_workspaceId_idx" ON "Project"("workspaceId");

-- 5. Таблица ролей в проектах
CREATE TABLE "ProjectRole" (
    id SERIAL PRIMARY KEY,
    "projectId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    role VARCHAR(255) NOT NULL,
    "customPermissions" TEXT[],
    UNIQUE ("projectId", "userId"),
    FOREIGN KEY ("projectId") REFERENCES "Project"(id) ON DELETE CASCADE,
    FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE INDEX "ProjectRole_projectId_idx" ON "ProjectRole"("projectId");
CREATE INDEX "ProjectRole_userId_idx" ON "ProjectRole"("userId");

-- 6. Таблица наборов тестов (Suite)
CREATE TABLE "Suite" (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "projectId" INTEGER NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("projectId") REFERENCES "Project"(id) ON DELETE CASCADE,
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id) ON DELETE CASCADE,
    FOREIGN KEY ("parentId") REFERENCES "Suite"(id) ON DELETE SET NULL
);

CREATE INDEX "Suite_projectId_idx" ON "Suite"("projectId");
CREATE INDEX "Suite_workspaceId_idx" ON "Suite"("workspaceId");
CREATE INDEX "Suite_parentId_idx" ON "Suite"("parentId");

-- 7. Таблица тест-кейсов
CREATE TABLE "TestCase" (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL DEFAULT 'draft',
    priority VARCHAR(255) NOT NULL DEFAULT 'medium',
    tags TEXT[],
    version INTEGER NOT NULL DEFAULT 1,
    "projectId" INTEGER NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "suiteId" INTEGER,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("projectId", key),
    FOREIGN KEY ("projectId") REFERENCES "Project"(id) ON DELETE CASCADE,
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id) ON DELETE CASCADE,
    FOREIGN KEY ("suiteId") REFERENCES "Suite"(id) ON DELETE SET NULL
);

CREATE INDEX "TestCase_workspaceId_idx" ON "TestCase"("workspaceId");
CREATE INDEX "TestCase_suiteId_idx" ON "TestCase"("suiteId");

-- 8. Таблица шагов тест-кейсов
CREATE TABLE "TestStep" (
    id SERIAL PRIMARY KEY,
    "order" INTEGER NOT NULL DEFAULT 0,
    action TEXT NOT NULL,
    expected TEXT NOT NULL,
    "testCaseId" INTEGER NOT NULL,
    FOREIGN KEY ("testCaseId") REFERENCES "TestCase"(id) ON DELETE CASCADE
);

-- 9. Таблица прогонов тестов
CREATE TABLE "TestRun" (
    id SERIAL PRIMARY KEY,
    "projectId" INTEGER NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    build VARCHAR(255) NOT NULL,
    env VARCHAR(255) NOT NULL,
    platform VARCHAR(255) NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("projectId") REFERENCES "Project"(id) ON DELETE CASCADE,
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id) ON DELETE CASCADE,
    FOREIGN KEY ("createdById") REFERENCES "User"(id) ON DELETE RESTRICT
);

CREATE INDEX "TestRun_projectId_idx" ON "TestRun"("projectId");
CREATE INDEX "TestRun_workspaceId_idx" ON "TestRun"("workspaceId");
CREATE INDEX "TestRun_createdById_idx" ON "TestRun"("createdById");

-- 10. Таблица элементов прогона тестов
CREATE TABLE "TestRunItem" (
    id SERIAL PRIMARY KEY,
    "testRunId" INTEGER NOT NULL,
    "testCaseId" INTEGER NOT NULL,
    "snapshotTitle" VARCHAR(255) NOT NULL,
    "snapshotPriority" VARCHAR(255) NOT NULL,
    result VARCHAR(255),
    "executedById" INTEGER,
    "executedAt" TIMESTAMP,
    comments TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("testRunId") REFERENCES "TestRun"(id) ON DELETE CASCADE,
    FOREIGN KEY ("testCaseId") REFERENCES "TestCase"(id) ON DELETE CASCADE,
    FOREIGN KEY ("executedById") REFERENCES "User"(id) ON DELETE SET NULL
);

CREATE INDEX "TestRunItem_testRunId_idx" ON "TestRunItem"("testRunId");
CREATE INDEX "TestRunItem_testCaseId_idx" ON "TestRunItem"("testCaseId");
CREATE INDEX "TestRunItem_executedById_idx" ON "TestRunItem"("executedById");

-- 11. Таблица вложений
CREATE TABLE "Attachment" (
    id SERIAL PRIMARY KEY,
    "entityType" VARCHAR(255) NOT NULL,
    "entityId" INTEGER NOT NULL,
    "fileUrl" VARCHAR(255) NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "fileSize" INTEGER,
    "mimeType" VARCHAR(255),
    "uploadedById" INTEGER NOT NULL,
    "testRunItemId" INTEGER,
    "uploadedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("uploadedById") REFERENCES "User"(id) ON DELETE RESTRICT,
    FOREIGN KEY ("testRunItemId") REFERENCES "TestRunItem"(id) ON DELETE CASCADE
);

CREATE INDEX "Attachment_entityType_entityId_idx" ON "Attachment"("entityType", "entityId");
CREATE INDEX "Attachment_uploadedById_idx" ON "Attachment"("uploadedById");
CREATE INDEX "Attachment_testRunItemId_idx" ON "Attachment"("testRunItemId");

-- 12. Таблица файловых ресурсов
CREATE TABLE "FileAsset" (
    id SERIAL PRIMARY KEY,
    "workspaceId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    provider VARCHAR(255) NOT NULL,
    bucket VARCHAR(255) NOT NULL,
    key VARCHAR(255) NOT NULL,
    "fileName" VARCHAR(255),
    "mimeType" VARCHAR(255),
    "sizeBytes" INTEGER,
    sha256 VARCHAR(255),
    "previewKey" VARCHAR(255),
    "sourceUrl" VARCHAR(255),
    "expiresAt" TIMESTAMP,
    "uploadedById" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id) ON DELETE CASCADE,
    FOREIGN KEY ("projectId") REFERENCES "Project"(id) ON DELETE CASCADE,
    FOREIGN KEY ("uploadedById") REFERENCES "User"(id) ON DELETE RESTRICT
);

CREATE INDEX "FileAsset_workspaceId_idx" ON "FileAsset"("workspaceId");
CREATE INDEX "FileAsset_projectId_idx" ON "FileAsset"("projectId");
CREATE INDEX "FileAsset_provider_key_idx" ON "FileAsset"("provider", "key");
CREATE INDEX "FileAsset_uploadedById_idx" ON "FileAsset"("uploadedById");

-- 13. Таблица папок документов
CREATE TABLE "DocFolder" (
    id SERIAL PRIMARY KEY,
    "workspaceId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "parentId" INTEGER,
    name VARCHAR(255) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id) ON DELETE CASCADE,
    FOREIGN KEY ("projectId") REFERENCES "Project"(id) ON DELETE CASCADE,
    FOREIGN KEY ("parentId") REFERENCES "DocFolder"(id) ON DELETE SET NULL
);

CREATE INDEX "DocFolder_workspaceId_idx" ON "DocFolder"("workspaceId");
CREATE INDEX "DocFolder_projectId_idx" ON "DocFolder"("projectId");
CREATE INDEX "DocFolder_parentId_idx" ON "DocFolder"("parentId");

-- 14. Таблица документов
CREATE TABLE "Doc" (
    id SERIAL PRIMARY KEY,
    "workspaceId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "folderId" INTEGER,
    "parentId" INTEGER,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL DEFAULT 'other',
    status VARCHAR(255) NOT NULL DEFAULT 'draft',
    content TEXT NOT NULL,
    tags TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    "createdById" INTEGER NOT NULL,
    "updatedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP,
    "archivedAt" TIMESTAMP,
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id) ON DELETE CASCADE,
    FOREIGN KEY ("projectId") REFERENCES "Project"(id) ON DELETE CASCADE,
    FOREIGN KEY ("folderId") REFERENCES "DocFolder"(id) ON DELETE SET NULL,
    FOREIGN KEY ("parentId") REFERENCES "Doc"(id) ON DELETE SET NULL,
    FOREIGN KEY ("createdById") REFERENCES "User"(id) ON DELETE RESTRICT,
    FOREIGN KEY ("updatedById") REFERENCES "User"(id) ON DELETE RESTRICT
);

CREATE INDEX "Doc_workspaceId_idx" ON "Doc"("workspaceId");
CREATE INDEX "Doc_projectId_idx" ON "Doc"("projectId");
CREATE INDEX "Doc_folderId_idx" ON "Doc"("folderId");
CREATE INDEX "Doc_parentId_idx" ON "Doc"("parentId");
CREATE INDEX "Doc_type_idx" ON "Doc"("type");
CREATE INDEX "Doc_status_idx" ON "Doc"("status");

-- 15. Таблица версий документов
CREATE TABLE "DocVersion" (
    id SERIAL PRIMARY KEY,
    "docId" INTEGER NOT NULL,
    version INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeNote" TEXT,
    FOREIGN KEY ("docId") REFERENCES "Doc"(id) ON DELETE CASCADE,
    FOREIGN KEY ("createdById") REFERENCES "User"(id) ON DELETE RESTRICT
);

CREATE INDEX "DocVersion_docId_idx" ON "DocVersion"("docId");
CREATE INDEX "DocVersion_version_idx" ON "DocVersion"("version");

-- 16. Таблица workflow ревью документов
CREATE TABLE "DocReviewWorkflow" (
    id SERIAL PRIMARY KEY,
    "docId" INTEGER NOT NULL UNIQUE,
    "requestedById" INTEGER NOT NULL,
    reviewers INTEGER[],
    state VARCHAR(255) NOT NULL DEFAULT 'pending',
    "decidedById" INTEGER,
    "decidedAt" TIMESTAMP,
    note TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("docId") REFERENCES "Doc"(id) ON DELETE CASCADE,
    FOREIGN KEY ("requestedById") REFERENCES "User"(id) ON DELETE RESTRICT,
    FOREIGN KEY ("decidedById") REFERENCES "User"(id) ON DELETE SET NULL
);

CREATE INDEX "DocReviewWorkflow_docId_idx" ON "DocReviewWorkflow"("docId");
CREATE INDEX "DocReviewWorkflow_requestedById_idx" ON "DocReviewWorkflow"("requestedById");
CREATE INDEX "DocReviewWorkflow_decidedById_idx" ON "DocReviewWorkflow"("decidedById");

-- 17. Таблица действий в ревью документов
CREATE TABLE "DocReviewAction" (
    id SERIAL PRIMARY KEY,
    "workflowId" INTEGER NOT NULL,
    action VARCHAR(255) NOT NULL,
    note TEXT,
    "actorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("workflowId") REFERENCES "DocReviewWorkflow"(id) ON DELETE CASCADE,
    FOREIGN KEY ("actorId") REFERENCES "User"(id) ON DELETE RESTRICT
);

CREATE INDEX "DocReviewAction_workflowId_idx" ON "DocReviewAction"("workflowId");
CREATE INDEX "DocReviewAction_actorId_idx" ON "DocReviewAction"("actorId");

-- 18. Таблица ссылок из документов
CREATE TABLE "DocLink" (
    id SERIAL PRIMARY KEY,
    "docId" INTEGER NOT NULL,
    "entityType" VARCHAR(255) NOT NULL,
    "entityId" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("docId") REFERENCES "Doc"(id) ON DELETE CASCADE
);

CREATE INDEX "DocLink_docId_idx" ON "DocLink"("docId");
CREATE INDEX "DocLink_entityType_idx" ON "DocLink"("entityType");

-- 19. Таблица комментариев к документам
CREATE TABLE "DocComment" (
    id SERIAL PRIMARY KEY,
    "docId" INTEGER NOT NULL,
    version INTEGER,
    anchor VARCHAR(255),
    message TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP,
    "resolvedById" INTEGER,
    FOREIGN KEY ("docId") REFERENCES "Doc"(id) ON DELETE CASCADE,
    FOREIGN KEY ("createdById") REFERENCES "User"(id) ON DELETE RESTRICT,
    FOREIGN KEY ("resolvedById") REFERENCES "User"(id) ON DELETE SET NULL
);

CREATE INDEX "DocComment_docId_idx" ON "DocComment"("docId");
CREATE INDEX "DocComment_createdById_idx" ON "DocComment"("createdById");
CREATE INDEX "DocComment_resolvedById_idx" ON "DocComment"("resolvedById");

-- 20. Таблица шаблонов документов
CREATE TABLE "DocTemplate" (
    id SERIAL PRIMARY KEY,
    "workspaceId" INTEGER NOT NULL,
    "projectId" INTEGER,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL DEFAULT 'doc',
    content TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id) ON DELETE CASCADE,
    FOREIGN KEY ("projectId") REFERENCES "Project"(id) ON DELETE SET NULL,
    FOREIGN KEY ("createdById") REFERENCES "User"(id) ON DELETE RESTRICT
);

CREATE INDEX "DocTemplate_workspaceId_idx" ON "DocTemplate"("workspaceId");
CREATE INDEX "DocTemplate_projectId_idx" ON "DocTemplate"("projectId");
CREATE INDEX "DocTemplate_type_idx" ON "DocTemplate"("type");

-- 21. Таблица вложений к документам
CREATE TABLE "DocAttachment" (
    id SERIAL PRIMARY KEY,
    "docId" INTEGER NOT NULL,
    "fileAssetId" INTEGER NOT NULL,
    caption TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("docId") REFERENCES "Doc"(id) ON DELETE CASCADE,
    FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"(id) ON DELETE CASCADE
);

CREATE INDEX "DocAttachment_docId_idx" ON "DocAttachment"("docId");
CREATE INDEX "DocAttachment_fileAssetId_idx" ON "DocAttachment"("fileAssetId");

-- 22. Таблица наборов прав для ролей
CREATE TABLE "RolePermissionSet" (
    id SERIAL PRIMARY KEY,
    "workspaceId" INTEGER NOT NULL,
    role VARCHAR(255) NOT NULL,
    permissions TEXT[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("workspaceId", role),
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"(id) ON DELETE CASCADE
);

CREATE INDEX "RolePermissionSet_workspaceId_idx" ON "RolePermissionSet"("workspaceId");

-- Создание функции для автоматического обновления updatedAt
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггеры для автоматического обновления updatedAt
CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON "User"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suite_updated_at BEFORE UPDATE ON "Suite"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_testcase_updated_at BEFORE UPDATE ON "TestCase"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_testrun_updated_at BEFORE UPDATE ON "TestRun"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_testrunitem_updated_at BEFORE UPDATE ON "TestRunItem"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_docfolder_updated_at BEFORE UPDATE ON "DocFolder"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_doc_updated_at BEFORE UPDATE ON "Doc"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_docreviewworkflow_updated_at BEFORE UPDATE ON "DocReviewWorkflow"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_doctemplate_updated_at BEFORE UPDATE ON "DocTemplate"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rolepermissionset_updated_at BEFORE UPDATE ON "RolePermissionSet"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

