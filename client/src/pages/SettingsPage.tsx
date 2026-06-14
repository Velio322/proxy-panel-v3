import { Settings } from 'lucide-react';

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">System configuration</p>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        <Settings size={48} className="mx-auto text-gray-700 mb-4" />
        <h3 className="text-lg font-medium text-gray-400">Settings page</h3>
        <p className="text-sm text-gray-600 mt-1">System settings, i18n, white-label, backups</p>
      </div>
    </div>
  );
}
