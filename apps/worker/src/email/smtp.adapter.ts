import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { EmailProviderPort, OutboundMessage, SentResult } from '@app/core';
import { WORKER_CONFIG, type WorkerConfig } from '../config/worker-config';

/**
 * Outbound email via Nodemailer. Two transports:
 *  - dev  : streams the message to a .eml file under ./dev-mail (no server, no
 *           network) so the full red->yellow->green demo works with only Postgres.
 *  - smtp : a real SMTP server (a local Mailpit, or Gmail/Workspace SMTP with an
 *           app password) — set MAIL_TRANSPORT=smtp and the SMTP_* vars.
 */
@Injectable()
export class SmtpEmailAdapter implements EmailProviderPort, OnModuleInit {
  private readonly logger = new Logger('Email');
  private transporter!: nodemailer.Transporter;
  private readonly devDir = resolve(process.cwd(), 'dev-mail');

  constructor(@Inject(WORKER_CONFIG) private readonly config: WorkerConfig) {}

  async onModuleInit(): Promise<void> {
    if (this.config.email.transport === 'smtp') {
      const { host, port, secure, user, pass } = this.config.email.smtp;
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: user ? { user, pass } : undefined,
      });
      this.logger.log(`Email transport: SMTP ${host}:${port}`);
    } else {
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        buffer: true,
        newline: 'unix',
      });
      await mkdir(this.devDir, { recursive: true });
      this.logger.log(`Email transport: dev (writing .eml to ${this.devDir})`);
    }
  }

  async send(msg: OutboundMessage): Promise<SentResult> {
    const info = await this.transporter.sendMail({
      from: this.config.email.from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      replyTo: msg.replyTo ?? this.config.email.replyTo,
      headers: msg.headers,
    });

    const providerMessageId: string = info.messageId;

    if (this.config.email.transport === 'dev') {
      const raw = (info as unknown as { message?: Buffer }).message;
      if (raw) {
        const safeId = providerMessageId.replace(/[<>:"/\\|?*]/g, '_');
        const file = resolve(this.devDir, `${safeId}.eml`);
        await writeFile(file, raw);
        this.logger.log(`[dev-mail] "${msg.subject}" -> ${msg.to}  (${file})`);
        return { providerMessageId, previewUrl: file };
      }
    }

    this.logger.log(`Sent "${msg.subject}" -> ${msg.to} (${providerMessageId})`);
    return { providerMessageId };
  }
}
