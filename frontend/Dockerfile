FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
# Use npm install to avoid failing when there's no package-lock.json in the
# frontend folder. For reproducible builds, generate and commit a lockfile or
# switch this back to `npm ci` after ensuring package-lock.json exists.
RUN npm install --no-audit --no-fund

# Copy sources and build
COPY . .
RUN npm run build

FROM nginx:stable-alpine
COPY --from=builder /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
