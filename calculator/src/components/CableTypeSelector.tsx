import { TooltipIcon } from './TooltipIcon';

interface CableTypeSelectorProps {
  value: 'fiber' | 'copper' | null;
  onChange: (type: 'fiber' | 'copper') => void;
}

export default function CableTypeSelector({ value, onChange }: CableTypeSelectorProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <label className="text-sm font-medium text-gray-700">Cable Type</label>
        <TooltipIcon content="Fiber = optical fiber runs (lower tray). Copper = copper patch runs (upper tray). Affects which tray height is used in the length calculation." />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange('fiber')}
          className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
            value === 'fiber'
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          Fiber
        </button>
        <button
          type="button"
          onClick={() => onChange('copper')}
          className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
            value === 'copper'
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          Copper
        </button>
      </div>
    </div>
  );
}
