import { Module } from '@nestjs/common';
import { INBOUND_MAIL_PORT } from '@app/core';
import { WORKER_CONFIG, type WorkerConfig } from '../config/worker-config';
import { InboundProcessor } from './inbound-processor.service';
import { InboundPollService } from './inbound-poll.service';
import { ImapInboundAdapter } from './imap.adapter';
import { GmailInboundAdapter } from './gmail.adapter';

@Module({
  providers: [
    InboundProcessor,
    InboundPollService,
    ImapInboundAdapter,
    GmailInboundAdapter,
    {
      provide: INBOUND_MAIL_PORT,
      inject: [WORKER_CONFIG, ImapInboundAdapter, GmailInboundAdapter],
      useFactory: (config: WorkerConfig, imap: ImapInboundAdapter, gmail: GmailInboundAdapter) =>
        config.email.provider === 'gmail_api' ? gmail : imap,
    },
  ],
  exports: [InboundProcessor, InboundPollService],
})
export class InboundModule {}
