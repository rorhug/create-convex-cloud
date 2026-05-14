export const APP_NAME_MAX_LENGTH = 100;

export const APP_NAME_RULE_DESCRIPTION =
  "App names must be 2-100 characters and use only lowercase letters, digits, '.', '_', and '-'. They cannot contain '---'.";

const appNamePattern = /^[a-z0-9._-]+$/;

export function normalizeAppName(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{3,}/g, "--");
}

export function validateAppName(name: string): string | null {
  if (name.length < 2) {
    return "App name must be at least 2 characters";
  }
  if (name.length > APP_NAME_MAX_LENGTH) {
    return `App name must be ${APP_NAME_MAX_LENGTH} characters or fewer`;
  }
  if (!appNamePattern.test(name)) {
    return APP_NAME_RULE_DESCRIPTION;
  }
  if (name.includes("---")) {
    return "App name cannot contain '---'";
  }
  return null;
}

export function assertValidAppName(name: string) {
  const message = validateAppName(name);
  if (message) {
    throw new Error(message);
  }
}
