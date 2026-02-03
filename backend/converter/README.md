# DOCX Converter (development helper)

This small service uses Docker to run a LibreOffice container and convert DOCX files to PDF.

Usage (development):

1. Ensure Docker is installed and running.
2. From the project root, install dependencies for the converter:

```bash
cd backend/converter
npm ci
```

3. Start the converter dev server:

```bash
npm run dev
```

4. Convert a file (HTTP POST):

```
POST http://localhost:4001/convert
Content-Type: application/json

{ "path": "uploads/attachments/.../file.docx" }
```

Notes:
- You can set `DOCKER_LIBREOFFICE_IMAGE` environment variable to the preferred LibreOffice Docker image if `libreoffice` isn't suitable for your environment.
- The backend's `previewAttachment` endpoint can be updated to proxy to this converter service in dev environments (or set `SOFFICE_PATH` on host to use native soffice).
