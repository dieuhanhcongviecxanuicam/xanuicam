Server setup and Cloudflared diagnostics

Files added:
- `install_cloudflared_and_docker.sh` — installs Docker and prepares `/etc/cloudflared`.
- `ssh_ca_setup.sh` — installs SSH CA public key and updates `sshd_config`.
- `diagnostics_cloudflared_backend.sh` — collects runtime info for backend and cloudflared.
- `cloudflared/config.yml.template` — ingress template for CNAME routes to backend.

Run these steps on the target server (as root):

1) Copy your cloudflared credentials (credentials.json or cert.pem) to `/etc/cloudflared`.
2) Create `/etc/cloudflared/config.yml` by editing `scripts/cloudflared/config.yml.template` and filling `__TUNNEL_ID__`.
3) Make sure backend `.env` exists in the repo with production values (DB, JWT_SECRET, AUDIT_LOG_KEY).
4) Run the setup script to install Docker and prepare directories:

```bash
sudo bash scripts/install_cloudflared_and_docker.sh
```

5) Start services with docker compose:

```bash
docker compose up -d --build
```

6) To diagnose Cloudflared / backend issues run:

```bash
sudo bash scripts/diagnostics_cloudflared_backend.sh
```

7) To install an SSH CA public key and configure sshd:

```bash
sudo bash scripts/ssh_ca_setup.sh /path/to/ca.pub
```

Security notes:
- Never commit `credentials.json`, certs, or private keys into git.
- Use the template placeholders and inject secrets via your deployment environment or secret manager.
