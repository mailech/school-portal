import { Inject, Injectable, Logger } from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import type { InboundBatch, InboundEmail, InboundMailPort } from '@app/core';
import { WORKER_CONFIG, type WorkerConfig } from '../config/worker-config';

/**
 * IMAP-polling inbound adapter (the fallback path). Fetches UNSEEN messages,
 * parses them with mailparser, and marks them Seen so they aren't reprocessed.
 * Used when EMAIL_PROVIDER=smtp_imap and IMAP_ENABLED=true with IMAP_* creds.
 */
@Injectable()
export class ImapInboundAdapter implements InboundMailPort {
  private readonly logger = new Logger('Imap');

  constructor(@Inject(WORKER_CONFIG) private readonly config: WorkerConfig) {}

  async fetchNew(): Promise<InboundBatch> {
    const cfg = this.config.email.imap;
    if (!cfg.enabled || !cfg.host || !cfg.user) {
      return { emails: [] };
    }

    const client = new ImapFlow({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.tls,
      auth: { user: cfg.user, pass: cfg.pass ?? '' },
      logger: false,
    });

    const emails: InboundEmail[] = [];
    await client.connect();
    const lock = await client.getMailboxLock(cfg.mailbox);
    try {
      const uids: number[] = [];
      for await (const msg of client.fetch({ seen: false }, { source: true, uid: true })) {
        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source);
        emails.push({
          messageId: parsed.messageId ?? `imap-${msg.uid}@local`,
          inReplyTo: parsed.inReplyTo,
          references: Array.isArray(parsed.references)
            ? parsed.references
            : parsed.references
              ? [parsed.references]
              : [],
          from: parsed.from?.text ?? '',
          subject: parsed.subject ?? '',
          text: parsed.text ?? '',
          receivedAt: parsed.date ?? new Date(),
        });
        uids.push(msg.uid);
      }
      if (uids.length) {
        await client.messageFlagsAdd({ uid: uids.join(',') }, ['\\Seen'], { uid: true });
      }
    } finally {
      lock.release();
    }
    await client.logout();
    if (emails.length) this.logger.log(`Fetched ${emails.length} new IMAP message(s)`);
    return { emails };
  }
}
