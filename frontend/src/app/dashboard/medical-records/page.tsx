'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import MedicalRecordsViewer from '@/components/MedicalRecordsViewer';
import type { MedicalRecord } from '@/types';

const TYPES = ['ALL', 'DIAGNOSIS', 'LAB_RESULT', 'IMAGING', 'VITAL_SIGNS', 'PROCEDURE', 'ALLERGY', 'MEDICATION_HISTORY', 'DISCHARGE_SUMMARY'];

export default function MedicalRecordsPage() {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const path = filter === 'ALL' ? '/medical-records/patient' : `/medical-records/patient/type/${filter}`;
    api.get<MedicalRecord[]>(path)
      .then(setRecords)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  const handleExport = async () => {
    try {
      const bundle = await api.get('/medical-records/patient/export/fhir');
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'medical-records-fhir.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
          <h1 className="text-2xl font-bold mt-1">Medical Records</h1>
        </div>
        <button onClick={handleExport} className="px-4 py-2 border border-green-600 text-green-600 rounded-lg text-sm hover:bg-green-50">
          Export FHIR Bundle
        </button>
      </div>

      <div className="flex gap-2 flex-wrap mb-6">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              filter === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t === 'ALL' ? 'All' : t.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>
      ) : (
        <MedicalRecordsViewer records={records} />
      )}
    </div>
  );
}
