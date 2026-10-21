'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import type { Doctor } from '@/types';

export default function BookAppointmentPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [form, setForm] = useState({
    doctorId: '',
    scheduledAt: '',
    duration: 30,
    reason: '',
    symptoms: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [spec, setSpec] = useState('');

  useEffect(() => {
    api.get<Doctor[]>('/users/doctors').then(setDoctors).catch(() => {});
  }, []);

  const filtered = doctors.filter((d) => {
    const name = `${d.firstName} ${d.lastName}`.toLowerCase();
    return (!search || name.includes(search.toLowerCase())) &&
           (!spec || d.specialization === spec);
  });

  const specializations = [...new Set(doctors.map((d) => d.specialization))];

  const selectDoctor = (d: Doctor) => {
    setSelectedDoctor(d);
    setForm((f) => ({ ...f, doctorId: d.id }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.patientId) { setError('Patient profile required'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/appointments', {
        ...form,
        userId: user.id,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
      });
      router.push('/dashboard/appointments');
    } catch (err: any) {
      setError(err.data?.message || err.message || 'Failed to book appointment');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/dashboard/appointments" className="text-sm text-blue-600 hover:underline">← Appointments</Link>
      <h1 className="text-2xl font-bold mt-1 mb-6">Book an Appointment</h1>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Doctor selection */}
        <div>
          <h2 className="text-lg font-semibold mb-4">1. Choose a Doctor</h2>
          <div className="space-y-3 mb-4">
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
            <select
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">All specializations</option>
              {specializations.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {filtered.map((d) => (
              <div
                key={d.id}
                onClick={() => selectDoctor(d)}
                className={`p-4 border-2 rounded-xl cursor-pointer transition ${
                  selectedDoctor?.id === d.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">Dr. {d.firstName} {d.lastName}</p>
                    <p className="text-sm text-gray-500">{d.specialization?.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-400">{d.experience} yrs experience</p>
                  </div>
                  <p className="text-blue-600 font-semibold">${d.consultationFee}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Appointment details */}
        <div>
          <h2 className="text-lg font-semibold mb-4">2. Appointment Details</h2>
          {error && <p className="text-red-600 text-sm mb-3 bg-red-50 px-3 py-2 rounded">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date & Time</label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Duration (minutes)</label>
              <select
                value={form.duration}
                onChange={(e) => setForm((f) => ({ ...f, duration: +e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Reason for visit</label>
              <input
                type="text"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="e.g., Annual checkup"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Symptoms (optional)</label>
              <textarea
                value={form.symptoms}
                onChange={(e) => setForm((f) => ({ ...f, symptoms: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                rows={3}
                placeholder="Describe your symptoms..."
              />
            </div>
            <button
              type="submit"
              disabled={!selectedDoctor || !form.scheduledAt || loading}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Booking...' : `Book with Dr. ${selectedDoctor ? `${selectedDoctor.firstName} ${selectedDoctor.lastName}` : '...'}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
