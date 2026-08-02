import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private configService: ConfigService) {
    this.fromEmail = this.configService.get('SENDGRID_FROM_EMAIL');
    this.fromName = this.configService.get('SENDGRID_FROM_NAME');
  }

  async sendAppointmentReminder(to: string, patientName: string, appointmentDate: Date, doctorName: string): Promise<void> {
    this.logger.log(`Sending appointment reminder to ${to}`);
    
    // Mock implementation - replace with actual SendGrid API call
    const subject = `Appointment Reminder with Dr. ${doctorName}`;
    const html = `
      <h2>Appointment Reminder</h2>
      <p>Dear ${patientName},</p>
      <p>This is a reminder that you have an appointment scheduled with Dr. ${doctorName} on ${appointmentDate.toLocaleString()}.</p>
      <p>Please ensure you are available at the scheduled time.</p>
      <p>Best regards,<br/>Telemedicine Platform</p>
    `;
    
    this.logger.log(`Appointment reminder email sent to ${to}`);
  }

  async sendPrescriptionReady(to: string, patientName: string, prescriptionId: string): Promise<void> {
    this.logger.log(`Sending prescription ready notification to ${to}`);
    
    const subject = 'Your Prescription is Ready';
    const html = `
      <h2>Prescription Ready</h2>
      <p>Dear ${patientName},</p>
      <p>Your prescription (ID: ${prescriptionId}) has been processed and is ready for pickup.</p>
      <p>Please visit your pharmacy to collect your medication.</p>
      <p>Best regards,<br/>Telemedicine Platform</p>
    `;
    
    this.logger.log(`Prescription ready email sent to ${to}`);
  }

  async sendPaymentConfirmation(to: string, patientName: string, amount: number, appointmentId: string): Promise<void> {
    this.logger.log(`Sending payment confirmation to ${to}`);
    
    const subject = 'Payment Confirmation';
    const html = `
      <h2>Payment Confirmation</h2>
      <p>Dear ${patientName},</p>
      <p>Your payment of $${amount.toFixed(2)} for appointment ${appointmentId} has been successfully processed.</p>
      <p>Thank you for using our telemedicine platform.</p>
      <p>Best regards,<br/>Telemedicine Platform</p>
    `;
    
    this.logger.log(`Payment confirmation email sent to ${to}`);
  }

  async sendWelcomeEmail(to: string, patientName: string): Promise<void> {
    this.logger.log(`Sending welcome email to ${to}`);
    
    const subject = 'Welcome to Telemedicine Platform';
    const html = `
      <h2>Welcome to Telemedicine Platform</h2>
      <p>Dear ${patientName},</p>
      <p>Welcome to our telemedicine platform! We're excited to have you on board.</p>
      <p>You can now book appointments with our doctors, access your medical records, and much more.</p>
      <p>If you have any questions, please don't hesitate to contact us.</p>
      <p>Best regards,<br/>Telemedicine Platform</p>
    `;
    
    this.logger.log(`Welcome email sent to ${to}`);
  }
}
