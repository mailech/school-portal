import { Module } from '@nestjs/common';
import { EMAIL_PROVIDER_PORT } from '@app/core';
import { SmtpEmailAdapter } from './smtp.adapter';
import { OutboundService } from './outbound.service';

@Module({
  providers: [
    SmtpEmailAdapter,
    { provide: EMAIL_PROVIDER_PORT, useExisting: SmtpEmailAdapter },
    OutboundService,
  ],
  exports: [OutboundService, EMAIL_PROVIDER_PORT],
})
export class EmailModule {}
