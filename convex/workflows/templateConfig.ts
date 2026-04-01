// ---------------------------------------------------------------------------
// Template source configuration
// ---------------------------------------------------------------------------

// Owner/repo of the upstream Convex templates repository.
export const TEMPLATE_SOURCE_OWNER = "get-convex";
export const TEMPLATE_SOURCE_REPO = "templates";

// Folder name inside that repo.  Change this (or make it per-app) to support
// multiple template types in the future.
export const DEFAULT_TEMPLATE_FOLDER = "template-nextjs-convexauth";

// Files from the upstream template that we do NOT want in the generated repo.
export const TEMPLATE_SKIP_FILES = new Set(["package-lock.json"]);

// ---------------------------------------------------------------------------
// Supplementary files
// These files are injected on top of the upstream template (overriding any
// file with the same path).  They handle automation-specific concerns that
// the upstream template doesn't include:
//   • vercel.json  – our build command (calls set-convex-env.sh)
//   • set-convex-env.sh – sets SITE_URL + JWT keys on the Convex deployment
//   • generateJwtKeys.mjs – helper called by set-convex-env.sh
// ---------------------------------------------------------------------------

export const SUPPLEMENTARY_FILES: Array<{
  path: string;
  content: string;
  executable: boolean;
}> = [
  {
    path: "vercel.json",
    executable: false,
    content: JSON.stringify(
      {
        $schema: "https://openapi.vercel.sh/vercel.json",
        version: 2,
        framework: "nextjs",
        installCommand: "npm install",
        buildCommand:
          "npx convex deploy --cmd 'npm run build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL && sh ./set-convex-env.sh",
      },
      null,
      2,
    ),
  },
  {
    path: "set-convex-env.sh",
    executable: true,
    content: `#!/bin/bash

# inspired by conversation here: https://github.com/get-convex/convex-backend/issues/123
# and here: https://discord.com/channels/1019350475847499849/1019350478817079338/1467722898067292324

set_convex_env() {
  local name="$1"
  local value="$2"
  local assignment="\${name}=\${value}"

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
  generated_env="$(node generateJwtKeys.mjs)"
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
`,
  },
  {
    path: "generateJwtKeys.mjs",
    executable: false,
    content: `import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { pathToFileURL } from "node:url";

export async function generateKeys() {
  try {
    const keys = await generateKeyPair("RS256");
    const privateKey = await exportPKCS8(keys.privateKey);
    const publicKey = await exportJWK(keys.publicKey);
    const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });
    return {
      JWT_PRIVATE_KEY: \`\${privateKey.trimEnd().replace(/\\n/g, " ")}\`,
      JWKS: jwks,
    };
  } catch (error) {
    console.error(
      "Could not generate private and public key, are you running this command using Node.js?\\n",
      error,
    );
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { JWT_PRIVATE_KEY, JWKS } = await generateKeys();
  console.log(\`JWT_PRIVATE_KEY=\${JSON.stringify(JWT_PRIVATE_KEY)}\`);
  console.log(\`JWKS=\${JSON.stringify(JWKS)}\`);
}
`,
  },
];
