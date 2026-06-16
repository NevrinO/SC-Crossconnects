import { useState } from 'react';
import { X } from 'lucide-react';
import { KEYBOARD_SHORTCUTS } from '../constants/shortcuts';

type Tab = 'quick-start' | 'cabinet-ids' | 'paths-trays' | 'shortcuts';

export function HelpModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('quick-start');

  if (!isOpen) return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'quick-start', label: 'Quick Start' },
    { id: 'cabinet-ids', label: 'Cabinet IDs' },
    { id: 'paths-trays', label: 'Paths & Trays' },
    { id: 'shortcuts', label: 'Keyboard Shortcuts' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Help</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {activeTab === 'quick-start' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">What is this?</h3>
              <p className="text-gray-700 dark:text-gray-300">
                The Cross Connect Calculator helps you calculate cable lengths for rack-to-rack connections in data center rooms. It accounts for tray routes, cable type, and physical cabinet positions.
              </p>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-6">Workflow</h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
                <li>Select a room from the dropdown</li>
                <li>Enter the Starting and Ending Rack IDs</li>
                <li>Pick a cable type (Fiber or Copper)</li>
                <li>Select a path from the suggested routes</li>
                <li>Click Calculate to see the cable length</li>
              </ol>
            </div>
          )}

          {activeTab === 'cabinet-ids' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cabinet ID Format</h3>
              <p className="text-gray-700 dark:text-gray-300">
                Cabinet IDs follow a standard format that indicates their position and type within the room.
              </p>
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 font-semibold text-gray-900 dark:text-gray-100">Format</th>
                    <th className="py-2 font-semibold text-gray-900 dark:text-gray-100">Description</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-gray-300">
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 font-mono">AB123</td>
                    <td className="py-2">Standard full cabinet</td>
                  </tr>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 font-mono">AB123A</td>
                    <td className="py-2">Half-cabinet, A-side</td>
                  </tr>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 font-mono">AB123B</td>
                    <td className="py-2">Half-cabinet, B-side</td>
                  </tr>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 font-mono">AB123A–D</td>
                    <td className="py-2">Quarter-cabinet (A, B, C, or D)</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-mono">AB123</td>
                    <td className="py-2">Network rack (detected automatically)</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
                Suffixes affect the length calculation by adjusting the entry point on the cabinet.
              </p>
            </div>
          )}

          {activeTab === 'paths-trays' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Trays & Ladder Racks</h3>
              <p className="text-gray-700 dark:text-gray-300">
                Trays are the physical cable pathways that run above the cabinets. The calculator uses the tray layout to determine the most efficient route between racks.
              </p>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-6">Fiber South / North</h3>
              <p className="text-gray-700 dark:text-gray-300">
                These refer to the primary tray directions in the room layout. "Fiber South" typically runs along the lower tray level, while "North" may indicate an upper or alternate route.
              </p>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-6">Distance Types</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
                <li><strong>Tray distance:</strong> Length along the cable tray path</li>
                <li><strong>Overhead:</strong> Vertical drop/rise from tray to cabinet</li>
                <li><strong>Entry spillover:</strong> Horizontal distance from tray entry point to cabinet U-position</li>
              </ul>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-6">Turns</h3>
              <p className="text-gray-700 dark:text-gray-300">
                Each time the path changes direction (horizontal to vertical or vice versa), a "turn" is counted. More turns mean a longer, more complex route.
              </p>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Keyboard Shortcuts</h3>
              <div className="space-y-2">
                {KEYBOARD_SHORTCUTS.map((shortcut) => (
                  <div key={shortcut.key} className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono">
                      {shortcut.key}
                    </kbd>
                    <span>{shortcut.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Press <kbd className="px-1 bg-gray-200 dark:bg-gray-700 rounded">Esc</kbd> or click outside to close
          </p>
        </div>
      </div>
    </div>
  );
}
