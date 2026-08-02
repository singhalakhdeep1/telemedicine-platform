import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, AppointmentStatus } from '@prisma/client';

@Controller('appointments')
@UseGuards(JwtAuthGuard)
export class AppointmentsController {
  constructor(private appointmentsService: AppointmentsService) {}

  @Post()
  async createAppointment(@Request() req, @Body() data: any) {
    return this.appointmentsService.createAppointment(req.user.patientId, {
      ...data,
      userId: req.user.id,
    });
  }

  @Get('patient')
  async getPatientAppointments(@Request() req) {
    return this.appointmentsService.getPatientAppointments(req.user.patientId);
  }

  @Get('doctor')
  async getDoctorAppointments(@Request() req) {
    return this.appointmentsService.getDoctorAppointments(req.user.doctorId);
  }

  @Get(':id')
  async getAppointmentById(@Param('id') id: string) {
    return this.appointmentsService.getAppointmentById(id);
  }

  @Put(':id/status')
  async updateAppointmentStatus(
    @Param('id') id: string,
    @Body() data: { status: AppointmentStatus },
  ) {
    return this.appointmentsService.updateAppointmentStatus(id, data.status);
  }

  @Get('doctor/:doctorId/availability')
  async getDoctorAvailability(
    @Param('doctorId') doctorId: string,
    @Body() data: { date: string },
  ) {
    return this.appointmentsService.getDoctorAvailability(doctorId, new Date(data.date));
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.DOCTOR)
  @Put('doctor/availability')
  async setDoctorAvailability(@Request() req, @Body() data: { slots: any[] }) {
    return this.appointmentsService.setDoctorAvailability(req.user.doctorId, data.slots);
  }
}
