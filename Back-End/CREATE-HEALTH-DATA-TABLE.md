# Deploy CareData Backend (Option A – full stack)

Deploy the full SAM stack so the API runs on AWS: Lambda, API Gateway, DynamoDB (Profiles + Health Data). The stack uses your **existing** Cognito User Pool (it does not create a new one).

## Prerequisites

- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) installed and configured (`aws configure`)
- [SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) installed
- An [OpenAI API key](https://platform.openai.com/api-keys) for Health Scan (Vision)
- An **existing** Cognito User Pool and App Client in the same region (create in AWS Console → Cognito if needed)

## 1. Deploy the stack

From the project root:

```bash
cd Back-End
sam build
sam deploy --guided
```

When prompted, set:

| Prompt | Example / recommendation |
|--------|---------------------------|
| **Stack name** | `caredata-api` |
| **AWS Region** | `ap-southeast-2` |
| **Parameter Stage** | `dev` |
| **Parameter OpenAIApiKey** | Your OpenAI API key |
| **Parameter CognitoUserPoolId** | Your existing pool ID (e.g. `ap-southeast-2_ZKQ8vkzTt`) |
| **Parameter CognitoAppClientId** | Your existing app client ID (e.g. `5qvt5sua0348u8quapba2hb68k`) |
| **Confirm changes before deploy** | `y` |
| **Allow SAM CLI IAM role creation** | `y` |
| **Disable rollback** | `n` |
| **Save arguments to configuration file** | `y` |

Deployment creates:

- **DynamoDB**: `CareDataProfiles-dev`, `CareDataHealthData-dev`
- **API Gateway (HTTP API)** + **Lambda** (FastAPI via Mangum)
- **Cognito**: not created; the Lambda uses the pool and client IDs you passed.

**Without pasting the API key in the terminal:** after the first `--guided` run, load the key from `.env` and redeploy:

```powershell
Get-Content .env | ForEach-Object { if ($_ -match '^\s*OPENAI_API_KEY\s*=\s*(.+)\s*$') { $env:OPENAI_API_KEY = $matches[1].Trim() } }
sam deploy --parameter-overrides "OpenAIApiKey=$env:OPENAI_API_KEY CognitoUserPoolId=ap-southeast-2_ZKQ8vkzTt CognitoAppClientId=5qvt5sua0348u8quapba2hb68k"
```

(Replace the pool ID and client ID with yours if different.)

## 2. Get stack outputs

```bash
aws cloudformation describe-stacks --stack-name caredata-api --query "Stacks[0].Outputs" --output table
```

Use **ApiUrl** for the frontend `VITE_API_BASE_URL`. **UserPoolId** and **UserPoolClientId** will match what you passed (your existing pool).

## 3. Configure frontend

In `Front-End/caredata-portal/.env` set:

- `VITE_API_BASE_URL` = your stack’s **ApiUrl** (e.g. `https://xxxx.execute-api.ap-southeast-2.amazonaws.com/dev/`)
- `VITE_USER_POOL_ID` = your existing Cognito User Pool ID
- `VITE_CLIENT_ID` = your existing Cognito App Client ID
- `VITE_REGION` = `ap-southeast-2`

Restart the frontend (`npm run dev`) after changing these.

## 4. Users

Use your **existing** Cognito pool and users. No new pool is created. Create users in AWS Console → Cognito → User pools → your pool → Create user, or via your app’s sign-up.

## Verify

- **Deployed API**: Open `ApiUrl/docs` for Swagger.
- **My Data**: Log in with a user from your pool; **PUT /mydata** should return 200.
- **Health Scan**: Test via the frontend or `/health-scan/analyze`.

---

## Option B: Create only the Health Data table (local dev only)

If you **do not** deploy the full stack and only run the API locally, you can create just the DynamoDB table so **PUT /mydata** works:

```bash
aws dynamodb create-table \
  --table-name CareDataHealthData-dev \
  --attribute-definitions AttributeName=sub,AttributeType=S \
  --key-schema AttributeName=sub,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-southeast-2
```

Optional in `Back-End/.env`: `HEALTH_DATA_TABLE_NAME=CareDataHealthData-dev` (backend defaults to this name if unset).
