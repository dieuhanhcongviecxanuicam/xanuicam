#!/usr/bin/env bash
# Generate base64 JWT secret. Usage: ./generate_jwt_secret.sh HS512 64 [.env]
ALG=${1:-HS512}
BYTES=${2:-}
OUT=${3:-}
if [ -z "$BYTES" ]; then
  if [ "$ALG" = "HS256" ]; then
    BYTES=32
  else
    BYTES=64
  fi
fi
SECRET=$(head -c $BYTES /dev/urandom | base64)
echo "Generated secret (base64, $BYTES bytes) for $ALG:"
echo "$SECRET"
if [ -n "$OUT" ]; then
  if [ -f "$OUT" ]; then
    echo -e "\nJWT_SECRET=$SECRET\nJWT_ALGORITHM=$ALG\n" >> "$OUT"
    echo "Appended JWT_SECRET and JWT_ALGORITHM to $OUT"
  else
    echo -e "JWT_SECRET=$SECRET\nJWT_ALGORITHM=$ALG\n" > "$OUT"
    echo "Created $OUT with JWT_SECRET and JWT_ALGORITHM"
  fi
  echo "Ensure $OUT is in .gitignore and not committed."
fi
