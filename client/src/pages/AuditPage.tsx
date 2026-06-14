import { useQuery } from '@tanstack/react-query';
import { auditApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { FileText, Loader2 } from 'lucide-react';

export function AuditPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['audit'],
    queryFn: () => auditApi.getAll({ limit: 50 }).then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <p className="text-sm text-gray-400 mt-1">Track all admin actions</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48"><Loader2 size={24} className="animate-spin text-purple-500" /></div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Action</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Resource</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">IP</th>
              </tr>
            </thead>
            <tbody>
              {data?.logs?.map((log) => (
                <tr key={log.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3 text-sm text-gray-400">{formatDate(log.createdAt)}</td>
                  <td className="px-4 py-3 text-sm text-gray-200">{log.user?.username || 'System'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                      log.action === 'CREATE' ? 'bg-blue-500/10 text-blue-400' :
                      log.action === 'DELETE' ? 'bg-red-500/10 text-red-400' :
                      log.action === 'LOGIN' ? 'bg-green-500/10 text-green-400' :
                      'bg-gray-800 text-gray-400'
                    }`}>{log.action}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">{log.resource}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono">{log.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
