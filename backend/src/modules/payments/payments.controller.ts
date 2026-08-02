import { Controller, Post, Get, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('appointment/:appointmentId/create-intent')
  async createPaymentIntent(@Param('appointmentId') appointmentId: string) {
    return this.paymentsService.createPaymentIntent(appointmentId);
  }

  @Post('confirm')
  async confirmPayment(@Body() data: { paymentIntentId: string }) {
    return this.paymentsService.confirmPayment(data.paymentIntentId);
  }

  @Get('appointment/:appointmentId')
  async getPaymentByAppointment(@Param('appointmentId') appointmentId: string) {
    return this.paymentsService.getPaymentByAppointment(appointmentId);
  }

  @Put(':id/refund')
  async refundPayment(@Param('id') id: string) {
    return this.paymentsService.refundPayment(id);
  }
}
