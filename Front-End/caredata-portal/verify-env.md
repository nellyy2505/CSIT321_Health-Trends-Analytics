# How to Verify .env.production is Working

## Method 1: Check Built JavaScript Files (Easiest)

1. **Build locally:**
   ```bash
   npm run build
   ```

2. **Check the built files:**
   ```bash
   # Windows PowerShell
   Select-String -Path "dist\assets\*.js" -Pattern "5f2fuubsod.execute-api"
   
   # Or manually open:
   # dist/assets/index-xxxxx.js
   # Search for: "5f2fuubsod.execute-api"
   ```

3. **If you see the API URL in the built file**, env vars are working! ✅

## Method 2: Check Netlify Deploy Logs

1. Go to: https://app.netlify.com
2. Click your site → **Deploys** tab
3. Click the latest deploy
4. Look for build output - should show Vite building with production mode
5. Check if there are any errors about missing env vars

## Method 3: Test on Deployed Site

1. Open: https://care-data-portal.netlify.app
2. Open Browser DevTools (F12)
3. Go to **Console** tab
4. Type: `import.meta.env.VITE_API_BASE_URL`
5. Should show: `"https://5f2fuubsod.execute-api.ap-southeast-2.amazonaws.com/dev"`

**OR**

1. Open **Network** tab
2. Try to login or make an API call
3. Check the request URL - should be `https://5f2fuubsod.execute-api...`
4. If it's `localhost:8000`, env vars are NOT working ❌

## Method 4: Check Git Status

```bash
cd Front-End/caredata-portal
git status
git ls-files | grep ".env.production"
```

If `.env.production` shows up, it's committed ✅

## Quick Test Checklist

- [ ] `.env.production` file exists in repo
- [ ] Built JavaScript contains AWS API URL (not localhost)
- [ ] Deployed site makes requests to AWS (check Network tab)
- [ ] No CORS errors (means API URL is correct)
- [ ] Login works on Netlify site

## Troubleshooting

**If env vars are NOT working:**

1. **Check Netlify Dashboard:**
   - Site settings → Environment variables
   - Make sure variables are set (they override .env.production)

2. **Check build command in Netlify:**
   - Site settings → Build & deploy → Build settings
   - Build command should be: `npm run build`
   - Publish directory: `dist`

3. **Redeploy:**
   - Trigger a new deploy after adding env vars
   - Netlify needs to rebuild to pick up changes
