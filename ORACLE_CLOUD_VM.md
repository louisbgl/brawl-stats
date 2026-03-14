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

## Proxy Service

### Service Status
The proxy runs as a systemd service called `brawl-proxy`.

**Check status**:
```bash
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 'sudo systemctl status brawl-proxy.service'
```

**View logs**:
```bash
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 'sudo journalctl -u brawl-proxy.service -n 50'
```

**Restart service**:
```bash
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 'sudo systemctl restart brawl-proxy.service'
```

**Stop service**:
```bash
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 'sudo systemctl stop brawl-proxy.service'
```

**Start service**:
```bash
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 'sudo systemctl start brawl-proxy.service'
```

### Service Configuration
- **Location**: `/etc/systemd/system/brawl-proxy.service`
- **Environment File**: `/home/ubuntu/.env`
- **Code Location**: `/home/ubuntu/main.py`
- **Python venv**: `/home/ubuntu/venv`

### Proxy URL
```
http://129.151.245.132:8080
```

**Health check**:
```bash
curl http://129.151.245.132:8080/health
```

**Test API call**:
```bash
curl "http://129.151.245.132:8080/players/%23LLJGJQVY"
```

---

## Updating the API Token

If you need to create a new Brawl Stars API key (e.g., if it expires), follow these steps:

1. Go to https://developer.brawlstars.com
2. Create a new API key with IP: `129.151.245.132`
3. Copy the new token
4. Update the token on the VM:

```bash
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 << 'EOF'
cat > .env << 'ENVFILE'
BRAWL_STARS_API_TOKEN=YOUR_NEW_TOKEN_HERE
PORT=8080
ENVFILE
sudo systemctl restart brawl-proxy.service
EOF
```

5. Verify it works:
```bash
curl "http://129.151.245.132:8080/players/%23LLJGJQVY"
```

---

## Updating the Proxy Code

If you need to update the proxy code on the VM:

```bash
# First, update the code in your local repo, then:
scp -i ~/Downloads/ssh-key-2026-03-14.key proxy/main.py ubuntu@129.151.245.132:~/main.py

# Restart the service
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 'sudo systemctl restart brawl-proxy.service'

# Check it's working
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 'sudo systemctl status brawl-proxy.service'
```

---

## Firewall Configuration

The VM has iptables firewall configured to allow:
- Port 22 (SSH)
- Port 8080 (Proxy)

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

### Proxy not responding
1. Check if service is running:
   ```bash
   ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 'sudo systemctl status brawl-proxy.service'
   ```

2. Check logs for errors:
   ```bash
   ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 'sudo journalctl -u brawl-proxy.service -n 100'
   ```

3. Try restarting:
   ```bash
   ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 'sudo systemctl restart brawl-proxy.service'
   ```

### API calls failing with 403
This means the IP is not whitelisted or the token expired:
1. Create a new API key at https://developer.brawlstars.com with IP `129.151.245.132`
2. Update the token on the VM (see "Updating the API Token" above)

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

# Check proxy health
curl http://129.151.245.132:8080/health

# View proxy logs
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 'sudo journalctl -u brawl-proxy.service -n 50 --no-pager'

# Restart proxy
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 'sudo systemctl restart brawl-proxy.service'

# Update proxy code
scp -i ~/Downloads/ssh-key-2026-03-14.key proxy/main.py ubuntu@129.151.245.132:~/main.py && \
ssh -i ~/Downloads/ssh-key-2026-03-14.key ubuntu@129.151.245.132 'sudo systemctl restart brawl-proxy.service'
```
