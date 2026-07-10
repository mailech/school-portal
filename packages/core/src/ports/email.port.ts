/** An email to send to a parent. `correlationId` is the EmailLog id. */
export interface OutboundMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Extra headers, e.g. In-Reply-To / References for threading. */
  headers?: Record<string, string>;
  replyTo?: string;
  correlationId: string;
}

export interface SentResult {
  /** RFC Message-ID (angle-bracketed) — persisted as the threading anchor. */
  providerMessageId: string;
  /** Optional preview URL (Ethereal dev transport). */
  previewUrl?: string;
}

export interface EmailProviderPort {
  send(msg: OutboundMessage): Promise<SentResult>;
}

/** A parsed inbound email, normalized across IMAP and the Gmail API. */
export interface InboundEmail {
  messageId: string;
  inReplyTo?: string;
  references: string[];
  from: string;
  subject: string;
  text: string;
  receivedAt: Date;
}

export interface InboundBatch {
  emails: InboundEmail[];
  /** Opaque cursor to resume from next poll (IMAP UID / Gmail historyId). */
  cursor?: string;
}

export interface InboundMailPort {
  fetchNew(sinceCursor?: string): Promise<InboundBatch>;
}

export const EMAIL_PROVIDER_PORT = Symbol('EMAIL_PROVIDER_PORT');
export const INBOUND_MAIL_PORT = Symbol('INBOUND_MAIL_PORT');
