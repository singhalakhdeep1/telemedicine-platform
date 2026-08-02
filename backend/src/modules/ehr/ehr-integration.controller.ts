import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { EHRIntegrationService } from './ehr-integration.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('ehr')
@UseGuards(JwtAuthGuard)
export class EHRIntegrationController {
  constructor(private ehrService: EHRIntegrationService) {}

  @Post('connections')
  async createConnection(@Request() req, @Body() data: any) {
    return this.ehrService.createEHRConnection(req.user.patientId, data);
  }

  @Get('connections')
  async getConnections(@Request() req) {
    return this.ehrService.getPatientConnections(req.user.patientId);
  }

  @Post('connections/:id/sync')
  async syncData(@Param('id') id: string) {
    return this.ehrService.syncPatientData(id);
  }

  @Post('connections/:id/import')
  async importData(@Param('id') id: string) {
    return this.ehrService.importFromEHR(id);
  }

  @Get('connections/:id/logs')
  async getSyncLogs(@Param('id') id: string) {
    return this.ehrService.getSyncLogs(id);
  }
}
