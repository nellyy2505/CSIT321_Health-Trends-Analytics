# Health Scan: ChatGPT API Setup

The Health Scan feature uses **OpenAI’s GPT-4 Vision API** to read text from health record images and fill the My Data page. Follow these steps to enable it.

## 1. Get an OpenAI API key

1. Go to **[platform.openai.com](https://platform.openai.com)** and sign in (or create an account).
2. Open **API keys**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
3. Click **“Create new secret key”**, name it (e.g. “CareData Health Scan”), and copy the key.
4. **Store it securely.** You won’t be able to see the full key again.

You need **billing** set up on your OpenAI account for the Vision API. Add a payment method under [Billing](https://platform.openai.com/account/billing) if needed.

## 2. Configure the backend

**Local development**

1. In the `Back-End` folder, create or edit `.env`.
2. Add:
   ```env
   OPENAI_API_KEY=sk-your-actual-key-here
   ```
3. Restart the FastAPI server so it picks up the new variable.

**AWS (Lambda)**

1. In `template.yaml`, under `ApiFunction` → `Environment` → `Variables`, add:
   ```yaml
   OPENAI_API_KEY: "sk-your-key"   # Prefer AWS Secrets Manager in production
   ```
2. Or use **AWS Secrets Manager** and read the key in the Lambda at runtime (recommended for production).
3. Run `sam build` and `sam deploy` after changing the template.

## 3. Test the flow

1. Start the backend (e.g. `uvicorn app.main:app --reload` from `Back-End`).
2. Start the frontend and log in.
3. Go to **Health Scan**, upload a clear image of a health record (lab results, discharge summary, etc.).
4. Click **“Analyze health record”**.
5. You should be redirected to **My Data** with fields filled from the image. Any missing data appears as “Unknown”.

## 4. API endpoint

- **POST** `/health-scan/analyze`
- **Body:** `multipart/form-data` with one file field: `image` (JPEG, PNG, WEBP, or GIF; max 10 MB).
- **Headers:** `Authorization: Bearer <token>` (same as other protected routes).
- **Response:** JSON with `patient`, `clinical`, and `trend` objects used to populate My Data. Empty or missing values are returned as `""` so the frontend shows “Unknown”.

## 5. Troubleshooting

| Issue | What to do |
|--------|-------------|
| “OPENAI_API_KEY missing” (503) | Add `OPENAI_API_KEY` to `.env` (local) or Lambda environment (AWS) and restart/redeploy. |
| “Analysis failed” (502) | Check backend logs. Often rate limit or billing; ensure billing is set up and you have quota. |
| All fields “Unknown” | Use a clearer, high-contrast image. The model extracts only what it can read. |
| CORS errors from frontend | Backend CORS already allows the frontend origin; if using a new domain, add it to `origins` in `app/main.py`. |
