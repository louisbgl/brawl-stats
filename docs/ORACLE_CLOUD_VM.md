# Oracle Cloud VM Documentation

## IMPORTANT: Save This Information!

This document contains all the critical information you need to access and manage your Oracle Cloud VM that hosts the Brawl Stars API proxy.

---

## VM Details

- **Public IP Address**: `129.151.245.132`
- **Private IP Address**: `10.0.0.131`
- **Instance Name**: `brawl-proxy`
- **OS**: Ubuntu 20.04.6 LTS
- **Region**: eu-marseille-1

---

## SSH Access

### SSH Key Location
Your SSH private key is stored at:
```
~/Downloads/ssh-key-2026-03-14.key
```

**⚠️ CRITICAL**: Back this file up somewhere safe! Without it, you cannot access the VM.

### SSH Command
```bash
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132
```

---

## Services on the VM

### Automated Data Collection (Cron Jobs)

The VM runs automated data collection tasks via cron:

**View cron schedule**:
```bash
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 'crontab -l'
```

#### Daily Profile Snapshots
- **Schedule**: Every day at 23:00 UTC (midnight CET winter / 1am CEST summer)
- **Script**: `/home/ubuntu/collect-snapshots.sh`
- **Branch**: `data-snapshots` (auto-merges to `main`)
- **What it does**:
  1. Collects player profile data (trophies, brawlers, power levels)
  2. Saves to `data/YYYY-MM-DD.json`
  3. Commits to `data-snapshots` branch
  4. Auto-merges to `main`

**View snapshot collection logs**:
```bash
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 'tail -100 /home/ubuntu/collect-snapshots.log'
```

#### Battlelog Collection
- **Schedule**: Every 30 minutes
- **Script**: `/home/ubuntu/collect-battlelogs.sh`
- **Branch**: `data-battlelogs` (auto-merges to `main`)
- **What it does**:
  1. Collects recent battle history for all tracked players
  2. Saves to `data/battlelogs/{TAG}.json`
  3. Commits to `data-battlelogs` branch
  4. Auto-merges to `main`

**View battlelog collection logs**:
```bash
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 'tail -100 /home/ubuntu/collect-battlelogs.log'
```

#### Collection Scripts Location
- **Project directory**: `/home/ubuntu/brawl-stats`
- **Snapshot script**: `/home/ubuntu/collect-snapshots.sh`
- **Battlelog script**: `/home/ubuntu/collect-battlelogs.sh`
- **Python environment**: Uses `uv` package manager

**Manually trigger collection**:
```bash
# Trigger snapshot collection
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 '/home/ubuntu/collect-snapshots.sh'

# Trigger battlelog collection
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 '/home/ubuntu/collect-battlelogs.sh'
```

---

## Updating the Brawl Stars API Token

The data collection scripts use a Brawl Stars API token. If it expires or needs updating:

1. Go to https://developer.brawlstars.com
2. Create a new API key with IP: `129.151.245.132`
3. Copy the new token
4. Update the token in the project's `.env` file on the VM:

```bash
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 << 'EOF'
cd /home/ubuntu/brawl-stats
cat > .env << 'ENVFILE'
BRAWL_STARS_API_TOKEN=YOUR_NEW_TOKEN_HERE
ENVFILE
EOF
```

5. The cron jobs will automatically use the new token on next run

---

## Firewall Configuration

The VM has iptables firewall configured to allow:
- Port 22 (SSH)

To view firewall rules:
```bash
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 'sudo iptables -L -n --line-numbers'
```

---

## Oracle Cloud Console Access

To manage the VM from Oracle Cloud dashboard:

1. Go to https://cloud.oracle.com
2. Sign in with your account
3. Navigate to: **Compute** → **Instances**
4. Find instance: `brawl-proxy`

From there you can:
- View instance details
- Stop/start/reboot the instance
- Access the console (emergency access if SSH fails)
- Modify networking settings

---

## Cost

The VM is running on **Oracle Cloud Free Tier**, which includes:
- 1 VM instance (always free)
- Static IPv4 address (always free)
- 10 TB outbound data transfer per month (always free)

**Monthly cost: $0** 🎉

---

## Troubleshooting

### Data collection failing with API errors
This usually means the API token expired or IP is not whitelisted:
1. Create a new API key at https://developer.brawlstars.com with IP `129.151.245.132`
2. Update the token in `/home/ubuntu/brawl-stats/.env` (see "Updating the Brawl Stars API Token" above)

### Cannot SSH into VM
1. Check that you're using the correct SSH key file
2. Check that the key file has correct permissions: `chmod 600 ~/Downloads/ssh-key-2026-03-14.key`
3. If key is lost, use Oracle Cloud console to access the instance console and create a new SSH key

### VM is down
1. Log into Oracle Cloud console
2. Navigate to the instance
3. Click "Reboot" or "Start"

---

## Backup Checklist

Things you should back up RIGHT NOW:

1. ✅ SSH private key: `~/Downloads/ssh-key-2026-03-14.key`
2. ✅ Oracle Cloud account login credentials
3. ✅ Brawl Stars API token (stored in VM's `/home/ubuntu/.env`)
4. ✅ This documentation file

**Recommended**: Copy the SSH key to a secure location:
```bash
# Copy to a secure backup location
cp ~/Downloads/ssh-key-2026-03-14.key ~/Documents/backups/oracle-cloud-ssh-key.pem
chmod 600 ~/Documents/backups/oracle-cloud-ssh-key.pem
```

---

## Quick Reference Commands

```bash
# SSH into VM
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132

# View data collection logs
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 'tail -100 /home/ubuntu/collect-snapshots.log'
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 'tail -100 /home/ubuntu/collect-battlelogs.log'

# Manually trigger data collection
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 '/home/ubuntu/collect-snapshots.sh'
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 '/home/ubuntu/collect-battlelogs.sh'

# View cron schedule
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 'crontab -l'

# Check if data collection is working
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 'ls -lth /home/ubuntu/brawl-stats/data/*.json | head -5'
```
