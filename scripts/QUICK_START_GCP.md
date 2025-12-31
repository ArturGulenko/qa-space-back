# 🚀 Quick Start: Deployment to GCP

## Step 1: Installation and Setup

```bash
# Install Google Cloud SDK (if not already installed)
# https://cloud.google.com/sdk/docs/install

# Authenticate
gcloud auth login
gcloud auth application-default login

# Set the project
export GOOGLE_CLOUD_PROJECT="your-project-id"
gcloud config set project $GOOGLE_CLOUD_PROJECT
```

## Step 2: Create Resources

```bash
# Make scripts executable (Linux/Mac)
chmod +x scripts/*.sh

# Run setup (will create all resources)
./scripts/setup-gcp.sh $GOOGLE_CLOUD_PROJECT us-central1
```

**Important:** Save the passwords and keys that will be shown!

## Step 3: Run Migrations

```bash
./scripts/run-migrations-gcp.sh $GOOGLE_CLOUD_PROJECT us-central1
```

## Step 4: Deploy

```bash
./scripts/deploy-gcp.sh $GOOGLE_CLOUD_PROJECT us-central1
```

After deployment, you will receive the URL of your application.

## Verification

```bash
# Get service URL
gcloud run services describe qa-space-backend --region=us-central1 --format="value(status.url)"

# Check health endpoint
curl https://YOUR-SERVICE-URL/health
```

## What's Next?

- Update frontend with new backend URL
- Configure domain (optional)
- Set up monitoring and alerts

Full documentation: `../GCP_DEPLOYMENT.md`



