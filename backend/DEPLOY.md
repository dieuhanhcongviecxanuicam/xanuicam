Deployment steps for backend (ensure dependencies and restart)

1. Install dependencies (production):

```bash
cd backend
npm ci --production
```

2. If you deploy via PM2 (recommended):

```bash
# start the app (first time)
pm2 start ecosystem.config.js --env production

# restart after deploy
pm2 restart ubnd-backend
```

3. The repository includes a `postinstall` script that will attempt to ensure `exceljs` is present and will try to restart the PM2 process when `NODE_ENV=production`.

If automatic steps fail (for example, if `pm2` is not installed or user permissions prevent restarts), run the commands above manually.

Notes:
- `exceljs` is required for server-side XLSX generation. The script will attempt to install it automatically during `npm install` if missing.
- Ensure the production user has permissions to run `pm2` and restart processes.

LibreOffice (recommended for high-fidelity .docx preview)
------------------------------------------------------

To render `.docx` files exactly as they appear in Word, the backend can convert them to PDF using LibreOffice (soffice) and stream the PDF to the browser. Please ensure `soffice` is installed on the server and available in `PATH`, or set the `SOFFICE_PATH`/`LIBREOFFICE_PATH` environment variable to the full executable path.

Ubuntu/Debian:
```bash
apt-get update && apt-get install -y libreoffice
```

CentOS/RHEL/Fedora:
```bash
dnf install -y libreoffice
```

Windows:
- Download LibreOffice from https://www.libreoffice.org/download/ and install.
- Add the path to `soffice.exe` (for example `C:\Program Files\LibreOffice\program\soffice.exe`) to the system `PATH` or set the `SOFFICE_PATH` environment variable.

If you cannot install LibreOffice on the host, consider running a small helper container on the same machine that performs conversions (for example, a LibreOffice Docker image) and expose a local conversion endpoint the backend can call.

Development helper (Docker-based converter)
-----------------------------------------
If you prefer not to install LibreOffice on your host, there's a small helper service under `backend/converter` that runs LibreOffice inside Docker to perform conversions. For development:

```bash
cd backend/converter
npm ci
npm run dev
```

This starts a tiny HTTP service on port `4001` by default with a `POST /convert` endpoint that accepts `{ path: 'uploads/...' }` and returns a PDF. Set `DOCKER_LIBREOFFICE_IMAGE` to change the Docker image used.

Production caching / nginx snippet
---------------------------------
To serve generated PDF previews efficiently on the internet, configure your frontend CDN or `nginx` to cache and serve `/uploads` and to support range requests. Example `nginx` location block:

```nginx
location /uploads/ {
	alias /path/to/app/uploads/;
	autoindex off;
	add_header Cache-Control "public, max-age=86400";
	tcp_nopush on;
	sendfile on;
	# allow byte ranges for PDFs
	add_header Accept-Ranges bytes;
}
```

If you choose to generate PDF previews on upload, place resulting PDFs next to their original `.docx` files (same directory) and ensure the webserver serves them with correct `Content-Type: application/pdf` and `Content-Disposition: inline` so browsers render in-place.
