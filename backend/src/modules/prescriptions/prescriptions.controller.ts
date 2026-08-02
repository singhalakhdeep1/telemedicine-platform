import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, PrescriptionStatus } from '@prisma/client';

@Controller('prescriptions')
@UseGuards(JwtAuthGuard)
export class PrescriptionsController {
  constructor(private prescriptionsService: PrescriptionsService) {}

  @Post()
  async createPrescription(@Request() req, @Body() data: any) {
    return this.prescriptionsService.createPrescription(
      req.user.doctorId,
      req.user.patientId,
      data,
    );
  }

  @Get('patient')
  async getPatientPrescriptions(@Request() req) {
    return this.prescriptionsService.getPatientPrescriptions(req.user.patientId);
  }

  @Get('doctor')
  async getDoctorPrescriptions(@Request() req) {
    return this.prescriptionsService.getDoctorPrescriptions(req.user.doctorId);
  }

  @Get(':id')
  async getPrescriptionById(@Param('id') id: string) {
    return this.prescriptionsService.getPrescriptionById(id);
  }

  @Put(':id/status')
  async updatePrescriptionStatus(
    @Param('id') id: string,
    @Body() data: { status: PrescriptionStatus },
  ) {
    return this.prescriptionsService.updatePrescriptionStatus(id, data.status);
  }

  @Post(':id/drugs')
  async addDrugToPrescription(@Param('id') id: string, @Body() data: any) {
    return this.prescriptionsService.addDrugToPrescription(id, data);
  }
}
