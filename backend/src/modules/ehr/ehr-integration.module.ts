import { Module } from '@nestjs/common';
import { EHRIntegrationService } from './ehr-integration.service';
import { FhirClientService } from './fhir-client.service';
import { EHRIntegrationController } from './ehr-integration.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [EHRIntegrationController],
  providers: [EHRIntegrationService, FhirClientService],
  exports: [EHRIntegrationService, FhirClientService],
})
export class EHRIntegrationModule {}
