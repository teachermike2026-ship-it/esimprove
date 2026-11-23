/**
 * Removes actionable secrets from text before it is written to a local log or
 * email_events row. Mock transports must never print full reset links, order
 * access tokens, session tokens, or similar credentials.
 */
export function redactSensitiveEmailText(text: string): string {
  let redacted = text.replace(
    /([?&](?:token|code|key|secret|signature|access_token|reset_token)=)[^&\s]+/gi,
    "$1[redacted]",
  );
  // Standalone high-entropy tokens (randomToken(32) is 43 base64url chars).
  // Keep ordinary identifiers, order numbers, and email addresses intact.
  redacted = redacted.replace(/(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{40,}(?![A-Za-z0-9_-])/g, "[redacted]");
  return redacted;
}

export function hasRedactedContent(original: string, redacted: string): boolean {
  return original !== redacted;
}
