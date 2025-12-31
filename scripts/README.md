# Scripts for GCP Deployment

Scripts for automating the deployment process to Google Cloud Platform.

## 📋 Requirements

- Google Cloud SDK (gcloud) installed and configured
- Execution permissions: `chmod +x scripts/*.sh`
- GCP authorization: `gcloud auth login`

## 🚀 GCP Scripts

### `setup-gcp.sh`
Creates all necessary GCP resources:
- Cloud SQL PostgreSQL instance
- GCS bucket for files
- Service Accounts with required permissions
- Secret Manager secrets

**Usage:**
```bash
./scripts/setup-gcp.sh PROJECT_ID [REGION]
# или
export GOOGLE_CLOUD_PROJECT=your-project-id
./scripts/setup-gcp.sh
```

### `run-migrations-gcp.sh`
Runs Prisma migrations on Cloud Run Job.

**Usage:**
```bash
./scripts/run-migrations-gcp.sh PROJECT_ID [REGION]
```

### `deploy-gcp.sh`
Deploys the application to Cloud Run.

**Usage:**
```bash
./scripts/deploy-gcp.sh PROJECT_ID [REGION] [IMAGE_TAG]
```

## 🔄 Typical GCP Workflow

```bash
# 1. Set up GCP resources (one time)
./scripts/setup-gcp.sh your-project-id us-central1

# 2. Run migrations
./scripts/run-migrations-gcp.sh your-project-id us-central1

# 3. Deploy application
./scripts/deploy-gcp.sh your-project-id us-central1

# 4. Update application (when changes occur)
./scripts/deploy-gcp.sh your-project-id us-central1 latest
```

## 📝 Local Scripts

### `add-superadmin.ts`
Creates a super administrator in the system.

**Usage:**
```bash
npm run add-superadmin
```

### `create-superadmin.ts`
Alternative script for creating a super administrator.

**Usage:**
```bash
npm run create-superadmin
```

## 📚 Additional Documentation

Full deployment guide: `../GCP_DEPLOYMENT.md`
