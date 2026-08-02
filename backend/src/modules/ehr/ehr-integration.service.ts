import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FhirClientService } from './fhir-client.service';
import { EHRSystem, IntegrationStatus } from '@prisma/client';

@Injectable()
export class EHRIntegrationService {
  constructor(
    private prisma: PrismaService,
    private fhirClient: FhirClientService,
  ) {}

  async createEHRConnection(patientId: string, data: any) {
    // Create FHIR patient
    const fhirPatient = await this.fhirClient.createPatient({
      identifier: [{ system: 'telemedicine', value: patientId }],
      name: [
        {
          given: [data.firstName],
          family: data.lastName,
        },
      ],
      birthDate: data.dateOfBirth,
      gender: data.gender.toLowerCase(),
      telecom: [
        {
          system: 'email',
          value: data.email,
        },
        {
          system: 'phone',
          value: data.phone,
        },
      ],
    });

    return this.prisma.eHRConnection.create({
      data: {
        patientId,
        system: data.system,
        systemName: data.systemName,
        patientIdInEHR: fhirPatient.id,
        status: IntegrationStatus.ACTIVE,
        syncFrequency: data.syncFrequency || 'daily',
        credentials: {
          fhirServerUrl: process.env.FHIR_SERVER_URL,
          fhirPatientId: fhirPatient.id,
        },
      },
    });
  }

  async syncPatientData(connectionId: string) {
    const connection = await this.prisma.eHRConnection.findUnique({
      where: { id: connectionId },
      include: { patient: true },
    });

    if (!connection) {
      throw new NotFoundException('EHR connection not found');
    }

    const syncLog = await this.prisma.eHRSyncLog.create({
      data: {
        connectionId,
        type: 'SYNC',
        status: 'IN_PROGRESS',
        recordsCount: 0,
      },
    });

    try {
      let recordsCount = 0;

      // Sync medical records to FHIR
      const medicalRecords = await this.prisma.medicalRecord.findMany({
        where: { patientId: connection.patientId },
        include: { doctor: true },
      });

      for (const record of medicalRecords) {
        if (record.recordType === 'DIAGNOSIS') {
          await this.fhirClient.createCondition({
            subject: {
              reference: `Patient/${connection.patientIdInEHR}`,
            },
            code: {
              coding: [
                {
                  system: 'http://snomed.info/sct',
                  code: 'unknown',
                  display: record.title,
                },
              ],
            },
            clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
            verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }] },
            recorder: {
              reference: `Practitioner/${connection.patientId}`,
            },
            recordedDate: record.recordedAt.toISOString(),
          });
          recordsCount++;
        }
      }

      await this.prisma.eHRSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'SUCCESS',
          recordsCount,
          completedAt: new Date(),
        },
      });

      await this.prisma.eHRConnection.update({
        where: { id: connectionId },
        data: { lastSyncAt: new Date() },
      });

      return syncLog;
    } catch (error) {
      await this.prisma.eHRSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
          completedAt: new Date(),
        },
      });

      await this.prisma.eHRConnection.update({
        where: { id: connectionId },
        data: { status: IntegrationStatus.ERROR },
      });

      throw error;
    }
  }

  async importFromEHR(connectionId: string) {
    const connection = await this.prisma.eHRConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new NotFoundException('EHR connection not found');
    }

    const syncLog = await this.prisma.eHRSyncLog.create({
      data: {
        connectionId,
        type: 'IMPORT',
        status: 'IN_PROGRESS',
        recordsCount: 0,
      },
    });

    try {
      const bundle = await this.fhirClient.exportPatientBundle(
        connection.patientIdInEHR,
      );

      let recordsCount = 0;

      for (const entry of bundle.entry || []) {
        const resource = entry.resource;

        if (resource.resourceType === 'Condition') {
          await this.prisma.medicalRecord.create({
            data: {
              patientId: connection.patientId,
              doctorId: connection.patientId, // Will need to map to actual doctor
              recordType: 'DIAGNOSIS',
              title: resource.code?.coding?.[0]?.display || 'Imported Condition',
              description: resource.note?.[0]?.text || '',
              fhirResource: resource,
            },
          });
          recordsCount++;
        }
      }

      await this.prisma.eHRSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'SUCCESS',
          recordsCount,
          completedAt: new Date(),
        },
      });

      return syncLog;
    } catch (error) {
      await this.prisma.eHRSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
          completedAt: new Date(),
        },
      });

      throw error;
    }
  }

  async getPatientConnections(patientId: string) {
    return this.prisma.eHRConnection.findMany({
      where: { patientId },
      include: { syncLogs: { take: 10, orderBy: { startedAt: 'desc' } } },
    });
  }

  async getSyncLogs(connectionId: string) {
    return this.prisma.eHRSyncLog.findMany({
      where: { connectionId },
      orderBy: { startedAt: 'desc' },
    });
  }
}
