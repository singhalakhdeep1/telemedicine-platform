import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { MedicalRecordsService } from './medical-records.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, RecordType } from '@prisma/client';

@Controller('medical-records')
@UseGuards(JwtAuthGuard)
export class MedicalRecordsController {
  constructor(private medicalRecordsService: MedicalRecordsService) {}

  @Post()
  async createMedicalRecord(@Request() req, @Body() data: any) {
    return this.medicalRecordsService.createMedicalRecord(
      req.user.doctorId,
      req.user.patientId,
      data,
    );
  }

  @Get('patient')
  async getPatientRecords(@Request() req) {
    return this.medicalRecordsService.getPatientRecords(req.user.patientId);
  }

  @Get('patient/type/:type')
  async getPatientRecordsByType(@Request() req, @Param('type') type: RecordType) {
    return this.medicalRecordsService.getPatientRecordsByType(req.user.patientId, type);
  }

  @Get(':id')
  async getMedicalRecordById(@Param('id') id: string) {
    return this.medicalRecordsService.getMedicalRecordById(id);
  }

  @Put(':id')
  async updateMedicalRecord(@Param('id') id: string, @Body() data: any) {
    return this.medicalRecordsService.updateMedicalRecord(id, data);
  }

  @Get('patient/export/fhir')
  async exportPatientRecordsFHIR(@Request() req) {
    return this.medicalRecordsService.exportPatientRecordsFHIR(req.user.patientId);
  }
}
