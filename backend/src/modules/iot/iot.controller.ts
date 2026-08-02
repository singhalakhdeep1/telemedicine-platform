import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { IoTService } from './iot.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, DeviceStatus, VitalSignType } from '@prisma/client';

@Controller('iot')
@UseGuards(JwtAuthGuard)
export class IoTController {
  constructor(private iotService: IoTService) {}

  @Post('devices')
  async registerDevice(@Request() req, @Body() data: any) {
    return this.iotService.registerDevice(req.user.patientId, data);
  }

  @Get('devices')
  async getPatientDevices(@Request() req) {
    return this.iotService.getPatientDevices(req.user.patientId);
  }

  @Get('devices/:id')
  async getDevice(@Param('id') id: string) {
    return this.iotService.getDevice(id);
  }

  @Put('devices/:id/status')
  async updateDeviceStatus(
    @Param('id') id: string,
    @Body() data: { status: DeviceStatus },
  ) {
    return this.iotService.updateDeviceStatus(id, data.status);
  }

  @Post('vital-signs')
  async recordVitalSign(@Body() data: any) {
    return this.iotService.recordVitalSign(data.deviceId, data);
  }

  @Get('vital-signs')
  async getPatientVitalSigns(
    @Request() req,
    @Param('type') type?: VitalSignType,
    @Param('startDate') startDate?: string,
    @Param('endDate') endDate?: string,
  ) {
    return this.iotService.getPatientVitalSigns(
      req.user.patientId,
      type,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('alerts')
  async getPatientAlerts(@Request() req, @Param('acknowledged') acknowledged?: string) {
    return this.iotService.getPatientAlerts(
      req.user.patientId,
      acknowledged === 'true' ? true : acknowledged === 'false' ? false : undefined,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.DOCTOR)
  @Put('alerts/:id/acknowledge')
  async acknowledgeAlert(@Param('id') id: string, @Request() req) {
    return this.iotService.acknowledgeAlert(id, req.user.doctorId);
  }
}
