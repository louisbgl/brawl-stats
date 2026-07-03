# Brawl Stars API Proxy

Simple Flask proxy that forwards requests to Brawl Stars API with authentication.

## Purpose

- Allows local development from any IP (bypasses API token IP whitelist)
- Runs on Oracle Cloud VM at 129.151.245.132:8080

## Running on VM

Managed by systemd service:
```bash
systemctl status brawl-proxy.service
systemctl restart brawl-proxy.service
```

## Local Testing

Not needed locally - just point requests to VM proxy URL.

## Dependencies

See `requirements.txt` for Python packages (Flask, requests, gunicorn).
VM uses gunicorn with systemd for production deployment.
