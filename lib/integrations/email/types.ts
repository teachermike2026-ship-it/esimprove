export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
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
