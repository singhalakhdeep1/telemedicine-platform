'use client';

import type { Prescription } from '@/types';

interface PrescriptionsDisplayProps {
  prescriptions: Prescription[];
}

export default function PrescriptionsDisplay({ prescriptions }: PrescriptionsDisplayProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Prescriptions</h3>
      {prescriptions.length === 0 ? (
        <p className="text-gray-500">No prescriptions found</p>
      ) : (
        <div className="space-y-4">
          {prescriptions.map((rx) => (
            <div key={rx.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium">{rx.diagnosis}</h4>
                <span className={`px-2 py-1 text-xs rounded ${
                  rx.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {rx.status}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-3">{rx.notes}</p>
              <div className="border-t pt-3">
                <p className="text-sm font-medium mb-2">Medications:</p>
                <div className="space-y-2">
                  {rx.drugs.map((drug) => (
                    <div key={drug.id} className="text-sm bg-gray-50 p-2 rounded">
                      <p className="font-medium">{drug.drugName}</p>
                      <p className="text-gray-600">{drug.dosage} - {drug.frequency}</p>
                      <p className="text-gray-500 text-xs">{drug.instructions}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Prescribed by Dr. {rx.doctor.firstName} {rx.doctor.lastName} on {new Date(rx.prescribedAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
