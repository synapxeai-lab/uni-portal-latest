import type { SystemSettings } from "./system-settings";

/** Returns human-readable violation messages for a candidate password against the current policy. */
export function getPasswordPolicyViolations(password: string, settings: SystemSettings): string[] {
  const violations: string[] = [];

  if (password.length < settings.minPasswordLength) {
    violations.push(`Password must be at least ${settings.minPasswordLength} characters.`);
  }
  if (settings.requirePasswordUppercase && !/[A-Z]/.test(password)) {
    violations.push("Include at least one uppercase letter.");
  }
  if (settings.requirePasswordNumber && !/[0-9]/.test(password)) {
    violations.push("Include at least one number.");
  }
  if (settings.requirePasswordSymbol && !/[^A-Za-z0-9]/.test(password)) {
    violations.push("Include at least one symbol.");
  }

  return violations;
}
