import { Inject, Injectable, Logger } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import type { InboundBatch, InboundEmail, InboundMailPort } from '@app/core';
import { WORKER_CONFIG, type WorkerConfig } from '../config/worker-config';

interface GmailHeader {
  name: string;
  value: string;
}
interface GmailPart {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
  headers?: GmailHeader[];
}
interface GmailMessage {
  id: string;
  payload?: GmailPart & { headers?: GmailHeader[] };
}

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';

/**
 * Gmail API inbound adapter (the primary path per the brief). Uses an OAuth2
 * refresh token to poll unread messages, parse them, and mark them read. In a
 * production deployment this is driven by users.watch + a Pub/Sub push that
 * enqueues an inbound-poll job; the pull logic here is identical either way.
 * Selected when EMAIL_PROVIDER=gmail_api and GMAIL_* creds are set.
 */
@Injectable()
export class GmailInboundAdapter implements InboundMailPort {
  private readonly logger = new Logger('Gmail');
  private client?: OAuth2Client;

  constructor(@Inject(WORKER_CONFIG) private readonly config: WorkerConfig) {}

  private oauth(): OAuth2Client {
    if (this.client) return this.client;
    const g = this.config.email.gmail;
    this.client = new OAuth2Client({ clientId: g.clientId, clientSecret: g.clientSecret });
    this.client.setCredentials({ refresh_token: g.refreshToken });
    return this.client;
  }

  private async token(): Promise<string> {
    const { token } = await this.oauth().getAccessToken();
    if (!token) throw new Error('Failed to obtain Gmail access token');
    return token;
  }

  private async api<T>(path: string, token: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${GMAIL}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers },
    });
    if (!res.ok) throw new Error(`Gmail API ${path} -> ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  }

  async fetchNew(): Promise<InboundBatch> {
    const g = this.config.email.gmail;
    if (!g.clientId || !g.refreshToken) return { emails: [] };

    const token = await this.token();
    const list = await this.api<{ messages?: { id: string }[] }>(
      '/messages?q=' + encodeURIComponent('is:unread newer_than:7d'),
      token,
    );
    const ids = list.messages ?? [];
    const emails: InboundEmail[] = [];

    for (const { id } of ids) {
      const msg = await this.api<GmailMessage>(`/messages/${id}?format=full`, token);
      const headers = msg.payload?.headers ?? [];
      const h = (name: string) =>
        headers.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value;
      const references = (h('references') ?? '').split(/\s+/).filter(Boolean);
      emails.push({
        messageId: h('message-id') ?? `gmail-${id}`,
        inReplyTo: h('in-reply-to') ?? undefined,
        references,
        from: h('from') ?? '',
        subject: h('subject') ?? '',
        text: this.extractText(msg.payload),
        receivedAt: new Date(),
      });
      // mark read so it isn't reprocessed
      await this.api(`/messages/${id}/modify`, token, {
        method: 'POST',
        body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
      });
    }
    if (emails.length) this.logger.log(`Fetched ${emails.length} new Gmail message(s)`);
    return { emails };
  }

  private extractText(part?: GmailPart): string {
    if (!part) return '';
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64url').toString('utf8');
    }
    for (const child of part.parts ?? []) {
      const t = this.extractText(child);
      if (t) return t;
    }
    return '';
  }
}
