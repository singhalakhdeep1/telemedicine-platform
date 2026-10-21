import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'), {
      apiVersion: '2023-10-16',
    });
  }

  async createPaymentIntent(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { doctor: true },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    const amount = Number(appointment.doctor.consultationFee) * 100; // Convert to cents

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata: { appointmentId },
    });

    // Create payment record
    await this.prisma.payment.create({
      data: {
        appointmentId,
        amount: appointment.doctor.consultationFee,
        currency: 'USD',
        stripePaymentId: paymentIntent.id,
        status: PaymentStatus.PENDING,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      amount: appointment.doctor.consultationFee,
    };
  }

  async confirmPayment(paymentIntentId: string) {
    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

    const payment = await this.prisma.payment.findUnique({
      where: { stripePaymentId: paymentIntentId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const status =
      paymentIntent.status === 'succeeded'
        ? PaymentStatus.COMPLETED
        : PaymentStatus.FAILED;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status },
    });

    return payment;
  }

  async getPaymentByAppointment(appointmentId: string) {
    return this.prisma.payment.findUnique({
      where: { appointmentId },
    });
  }

  async refundPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.stripePaymentId) {
      await this.stripe.refunds.create({
        payment_intent: payment.stripePaymentId,
      });
    }

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.REFUNDED },
    });

    return payment;
  }
}
