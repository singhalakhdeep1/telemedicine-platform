'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';

interface EHRConnection {
  id: string;
  system: string;
  systemName: string;
  status: string;
  lastSyncAt: string;
  syncFrequency: string;
}

interface SyncLog {
  id: string;
  type: string;
  status: string;
  recordsCount: number;
  startedAt: string;
  completedAt: string;
  errorMessage?: string;
}

interface EHRConnectionUIProps {
  patientId: string;
}

export default function EHRConnectionUI({ patientId }: EHRConnectionUIProps) {
  const [connections, setConnections] = useState<EHRConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<EHRConnection | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [showNewConnection, setShowNewConnection] = useState(false);
  const [newConnection, setNewConnection] = useState({
    system: 'EPIC',
    systemName: '',
    syncFrequency: 'daily',
  });

  useEffect(() => {
    fetchConnections();
  }, [patientId]);

  const fetchConnections = async () => {
    try {
      const res = await api.get<EHRConnection[]>('/ehr/connections');
      setConnections(res);
    } catch (error) {
      console.error('Failed to fetch EHR connections');
    }
  };

  const handleCreateConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/ehr/connections', {
        ...newConnection,
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        gender: 'MALE',
        email: 'patient@example.com',
        phone: '+1234567890',
      });
      setShowNewConnection(false);
      fetchConnections();
    } catch (error) {
      console.error('Failed to create EHR connection');
    }
  };

  const handleSync = async (connectionId: string) => {
    try {
      await api.post(`/ehr/connections/${connectionId}/sync`);
      if (selectedConnection?.id === connectionId) {
        fetchSyncLogs(connectionId);
      }
    } catch (error) {
      console.error('Failed to sync data');
    }
  };

  const handleImport = async (connectionId: string) => {
    try {
      await api.post(`/ehr/connections/${connectionId}/import`);
      if (selectedConnection?.id === connectionId) {
        fetchSyncLogs(connectionId);
      }
    } catch (error) {
      console.error('Failed to import data');
    }
  };

  const fetchSyncLogs = async (connectionId: string) => {
    try {
      const res = await api.get<SyncLog[]>(`/ehr/connections/${connectionId}/logs`);
      setSyncLogs(res);
    } catch (error) {
      console.error('Failed to fetch sync logs');
    }
  };

  const selectConnection = (connection: EHRConnection) => {
    setSelectedConnection(connection);
    fetchSyncLogs(connection.id);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: 'bg-green-500',
      PENDING: 'bg-yellow-500',
      ERROR: 'bg-red-500',
      REVOKED: 'bg-gray-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">EHR/FHIR Connections</h2>
        <button
          onClick={() => setShowNewConnection(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          + Add Connection
        </button>
      </div>

      {showNewConnection && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Connect to EHR System</h3>
          <form onSubmit={handleCreateConnection} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">EHR System</label>
              <select
                value={newConnection.system}
                onChange={(e) => setNewConnection({ ...newConnection, system: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="EPIC">Epic</option>
                <option value="CERNER">Cerner</option>
                <option value="ALLSCRIPTS">Allscripts</option>
                <option value="ATHENAHEALTH">Athenahealth</option>
                <option value="ECLINICALWORKS">eClinicalWorks</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">System Name</label>
              <input
                type="text"
                value={newConnection.systemName}
                onChange={(e) => setNewConnection({ ...newConnection, systemName: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="e.g., Mayo Clinic Epic"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sync Frequency</label>
              <select
                value={newConnection.syncFrequency}
                onChange={(e) => setNewConnection({ ...newConnection, syncFrequency: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Connect
              </button>
              <button
                type="button"
                onClick={() => setShowNewConnection(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connections List */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Your Connections</h3>
          {connections.length === 0 ? (
            <p className="text-gray-500">No EHR connections</p>
          ) : (
            <div className="space-y-3">
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  onClick={() => selectConnection(conn)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                    selectedConnection?.id === conn.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{conn.systemName}</h4>
                      <p className="text-sm text-gray-600">{conn.system}</p>
                    </div>
                    <span className={`w-3 h-3 rounded-full ${getStatusColor(conn.status)}`} />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Last sync: {conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString() : 'Never'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connection Details */}
        {selectedConnection && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">{selectedConnection.systemName}</h3>
            <div className="space-y-4 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600">System:</span>
                <span className="font-medium">{selectedConnection.system}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className={`font-medium ${selectedConnection.status === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedConnection.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sync Frequency:</span>
                <span className="font-medium">{selectedConnection.syncFrequency}</span>
              </div>
            </div>

            <div className="flex gap-2 mb-6">
              <button
                onClick={() => handleSync(selectedConnection.id)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Sync to EHR
              </button>
              <button
                onClick={() => handleImport(selectedConnection.id)}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Import from EHR
              </button>
            </div>

            <div>
              <h4 className="font-medium mb-2">Sync History</h4>
              {syncLogs.length === 0 ? (
                <p className="text-sm text-gray-500">No sync history</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {syncLogs.map((log) => (
                    <div key={log.id} className="text-sm p-2 bg-gray-50 rounded">
                      <div className="flex justify-between">
                        <span className="font-medium">{log.type}</span>
                        <span className={`${
                          log.status === 'SUCCESS' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {log.status}
                        </span>
                      </div>
                      <p className="text-gray-600">Records: {log.recordsCount}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(log.startedAt).toLocaleString()}
                      </p>
                      {log.errorMessage && (
                        <p className="text-xs text-red-600">{log.errorMessage}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
