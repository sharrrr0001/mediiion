import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AttachmentsService } from './attachments.service';
import { IntakeController } from './intake.controller';
import { IntakeService } from './intake.service';
import { StorageService } from './storage.service';
import { SummaryService } from './summary.service';

@Module({
  controllers: [IntakeController],
  providers: [IntakeService, AiService, AttachmentsService, StorageService, SummaryService],
  exports: [AiService, SummaryService, StorageService],
})
export class IntakeModule {}
