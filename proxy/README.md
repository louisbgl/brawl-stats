# Brawl Stars API Proxy

Simple Flask proxy that provides a static IP endpoint for accessing the Brawl Stars API.

## Why?

The Brawl Stars API requires IP whitelisting. GitHub Actions uses dynamic IPs, so we need a proxy with a static IP.

## Deployment

### Railway.app (Recommended - Free tier available)

1. **Create Railway account**: https://railway.app
2. **Create new project** → "Deploy from GitHub repo"
3. **Select this repo** and set root directory to `/proxy`
4. **Add environment variable**:
   - Key: `BRAWL_STARS_API_TOKEN`
   - Value: Your Brawl Stars API token
5. **Deploy** and wait for build to complete
6. **Get your public URL**: Should be like `https://your-app.up.railway.app`

### Get Static IP for Whitelisting

Railway gives you a static outbound IP:

1. Go to your project settings
2. Find "Networking" section
3. Look for "Outbound IP" or check logs when making first request
4. **Whitelist this IP** in Brawl Stars developer portal

### Testing

Once deployed, test the proxy:

```bash
# Health check
curl https://your-app.up.railway.app/health

# Test API call (replace with your player tag)
curl https://your-app.up.railway.app/players/%23LLJGJQVY
```

## Using the Proxy

Update your `.env` file to use the proxy:

```bash
# Original (direct API)
# BRAWL_STARS_API_TOKEN=your_token
# BRAWL_STARS_API_URL=https://api.brawlstars.com/v1

# With proxy (no token needed locally!)
BRAWL_STARS_API_URL=https://your-app.up.railway.app
```

The proxy handles authentication, so you don't need to pass the token from your code.

## Security

- The proxy only accepts GET requests
- Only forwards to official Brawl Stars API
- Token is stored securely in Railway environment variables
- No authentication required on proxy (API token is server-side)

## Alternative: Fly.io

If you prefer Fly.io (also has static IPs):

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Deploy
cd proxy
fly launch
fly deploy

# Get outbound IP
fly ips list
```

Whitelist the IPv4 address shown in Brawl Stars developer portal.
