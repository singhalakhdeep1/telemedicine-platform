import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { EmailService } from './email.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('email')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.DOCTOR)
export class EmailController {
  constructor(private emailService: EmailService) {}

  @Post('appointment-reminder')
  async sendAppointmentReminder(@Body() data: { to: string; patientName: string; appointmentDate: string; doctorName: string }) {
    await this.emailService.sendAppointmentReminder(
      data.to,
      data.patientName,
      new Date(data.appointmentDate),
      data.doctorName,
    );
    return { message: 'Appointment reminder sent' };
  }

  @Post('prescription-ready')
  async sendPrescriptionReady(@Body() data: { to: string; patientName: string; prescriptionId: string }) {
    await this.emailService.sendPrescriptionReady(data.to, data.patientName, data.prescriptionId);
    return { message: 'Prescription ready notification sent' };
  }

  @Post('payment-confirmation')
  async sendPaymentConfirmation(@Body() data: { to: string; patientName: string; amount: number; appointmentId: string }) {
    await this.emailService.sendPaymentConfirmation(data.to, data.patientName, data.amount, data.appointmentId);
    return { message: 'Payment confirmation sent' };
  }

  @Post('welcome')
  async sendWelcomeEmail(@Body() data: { to: string; patientName: string }) {
    await this.emailService.sendWelcomeEmail(data.to, data.patientName);
    return { message: 'Welcome email sent' };
  }
}
