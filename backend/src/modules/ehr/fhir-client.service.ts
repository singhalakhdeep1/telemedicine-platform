import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class FhirClientService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.FHIR_SERVER_URL || 'https://hapi.fhir.org/baseR4';
  }

  async createPatient(patientData: any) {
    try {
      const response = await axios.post(`${this.baseUrl}/Patient`, {
        resourceType: 'Patient',
        ...patientData,
      });
      return response.data;
    } catch (error) {
      throw new Error(`FHIR error: ${error.message}`);
    }
  }

  async getPatient(fhirId: string) {
    try {
      const response = await axios.get(`${this.baseUrl}/Patient/${fhirId}`);
      return response.data;
    } catch (error) {
      throw new Error(`FHIR error: ${error.message}`);
    }
  }

  async searchPatient(identifier: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/Patient?identifier=${identifier}`,
      );
      return response.data;
    } catch (error) {
      throw new Error(`FHIR error: ${error.message}`);
    }
  }

  async createObservation(observationData: any) {
    try {
      const response = await axios.post(`${this.baseUrl}/Observation`, {
        resourceType: 'Observation',
        ...observationData,
      });
      return response.data;
    } catch (error) {
      throw new Error(`FHIR error: ${error.message}`);
    }
  }

  async getPatientObservations(patientFhirId: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/Observation?subject=Patient/${patientFhirId}`,
      );
      return response.data;
    } catch (error) {
      throw new Error(`FHIR error: ${error.message}`);
    }
  }

  async createCondition(conditionData: any) {
    try {
      const response = await axios.post(`${this.baseUrl}/Condition`, {
        resourceType: 'Condition',
        ...conditionData,
      });
      return response.data;
    } catch (error) {
      throw new Error(`FHIR error: ${error.message}`);
    }
  }

  async createMedicationRequest(medicationData: any) {
    try {
      const response = await axios.post(`${this.baseUrl}/MedicationRequest`, {
        resourceType: 'MedicationRequest',
        ...medicationData,
      });
      return response.data;
    } catch (error) {
      throw new Error(`FHIR error: ${error.message}`);
    }
  }

  async exportPatientBundle(patientFhirId: string) {
    try {
      const [patient, observations, conditions] = await Promise.all([
        this.getPatient(patientFhirId),
        this.getPatientObservations(patientFhirId),
        axios.get(`${this.baseUrl}/Condition?subject=Patient/${patientFhirId}`),
      ]);

      return {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
          { resource: patient.data },
          ...(observations.data.entry || []),
          ...(conditions.data.entry || []),
        ],
      };
    } catch (error) {
      throw new Error(`FHIR error: ${error.message}`);
    }
  }
}
