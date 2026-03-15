# IP Address Setup for Brawl Stars API

The Brawl Stars API requires whitelisted IP addresses for token creation. This complicates GitHub Actions automation.

## Current IP Configuration Options

### Option 1: Local Development Only ⚠️
**Status**: Easy but limits automation

1. Go to https://developer.brawlstars.com
2. Create token with your current IP
3. Add to `.env` locally
4. Run `collect_data.py` manually when needed

**Pros**: Simple, secure
**Cons**: No automation, manual daily runs

### Option 2: GitHub Actions + API Gateway (Recommended)
**Status**: Best for full automation

Use a service with a static IP to proxy requests:

**Free/cheap options:**
- **Railway.app**: Deploy a simple proxy (free tier available)
- **Fly.io**: Deploy with static IP ($2/month)
- **Oracle Cloud**: Always-free tier VM with static IP

**How it works:**
1. Deploy tiny proxy service with static IP
2. Whitelist that IP in Brawl Stars developer portal
3. GitHub Actions hits your proxy
4. Proxy forwards to Brawl Stars API

Would you like me to create a simple proxy setup?

### Option 3: Scheduled Task on Your Machine
**Status**: Semi-automated, reliable

Instead of GitHub Actions, run locally on schedule:

**Linux/Mac:**
```bash
# Add to crontab (crontab -e)
0 0 * * * cd /path/to/brawl && /path/to/uv run collect_data.py && git push
```

**Windows:**
- Use Task Scheduler to run daily
- Script commits and pushes changes

**Pros**: Uses your whitelisted IP, simple
**Cons**: Computer must be on daily, not truly cloud-based

### Option 4: Self-Hosted GitHub Actions Runner
**Status**: Advanced but fully featured

Run GitHub Actions on your own machine with static IP:

1. Set up self-hosted runner on your computer/server
2. Modify workflow to use: `runs-on: self-hosted`
3. Runner uses your IP (which is whitelisted)

**Pros**: Full GitHub automation, uses your IP
**Cons**: Requires always-on machine

## Recommendation

For a **simple, functional setup**:

1. **Short term**: Use Option 3 (local cron job) - works today, zero complexity
2. **Long term**: Deploy a tiny proxy on Railway/Fly.io - full automation

## Current IPs to Whitelist

Check your current IP:
```bash
curl ifconfig.me
```

For development, whitelist this IP when creating your token.

For GitHub Actions, we'll need to set up a proxy or choose another option above.
