# Migration: Register/Login from AWS to Azure

This document describes how register/login was moved from **AWS (Cognito + DynamoDB)** to **Azure (JWT + Azure Table Storage)** and how to run the app.

## Summary of changes

| Area | Before (AWS) | After (Azure) |
|------|----------------|----------------|
| **Auth** | AWS Cognito (Hosted UI, Amplify) | Backend JWT (register/login API) |
| **User store** | DynamoDB (CareDataProfiles) | Azure Table Storage table `users` or in-memory (dev) |
| **My Data / Health data** | DynamoDB | Azure Table Storage tables `healthdata`, `scanhistory`, `uploadhistory`, `carejourney` |
| **Frontend auth** | aws-amplify, cognitoAuth.js, amplify.js | API calls to `/auth/register`, `/auth/login`, Bearer token |
| **Backend deployment** | AWS Lambda (SAM) | FastAPI on Azure App Service / any host |

## Steps to run locally (no Azure account)

1. **Backend**
   - `cd Backend`
   - Create `.env` with at least:
     - `SECRET_KEY=<random-secret-for-jwt>`
     - `OPENAI_API_KEY=<your-key>` (optional; for Health Scan)
   - Leave `AZURE_STORAGE_CONNECTION_STRING` unset to use **in-memory** user and data stores.
   - `pip install -r requirements.txt`
   - `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`

2. **Frontend**
   - `cd Frontend`
   - Create `.env` with `VITE_API_BASE_URL=http://127.0.0.1:8000` (or leave default).
   - For Google sign-in, set `VITE_GOOGLE_CLIENT_ID=<your-google-oauth-client-id>`.
   - `npm install && npm run dev`

3. **Register / Login**
   - Use **Sign Up** to create an account (email + password). No email verification by default.
   - Use **Sign In** with the same credentials. You receive a JWT; the frontend stores it and sends it as `Authorization: Bearer <token>`.

## Steps to use Azure Table Storage

1. Create an **Azure Storage Account** (e.g. in Azure Portal).
2. Get the **connection string** (Storage account → Access keys → Connection string).
3. Set in Backend `.env`:
   - `AZURE_STORAGE_CONNECTION_STRING=<your-connection-string>`
4. On first use, the backend creates these tables if they do not exist:
   - `users` – user accounts (register/login)
   - `healthdata` – My Data per user
   - `scanhistory` – Health Scan history
   - `uploadhistory` – CSV upload history
   - `carejourney` – Care journey data

## Steps to deploy backend to Azure

1. **Azure App Service**
   - Create a Web App (e.g. Python 3.10).
   - Set application settings (env vars): `SECRET_KEY`, `OPENAI_API_KEY`, `AZURE_STORAGE_CONNECTION_STRING`.
   - Deploy the Backend folder (e.g. via GitHub Actions, Azure DevOps, or `az webapp up`).

2. **CORS**
   - In `Backend/app/main.py`, add your frontend origin (e.g. `https://your-app.azurestaticapps.net`) to `origins`.

3. **Frontend**
   - Set `VITE_API_BASE_URL` to your backend URL (e.g. `https://your-api.azurewebsites.net`).

## Removed / deleted

- **Backend:** `app/services/cognito_auth.py`, `app/services/dynamodb_profile.py`; Lambda/Mangum handler; `boto3`, `mangum` from requirements.
- **Frontend:** `src/config/amplify.js`, `src/services/cognitoAuth.js`, `src/components/common/OAuthErrorBanner.jsx`; all `aws-amplify` usage and Cognito branches in `LoginPage.jsx` and `RegisterPage.jsx`.

## Frontend theme

- All existing UI (orange theme, layout, Navbar, Footer, Login/Register panels) is unchanged. Only the auth provider and API calls were switched from AWS to the new backend auth.
