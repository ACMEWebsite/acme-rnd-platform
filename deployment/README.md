# Office-server deployment

## Before launch

1. Ask IT for a DHCP reservation and an internal DNS name such as acme-rnd.local.
2. Copy .env.example to .env and replace every placeholder secret.
3. While the temporary HTTP configuration is active, restrict Windows Firewall
   to the approved development subnet on TCP 80.
4. Keep ports 5432 and 8000 closed to the LAN.
5. Confirm that the chosen container runtime is approved and appropriately licensed.

## Start

    docker compose up -d --build
    docker compose exec backend python manage.py createsuperuser
    docker compose ps

Open http://<APP_HOST>.

This HTTP-only mode is temporary because the Windows host rejected Caddy's
internal-CA TLS handshake. Do not expose it to an untrusted network. Before
office rollout, configure Caddy with an organization-issued certificate (or
deploy and trust Caddy's root CA through IT), restore the HTTPS listener and
TCP 443 mapping, update the Django CSRF trusted origin to `https://`, and close
TCP 80 if HTTP-to-HTTPS redirection is not required. Also set
`DJANGO_HTTPS_ENABLED=true` so Django enables secure cookies, its trusted proxy
header, and HSTS only after HTTPS is actually available.

The backend container starts as root only long enough to create and repair
ownership of `/app/staticfiles` on the `django_static` volume. It then drops to
the unprivileged `acme` account before running migrations, `collectstatic`, or
Gunicorn. No manual volume permission command is required after deployment or
volume recreation.

## Backup

    .\deployment\scripts\backup-postgres.ps1 -BackupDirectory "F:\ACME-Backups" -RetentionDays 30

Run this with Windows Task Scheduler and test restoration quarterly. Use VPN for remote users; never forward ports 8000 or 5432 from the internet.
