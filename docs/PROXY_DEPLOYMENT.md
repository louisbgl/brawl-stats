# Proxy Deployment Guide

Step-by-step guide to deploy the Brawl Stars API proxy with a static IP.

## Why Do We Need This?

The Brawl Stars API requires IP whitelisting. GitHub Actions uses dynamic IPs, so we deploy a tiny proxy service with a static IP that forwards our requests.

## Step 1: Deploy to Railway.app

### 1.1 Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub (easiest)
3. Verify your email

### 1.2 Deploy the Proxy
1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Authorize Railway to access your GitHub
4. Select the **`brawl-stats`** repository
5. Railway will auto-detect it's a Python app

### 1.3 Configure Root Directory
Railway needs to know to use the `/proxy` folder:

1. Go to your project settings
2. Find **"Root Directory"** setting
3. Set it to: `proxy`
4. Click **"Save"**

### 1.4 Add Environment Variable
1. In your Railway project, go to **"Variables"** tab
2. Click **"New Variable"**
3. Add:
   - **Key**: `BRAWL_STARS_API_TOKEN`
   - **Value**: Your Brawl Stars API token (from https://developer.brawlstars.com)
4. Click **"Add"**

### 1.5 Deploy
1. Railway should auto-deploy after adding the variable
2. Wait ~2 minutes for build to complete
3. You'll see a public URL like: `https://brawl-stats-production.up.railway.app`

## Step 2: Get the Static IP

### Method 1: Check Railway Dashboard
1. Go to your project **"Settings"**
2. Look for **"Networking"** or **"Outbound IP"**
3. Copy the static IP address

### Method 2: Make a Test Request
```bash
# Make a request and check Railway logs for outbound IP
curl https://your-app.up.railway.app/health
```

Check the Railway logs - the first API request will show the outbound IP being used.

## Step 3: Whitelist IP in Brawl Stars

1. Go to https://developer.brawlstars.com
2. **Create a NEW API key** (don't reuse your local one)
3. When asked for IP addresses, enter the Railway static IP
4. Copy the new token
5. **Update the Railway environment variable** with this new token:
   - Go to Railway → Variables
   - Edit `BRAWL_STARS_API_TOKEN`
   - Paste the new token
   - Save (will auto-redeploy)

## Step 4: Test the Proxy

```bash
# Health check
curl https://your-app.up.railway.app/health

# Test with a player tag (replace with yours)
curl https://your-app.up.railway.app/players/%23LLJGJQVY
```

You should see JSON data back! If you get an error about IP, double-check:
- The IP you whitelisted matches Railway's outbound IP
- The token in Railway variables is the NEW token (not your local one)

## Step 5: Update Local .env

Add the proxy URL to your `.env`:

```bash
# Comment out or remove direct token
# BRAWL_STARS_API_TOKEN=your_local_token

# Add proxy URL
BRAWL_STARS_PROXY_URL=https://your-app.up.railway.app
```

## Step 6: Test Locally

```bash
uv run collect_data.py
```

Should work! Your local script now uses the proxy instead of direct API.

## Step 7: Update GitHub Actions

Update the secret in GitHub:

1. Go to GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Delete `BRAWL_STARS_API_TOKEN` (if it exists)
3. Add new secret:
   - Name: `BRAWL_STARS_PROXY_URL`
   - Value: `https://your-app.up.railway.app`

## Step 8: Update Workflow

The workflow needs to use the proxy URL instead of token:

1. Edit `.github/workflows/collect-data.yml`
2. Change the env section from:
   ```yaml
   env:
     BRAWL_STARS_API_TOKEN: ${{ secrets.BRAWL_STARS_API_TOKEN }}
   ```
   to:
   ```yaml
   env:
     BRAWL_STARS_PROXY_URL: ${{ secrets.BRAWL_STARS_PROXY_URL }}
   ```

## Step 9: Test GitHub Actions

1. Go to **Actions** tab in GitHub
2. Select **"Collect Brawl Stars Data"**
3. Click **"Run workflow"**
4. Wait for it to complete
5. Should succeed! ✅

## Troubleshooting

### "API call failed: 403"
- IP mismatch: Railway's outbound IP changed or wasn't whitelisted correctly
- Check Railway logs for the actual IP being used
- Update the API key with correct IP

### "Proxy request failed"
- The proxy can't reach Brawl Stars API
- Check Railway logs for details
- Verify the token is valid

### Workflow still fails
- Make sure you updated the workflow file
- Verify the secret name matches exactly: `BRAWL_STARS_PROXY_URL`
- Check Railway is running (not paused/sleeping)

## Cost

Railway free tier includes:
- 500 hours/month execution time
- 100GB outbound bandwidth
- Static outbound IP

For this use case (1 request/day, ~1 minute runtime), you'll use ~30 hours/month = **FREE**!

If you exceed free tier, it's ~$5/month.

## Alternative: Fly.io

If you prefer Fly.io (also free tier):

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Deploy from proxy/ directory
cd proxy
fly launch --name brawl-proxy
fly deploy

# Get static IP
fly ips list
```

Use the IPv4 address for whitelisting.
