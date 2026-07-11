import { Controller, Get } from '@nestjs/common';
import { LogsService } from './logs.service';

@Controller('logs')
export class LogsController {
  constructor(private readonly logs: LogsService) {}

  @Get('emails')
  emails() {
    return this.logs.listEmails();
  }

  @Get('audit')
  audit() {
    return this.logs.listAudit();
  }
}
