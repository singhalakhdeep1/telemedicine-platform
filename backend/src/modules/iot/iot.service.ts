import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceType, VitalSignType, DeviceStatus } from '@prisma/client';

@Injectable()
export class IoTService {
  constructor(private prisma: PrismaService) {}

  async registerDevice(patientId: string, data: any) {
    return this.prisma.iotDevice.create({
      data: {
        patientId,
        deviceType: data.deviceType,
        manufacturer: data.manufacturer,
        model: data.model,
        serialNumber: data.serialNumber,
        firmwareVersion: data.firmwareVersion,
        status: DeviceStatus.ACTIVE,
        metadata: data.metadata || {},
      },
    });
  }

  async getPatientDevices(patientId: string) {
    return this.prisma.iotDevice.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDevice(deviceId: string) {
    return this.prisma.iotDevice.findUnique({
      where: { id: deviceId },
      include: { vitalSigns: true },
    });
  }

  async updateDeviceStatus(deviceId: string, status: DeviceStatus) {
    return this.prisma.iotDevice.update({
      where: { id: deviceId },
      data: { status, lastSyncAt: new Date() },
    });
  }

  async recordVitalSign(deviceId: string, data: any) {
    const device = await this.prisma.iotDevice.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Check if value is abnormal
    const { isAbnormal, severity } = this.checkVitalSignNormality(
      data.type,
      data.value,
    );

    const vitalSign = await this.prisma.vitalSign.create({
      data: {
        deviceId,
        patientId: device.patientId,
        type: data.type,
        value: data.value,
        unit: data.unit,
        isAbnormal,
        severity,
      },
    });

    // Create alert if abnormal
    if (isAbnormal) {
      await this.createAlert(device.patientId, vitalSign.id, data);
    }

    // Update device sync time
    await this.prisma.iotDevice.update({
      where: { id: deviceId },
      data: { lastSyncAt: new Date() },
    });

    return vitalSign;
  }

  async getPatientVitalSigns(
    patientId: string,
    type?: VitalSignType,
    startDate?: Date,
    endDate?: Date,
  ) {
    const where: any = { patientId };
    if (type) where.type = type;
    if (startDate || endDate) {
      where.recordedAt = {};
      if (startDate) where.recordedAt.gte = startDate;
      if (endDate) where.recordedAt.lte = endDate;
    }

    return this.prisma.vitalSign.findMany({
      where,
      include: { device: true },
      orderBy: { recordedAt: 'desc' },
      take: 1000,
    });
  }

  async getPatientAlerts(patientId: string, acknowledged?: boolean) {
    const where: any = { patientId };
    if (acknowledged !== undefined) where.acknowledged = acknowledged;

    return this.prisma.vitalSignAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async acknowledgeAlert(alertId: string, doctorId: string) {
    return this.prisma.vitalSignAlert.update({
      where: { id: alertId },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedBy: doctorId,
      },
    });
  }

  private checkVitalSignNormality(type: VitalSignType, value: number) {
    const thresholds = {
      [VitalSignType.BLOOD_PRESSURE_SYSTOLIC]: { min: 90, max: 140 },
      [VitalSignType.BLOOD_PRESSURE_DIASTOLIC]: { min: 60, max: 90 },
      [VitalSignType.HEART_RATE]: { min: 60, max: 100 },
      [VitalSignType.BLOOD_GLUCOSE]: { min: 70, max: 140 },
      [VitalSignType.OXYGEN_SATURATION]: { min: 95, max: 100 },
      [VitalSignType.TEMPERATURE]: { min: 36.1, max: 37.5 },
    };

    const threshold = thresholds[type];
    if (!threshold) return { isAbnormal: false, severity: null };

    if (value < threshold.min) {
      return {
        isAbnormal: true,
        severity: value < threshold.min * 0.8 ? 'HIGH' : 'MEDIUM',
      };
    }
    if (value > threshold.max) {
      return {
        isAbnormal: true,
        severity: value > threshold.max * 1.2 ? 'HIGH' : 'MEDIUM',
      };
    }

    return { isAbnormal: false, severity: null };
  }

  private async createAlert(patientId: string, vitalSignId: string, data: any) {
    const { severity } = this.checkVitalSignNormality(data.type, data.value);
    
    return this.prisma.vitalSignAlert.create({
      data: {
        patientId,
        vitalSignId,
        type: data.type,
        value: data.value,
        threshold: data.threshold || 0,
        severity: severity === 'HIGH' ? 'CRITICAL' : severity,
        message: this.generateAlertMessage(data.type, data.value),
      },
    });
  }

  private generateAlertMessage(type: VitalSignType, value: number): string {
    const messages = {
      [VitalSignType.BLOOD_PRESSURE_SYSTOLIC]: `High blood pressure detected: ${value} mmHg`,
      [VitalSignType.BLOOD_PRESSURE_DIASTOLIC]: `Abnormal diastolic pressure: ${value} mmHg`,
      [VitalSignType.HEART_RATE]: `Abnormal heart rate: ${value} bpm`,
      [VitalSignType.BLOOD_GLUCOSE]: `Abnormal glucose level: ${value} mg/dL`,
      [VitalSignType.OXYGEN_SATURATION]: `Low oxygen saturation: ${value}%`,
      [VitalSignType.TEMPERATURE]: `Abnormal temperature: ${value}°C`,
    };
    return messages[type] || `Abnormal vital sign: ${value}`;
  }
}
