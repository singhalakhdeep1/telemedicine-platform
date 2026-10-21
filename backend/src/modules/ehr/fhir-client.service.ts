import { Injectable } from '@nestjs/common';

@Injectable()
export class FhirClientService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.FHIR_SERVER_URL || 'https://hapi.fhir.org/baseR4';
  }

  private async fhirFetch(path: string, options: RequestInit = {}) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/fhir+json', ...options.headers },
    });
    if (!res.ok) throw new Error(`FHIR error: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async createPatient(patientData: any) {
    return this.fhirFetch('/Patient', {
      method: 'POST',
      body: JSON.stringify({ resourceType: 'Patient', ...patientData }),
    });
  }

  async getPatient(fhirId: string) {
    return this.fhirFetch(`/Patient/${fhirId}`);
  }

  async searchPatient(identifier: string) {
    return this.fhirFetch(`/Patient?identifier=${encodeURIComponent(identifier)}`);
  }

  async createObservation(observationData: any) {
    return this.fhirFetch('/Observation', {
      method: 'POST',
      body: JSON.stringify({ resourceType: 'Observation', ...observationData }),
    });
  }

  async getPatientObservations(patientFhirId: string) {
    return this.fhirFetch(`/Observation?subject=Patient/${patientFhirId}`);
  }

  async createCondition(conditionData: any) {
    return this.fhirFetch('/Condition', {
      method: 'POST',
      body: JSON.stringify({ resourceType: 'Condition', ...conditionData }),
    });
  }

  async createMedicationRequest(medicationData: any) {
    return this.fhirFetch('/MedicationRequest', {
      method: 'POST',
      body: JSON.stringify({ resourceType: 'MedicationRequest', ...medicationData }),
    });
  }

  async exportPatientBundle(patientFhirId: string) {
    const [patient, observations, conditions] = await Promise.all([
      this.getPatient(patientFhirId),
      this.getPatientObservations(patientFhirId),
      this.fhirFetch(`/Condition?subject=Patient/${patientFhirId}`),
    ]);

    return {
      resourceType: 'Bundle',
      type: 'collection',
      entry: [
        { resource: patient },
        ...(observations.entry || []),
        ...(conditions.entry || []),
      ],
    };
  }
}
