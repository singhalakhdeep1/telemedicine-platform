import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordType } from '@prisma/client';

@Injectable()
export class MedicalRecordsService {
  constructor(private prisma: PrismaService) {}

  async createMedicalRecord(doctorId: string, patientId: string, data: any) {
    // Create FHIR-compliant resource
    const fhirResource = this.createFHIRResource(data.recordType, data);

    return this.prisma.medicalRecord.create({
      data: {
        patientId,
        doctorId,
        recordType: data.recordType,
        title: data.title,
        description: data.description,
        fhirResource,
        attachments: data.attachments || [],
      },
      include: {
        patient: { include: { user: true } },
        doctor: { include: { user: true } },
      },
    });
  }

  async getPatientRecords(patientId: string) {
    return this.prisma.medicalRecord.findMany({
      where: { patientId },
      include: {
        doctor: { include: { user: true } },
      },
      orderBy: { recordedAt: 'desc' },
    });
  }

  async getPatientRecordsByType(patientId: string, recordType: RecordType) {
    return this.prisma.medicalRecord.findMany({
      where: { patientId, recordType },
      include: {
        doctor: { include: { user: true } },
      },
      orderBy: { recordedAt: 'desc' },
    });
  }

  async getMedicalRecordById(recordId: string) {
    return this.prisma.medicalRecord.findUnique({
      where: { id: recordId },
      include: {
        patient: { include: { user: true } },
        doctor: { include: { user: true } },
      },
    });
  }

  async updateMedicalRecord(recordId: string, data: any) {
    const existingRecord = await this.prisma.medicalRecord.findUnique({
      where: { id: recordId },
    });

    if (!existingRecord) {
      throw new NotFoundException('Medical record not found');
    }

    // Update FHIR resource
    const updatedFhirResource = this.createFHIRResource(
      data.recordType || existingRecord.recordType,
      data,
    );

    return this.prisma.medicalRecord.update({
      where: { id: recordId },
      data: {
        title: data.title,
        description: data.description,
        fhirResource: updatedFhirResource,
        attachments: data.attachments,
      },
    });
  }

  async exportPatientRecordsFHIR(patientId: string) {
    const records = await this.prisma.medicalRecord.findMany({
      where: { patientId },
    });

    // Create FHIR Bundle
    const fhirBundle = {
      resourceType: 'Bundle',
      type: 'collection',
      entry: records.map((record) => ({
        resource: record.fhirResource,
      })),
    };

    return fhirBundle;
  }

  private createFHIRResource(recordType: RecordType, data: any): any {
    const baseResource = {
      resourceType: this.getFHIRResourceType(recordType),
      id: crypto.randomUUID(),
      status: 'final',
      subject: {
        reference: `Patient/${data.patientId}`,
      },
      author: {
        reference: `Practitioner/${data.doctorId}`,
      },
      date: new Date().toISOString(),
    };

    switch (recordType) {
      case RecordType.DIAGNOSIS:
        return {
          ...baseResource,
          resourceType: 'Condition',
          code: {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: data.code || 'unknown',
                display: data.title,
              },
            ],
          },
        };

      case RecordType.LAB_RESULT:
        return {
          ...baseResource,
          resourceType: 'Observation',
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: data.code || 'unknown',
                display: data.title,
              },
            ],
          },
          valueQuantity: data.valueQuantity,
        };

      case RecordType.VITAL_SIGNS:
        return {
          ...baseResource,
          resourceType: 'Observation',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                  display: 'Vital Signs',
                },
              ],
            },
          ],
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: data.code || 'unknown',
                display: data.title,
              },
            ],
          },
          valueQuantity: data.valueQuantity,
        };

      default:
        return {
          ...baseResource,
          text: {
            status: 'generated',
            div: `<div>${data.description}</div>`,
          },
        };
    }
  }

  private getFHIRResourceType(recordType: RecordType): string {
    const typeMap = {
      [RecordType.DIAGNOSIS]: 'Condition',
      [RecordType.LAB_RESULT]: 'Observation',
      [RecordType.IMAGING]: 'ImagingStudy',
      [RecordType.VITAL_SIGNS]: 'Observation',
      [RecordType.PROCEDURE]: 'Procedure',
      [RecordType.ALLERGY]: 'AllergyIntolerance',
      [RecordType.MEDICATION_HISTORY]: 'MedicationStatement',
      [RecordType.DISCHARGE_SUMMARY]: 'Composition',
    };
    return typeMap[recordType] || 'DocumentReference';
  }
}
