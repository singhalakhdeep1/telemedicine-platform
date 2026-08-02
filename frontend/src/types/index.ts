export interface User {
  id: string;
  email: string;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  status: string;
  patientId?: string;
  doctorId?: string;
}

export interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  specialization: string;
  consultationFee: number;
  experience: number;
  user: {
    email: string;
    status: string;
  };
}

export interface Appointment {
  id: string;
  scheduledAt: string;
  duration: number;
  reason: string;
  symptoms: string;
  status: string;
  doctor: {
    firstName: string;
    lastName: string;
    specialization: string;
  };
}

export interface MedicalRecord {
  id: string;
  recordType: string;
  title: string;
  description: string;
  recordedAt: string;
  doctor: {
    firstName: string;
    lastName: string;
  };
}

export interface Prescription {
  id: string;
  diagnosis: string;
  notes: string;
  prescribedAt: string;
  status: string;
  doctor: {
    firstName: string;
    lastName: string;
  };
  drugs: PrescriptionDrug[];
}

export interface PrescriptionDrug {
  id: string;
  drugName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}
