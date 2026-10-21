'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get<any>('/users/profile').then((data) => {
      setProfile(data);
      setForm(data);
    }).catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const path = user?.role === 'PATIENT' ? '/users/patient/profile' : '/users/doctor/profile';
      const updated = await api.put<any>(path, form);
      setProfile(updated);
      setEditing(false);
      setMsg('Profile updated successfully');
      setTimeout(() => setMsg(''), 3000);
    } catch (err: any) {
      setMsg(err.data?.message || 'Failed to update profile');
    }
    setSaving(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
      <div className="flex justify-between items-center mt-1 mb-6">
        <h1 className="text-2xl font-bold">Profile</h1>
        {!editing && (
          <button onClick={() => setEditing(true)} className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg text-sm hover:bg-blue-50">
            Edit Profile
          </button>
        )}
      </div>

      {msg && <p className={`mb-4 px-3 py-2 rounded text-sm ${msg.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg}</p>}

      {!profile ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>
      ) : editing ? (
        <form onSubmit={handleSave} className="bg-white rounded-xl shadow p-6 space-y-4">
          {['firstName', 'lastName', 'phone', 'address'].map((field) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1 capitalize">{field.replace(/([A-Z])/g, ' $1')}</label>
              <input
                type="text"
                value={form[field] ?? ''}
                onChange={(e) => setForm((f: any) => ({ ...f, [field]: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          ))}
          {user?.role === 'PATIENT' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Blood Type</label>
                <select value={form.bloodType ?? ''} onChange={(e) => setForm((f: any) => ({ ...f, bloodType: e.target.value }))} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">Unknown</option>
                  {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Emergency Contact</label>
                <input type="text" value={form.emergencyContact ?? ''} onChange={(e) => setForm((f: any) => ({ ...f, emergencyContact: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" placeholder="Name & phone number" />
              </div>
            </>
          )}
          {user?.role === 'DOCTOR' && (
            <div>
              <label className="block text-sm font-medium mb-1">Bio</label>
              <textarea value={form.bio ?? ''} onChange={(e) => setForm((f: any) => ({ ...f, bio: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" rows={3} />
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="px-6 py-2 border rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-2xl font-bold">
              {profile.firstName?.[0]}{profile.lastName?.[0]}
            </div>
            <div>
              <h2 className="text-xl font-semibold">{profile.firstName} {profile.lastName}</h2>
              <p className="text-gray-500 text-sm">{user?.email}</p>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{user?.role}</span>
            </div>
          </div>
          <dl className="space-y-3">
            {[
              { label: 'Phone', value: profile.phone },
              { label: 'Address', value: profile.address },
              ...(user?.role === 'PATIENT' ? [
                { label: 'Blood Type', value: profile.bloodType },
                { label: 'Date of Birth', value: profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString() : null },
                { label: 'Emergency Contact', value: profile.emergencyContact },
              ] : []),
              ...(user?.role === 'DOCTOR' ? [
                { label: 'Specialization', value: profile.specialization?.replace(/_/g, ' ') },
                { label: 'Experience', value: profile.experience ? `${profile.experience} years` : null },
                { label: 'Consultation Fee', value: profile.consultationFee ? `$${profile.consultationFee}` : null },
                { label: 'License Number', value: profile.licenseNumber },
                { label: 'Bio', value: profile.bio },
              ] : []),
            ].filter((f) => f.value).map((f) => (
              <div key={f.label} className="flex justify-between items-baseline">
                <dt className="text-sm text-gray-500 w-40">{f.label}</dt>
                <dd className="text-sm font-medium text-gray-900 flex-1">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
