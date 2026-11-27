export interface EmailAttachment {
  filename: string;
  /** Base64 file content (no data: prefix). */
  contentBase64: string;
  contentType: string;
  /** Referenced from the HTML as `cid:<contentId>` for an inline image. */
  contentId?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  /** Optional HTML version; `text` is always sent too. */
  html?: string;
  attachments?: EmailAttachment[];
  template: string;
  orderId?: string;
}

export interface EmailResult {
  id: string;
  mode: "local-logger" | "live";
}

export interface EmailTransport {
  readonly key: string;
  readonly mode: "local-logger" | "live";
  readonly isMock: boolean;
  send(message: EmailMessage): Promise<EmailResult>;
}
