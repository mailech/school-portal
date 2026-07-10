import { Inject, Injectable, Logger } from '@nestjs/common';
import { INBOUND_MAIL_PORT, type InboundMailPort } from '@app/core';
import { InboundProcessor } from './inbound-processor.service';

@Injectable()
export class InboundPollService {
  private readonly logger = new Logger('InboundPoll');

  constructor(
    @Inject(INBOUND_MAIL_PORT) private readonly port: InboundMailPort,
    private readonly processor: InboundProcessor,
  ) {}

  async poll(): Promise<void> {
    const batch = await this.port.fetchNew();
    for (const email of batch.emails) {
      try {
        await this.processor.processEmail(email);
      } catch (err) {
        this.logger.error(
          `Failed to process inbound ${email.messageId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }
}
