'use client';

import { Settings, Server, ShieldCheck, Database } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-10">
        <Settings className="w-8 h-8 text-gray-700 dark:text-gray-300" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
      </div>

      <div className="space-y-6">
        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Server className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">AI Configuration</h2>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-700">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Local Broker URL</p>
                <p className="text-sm text-gray-500">http://localhost:9090</p>
              </div>
              <span className="px-2 py-1 text-xs font-bold bg-green-100 text-green-700 rounded">Active</span>
            </div>

            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Ollama Model</p>
                <p className="text-sm text-gray-500">qwen2.5:1.5b</p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Database className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Data Store</h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Connected to Qdrant Cloud (managed e5-small) and Supabase (PostgreSQL).
          </p>
        </section>
      </div>
    </div>
  );
}
