Frontend Docker build and run

Build image:

```
docker build -f frontend/Dockerfile -t xanuicam-frontend:latest .
```

Run container (serve on host port 8080):

```
docker run --rm -p 8080:80 xanuicam-frontend:latest
```

Notes:
- Uses Node 20 to build, served via nginx in a lightweight runtime.
- If you need to build on CI, use the same Dockerfile to ensure consistent Node runtime.
