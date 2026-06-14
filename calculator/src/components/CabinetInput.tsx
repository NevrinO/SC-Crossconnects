import { useState, useEffect } from 'react';
import { validateRackLocationInput, getCabType } from '../lib/calculation';
import type { CabinetInfo, Room } from '../types/room';

interface CabinetInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  room: Room | null;
}

export default function CabinetInput({ label, value, onChange, room }: CabinetInputProps) {
  const [cabInfo, setCabInfo] = useState<CabinetInfo | null>(null);
  const isValid = validateRackLocationInput(value);

  useEffect(() => {
    if (isValid && room) {
      setCabInfo(getCabType(value, room));
    } else {
      setCabInfo(null);
    }
  }, [value, isValid, room]);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder="e.g., AB123 or AB123A or AB123:1:1"
        className={`rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
          value && !isValid
            ? 'border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
        }`}
      />
      {value && !isValid && (
        <span className="text-xs text-red-600">Invalid format. Use AB123, AB123A, or AB123:1:1</span>
      )}
      {cabInfo && (
        <span className="text-xs text-gray-500">
          Detected: {cabInfo.type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
          {cabInfo.value && cabInfo.type === 'network_rack' ? ` (panel ${cabInfo.value})` : ''}
          {cabInfo.value && (cabInfo.type === 'half_cab' || cabInfo.type === 'quarter_cab') ? ` (position ${cabInfo.value})` : ''}
        </span>
      )}
    </div>
  );
}
