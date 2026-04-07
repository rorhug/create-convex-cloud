#!/bin/bash

# inspired by conversation here: https://github.com/get-convex/convex-backend/issues/123
# and here: https://discord.com/channels/1019350475847499849/1019350478817079338/1467722898067292324

set_convex_env() {
  local name="$1"
  local value="$2"
  local assignment="${name}=${value}"

  if [ "$VERCEL_TARGET_ENV" = "preview" ]; then
    npx convex env set --preview-name "$VERCEL_GIT_COMMIT_REF" "$assignment"
  else
    npx convex env set "$assignment"
  fi
}

get_convex_env() {
  local name="$1"

  if [ "$VERCEL_TARGET_ENV" = "preview" ]; then
    npx convex env get --preview-name "$VERCEL_GIT_COMMIT_REF" "$name"
  else
    npx convex env get "$name"
  fi
}

ensure_jwt_env() {
  local current_jwks
  local current_private_key
  local generated_env

  current_jwks="$(get_convex_env JWKS 2>/dev/null || true)"
  if [ -n "$current_jwks" ]; then
    echo "JWKS is already set, skipping JWT key setup"
    return 0
  fi

  current_private_key="$(get_convex_env JWT_PRIVATE_KEY 2>/dev/null || true)"
  if [ -n "$current_private_key" ]; then
    echo "JWT_PRIVATE_KEY is already set without JWKS, skipping JWT key setup"
    return 0
  fi

  echo "Generating JWT key pair for Convex env"
  generated_env="$(node generate-jwt-keys.mjs)"
  eval "$generated_env"

  echo "Setting JWT_PRIVATE_KEY on Convex"
  set_convex_env JWT_PRIVATE_KEY "$JWT_PRIVATE_KEY"

  echo "Setting JWKS on Convex"
  set_convex_env JWKS "$JWKS"
}

ensure_site_url_env() {
  CURRENT_SITE_URL=$(get_convex_env SITE_URL)
  echo "SITE_URL is currently $CURRENT_SITE_URL"

  if [ "$VERCEL_TARGET_ENV" = "preview" ]; then
    NEW_SITE_URL="https://$VERCEL_BRANCH_URL"
  else
    NEW_SITE_URL="https://$VERCEL_PROJECT_PRODUCTION_URL"
  fi

  if [ "$CURRENT_SITE_URL" != "$NEW_SITE_URL" ]; then
    echo "Setting SITE_URL to $NEW_SITE_URL"
    set_convex_env SITE_URL "$NEW_SITE_URL"
  fi
}

echo "Starting set-convex-env.sh to ensure correct environment on Convex"
ensure_site_url_env
ensure_jwt_env
echo "set-convex-env.sh completed"