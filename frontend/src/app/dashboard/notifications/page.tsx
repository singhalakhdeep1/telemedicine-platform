'use client';

import { useState } from 'react';
import Link from 'next/link';
import NotificationsPanel from '@/components/NotificationsPanel';

export default function NotificationsPage() {
  const [open, setOpen] = useState(true);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
      <h1 className="text-2xl font-bold mt-1 mb-6">Notifications</h1>
      <div className="relative">
        <NotificationsPanel isOpen={open} onClose={() => setOpen(false)} />
        {!open && (
          <button onClick={() => setOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
            Show Notifications
          </button>
        )}
      </div>
    </div>
  );
}
