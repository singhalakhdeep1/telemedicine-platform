'use client';

import type { MedicalRecord } from '@/types';

interface MedicalRecordsViewerProps {
  records: MedicalRecord[];
}

export default function MedicalRecordsViewer({ records }: MedicalRecordsViewerProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Medical Records</h3>
      {records.length === 0 ? (
        <p className="text-gray-500">No records found</p>
      ) : (
        <div className="space-y-4">
          {records.map((record) => (
            <div key={record.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium">{record.title}</h4>
                <span className="text-sm text-gray-500">
                  {new Date(record.recordedAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-2">{record.description}</p>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                  {record.recordType}
                </span>
                <span className="text-sm text-gray-500">
                  Dr. {record.doctor.firstName} {record.doctor.lastName}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
