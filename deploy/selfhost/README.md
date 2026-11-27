# Self-hosting croc for your organization

This kit runs your own croc relay and web client on one Linux server:

| Service | What it does | Ports |
| --- | --- | --- |
| `relay` | croc relay. CLI clients, scripts, and the web bridge connect here. It forwards end-to-end encrypted bytes only. | TCP 9009-9017 |
| `web` | `croc-web`: the browser client, `/ws` bridge to the relay, and optional encrypted temporary storage. | internal 8080 |
| `caddy` | HTTPS reverse proxy with automatic Let's Encrypt certificates. | 80, 443 |

Use a domain you control, such as `transfer.example.com` and
`relay.example.com`. Do not use `getcroc.com` or present the site as the
official croc project; keep `LICENSE` and `THIRD_PARTY_NOTICES.md` with any
copy you distribute.

## 1. Server prerequisites

- Linux host with Docker Engine 24+ and the Compose plugin.
- DNS `A`/`AAAA` records for `SITE_HOST` and `RELAY_HOST` pointing at the host
  (they may be the same machine).
- Firewall open for inbound TCP 80, 443, 9009-9017 and UDP 443.

## 2. Configure and start

```bash
git clone <your fork> croc && cd croc/deploy/selfhost
cp .env.example .env
openssl rand -hex 24          # paste the output into CROC_PASS
nano .env                     # set SITE_HOST, RELAY_HOST, CROC_PASS
docker compose up -d --build
docker compose ps             # all services healthy
curl -fsS https://$SITE_HOST/healthz
```

The image is built with `CROC_RELAY_POOL=$RELAY_HOST:9009` and
`CROC_WEB_URL=https://$SITE_HOST`, so both binaries default to your relay
instead of the public `*.getcroc.com` pool.

Check the relay from any machine:

```bash
croc --relay relay.example.com:9009 --pass YOUR_PASS send somefile
```

### Deploying with Coolify instead

Coolify runs its own HTTPS proxy, so use `docker-compose.coolify.yml` in the
repository root (no Caddy) instead of this directory's compose file:

1. **New resource → Public/Private repository → Build pack: Docker Compose.**
2. **Docker Compose Location:** `/docker-compose.coolify.yml` (base directory `/`).
3. **Environment variables:** `SITE_HOST`, `RELAY_HOST`, `CROC_PASS`, and
   optionally `STORE_DOWNLOADS`, `STORE_MAX_TRANSFER`, `STORE_QUOTA`,
   `STORE_MIN_FREE`, `STORE_MAX_EXPIRATION`. Mark `CROC_PASS` as a secret.
   For white-labeling add `BRAND_NAME` (for example `Straton Ally Transfer`).
   It is applied at build time, so redeploy after changing it.
4. **Domains:** set the `web` service to `https://transfer.example.com:8080`
   (the `:8080` tells Coolify the container port). Leave `relay` empty.
5. Open TCP 9009-9017 in the server firewall (and any cloud security group).
   Coolify's proxy only handles HTTP; the relay ports are published directly.
6. Deploy. `https://transfer.example.com/healthz` should return `ok`.

## 3. Build client binaries for your staff

Codes are routed by their index in the relay pool, so every client that
shares codes with your web UI must be built with the **same** pool. Build
with Go 1.27+:

```bash
make build RELAY_POOL=relay.example.com:9009 WEB_URL=https://transfer.example.com
# Windows / macOS
GOOS=windows GOARCH=amd64 make build RELAY_POOL=relay.example.com:9009 WEB_URL=https://transfer.example.com
GOOS=darwin  GOARCH=arm64 make build RELAY_POOL=relay.example.com:9009 WEB_URL=https://transfer.example.com
```

The relay password is not built in. Give it to clients with the `CROC_PASS`
environment variable or `--pass`. Upstream `croc` binaries also work with
explicit flags: `croc --relay relay.example.com:9009 --pass YOUR_PASS send FILE`.

Note: the bundled `croc-update` and the update check look at upstream croc
releases. Run clients with `--no-update-check` or ship your own builds.

## 4. Use the relay from a WordPress plugin

PHP cannot speak the croc protocol. Pick one approach:

1. **Run the croc binary on the WordPress host** (true relay transfer). Install
   a build from step 3 (for example at `/usr/local/bin/croc`) and call it from
   PHP. Supply the code through `CROC_SECRET` so it never appears in the
   process list:

   ```php
   $code = wp_generate_password(6, false) . '-' . wp_generate_password(6, false) . '-' . wp_generate_password(6, false);
   $env  = ['CROC_PASS' => CROC_RELAY_PASS, 'CROC_SECRET' => $code, 'HOME' => '/tmp'];
   $cmd  = ['/usr/local/bin/croc', '--yes', '--no-update-check',
            '--relay', 'relay.example.com:9009', 'send', $file_path];
   $proc = proc_open($cmd, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, $env);
   // Show $code (or https://transfer.example.com/?code=$code) to the recipient,
   // keep the process running until it exits, then check its exit status.
   ```

   `croc send` blocks until the receiver finishes, so run it from a background
   job (Action Scheduler or WP-Cron) rather than inside a page request.
   Store `CROC_RELAY_PASS` in `wp-config.php`, never in the database or
   front-end code. Check exact flags with `croc send --help`.

2. **Embed or link the web client.** Link to
   `https://transfer.example.com/?code=CODE` or embed the site in an
   `<iframe>`. No transfer code runs in PHP.

3. **Stored mode** (`/api/v1/store/transfers`). Uploads are encrypted in the
   browser and kept as ciphertext on your server until downloaded or expired.
   Calling this API from PHP requires reimplementing its client-side
   encryption; prefer approach 1 or 2.

## Security notes

- **The relay password reaches every browser.** croc-web serves it in
  `/config.js`, so anyone who can open the web UI can use your relay. To keep
  it company-only, enable the `basic_auth` block in `Caddyfile` (or put SSO in
  front). That also blocks external recipients from opening receive and
  stored-mode links, so decide who must reach the site. For a relay that only
  your plugin uses, run a second relay with a different password and do not
  expose it through croc-web.
- File contents are end-to-end encrypted with a key derived from the code. The
  relay and storage only see ciphertext, but anyone with the code can receive
  the file; send codes over a separate channel.
- Stored-mode files live in the `croc-store` volume. Size limits are in `.env`.
- Analytics are off unless you set `UMAMI_URL` and `UMAMI_WEBSITE_ID`.

## Operations

```bash
docker compose logs -f web relay       # logs
git pull && docker compose up -d --build   # update
docker compose down                    # stop (volumes are kept)
```

The web pages still carry upstream SEO metadata (`web/index.html`,
`web/public/robots.txt`, `web/public/sitemap.xml`) and project links. Edit
them if you want your own title, canonical URL, or a `noindex` policy, then
rebuild.
