import { useState, useEffect } from 'react';
import { validateRackLocationInput, getCabType, parseCabinetInput } from '../lib/calculation';
import type { CabinetInfo, Room } from '../types/room';
import { TooltipIcon } from './TooltipIcon';

interface CabinetInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  room: Room | null;
}

export default function CabinetInput({ label, value, onChange, room }: CabinetInputProps) {
  const [cabInfo, setCabInfo] = useState<CabinetInfo | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [baseCabinetId, setBaseCabinetId] = useState<string>('');
  const isValid = validateRackLocationInput(value);

  useEffect(() => {
    if (isValid && room) {
      setCabInfo(getCabType(value, room));
      // Extract base cabinet ID (without suffix/panel) for dropdown lookup
      const parsed = parseCabinetInput(value);
      if (parsed) {
        // The raw field contains the cabinet without port info, but may have suffix
        // We need to extract just the base (x+y) without suffix
        const baseId = parsed.raw.split(':')[0].replace(/[A-D]$/, '');
        // Validate that the extracted base ID exists in the room's cabinet list
        const cabinetExists = room.cabinets?.some(c => c.id === baseId);
        setBaseCabinetId(cabinetExists ? baseId : '');
      }
    } else {
      setCabInfo(null);
      setBaseCabinetId('');
      setShowDropdown(false);
    }
  }, [value, isValid, room]);

  // Find cabinet in room.cabinets array
  const cabinet = room?.cabinets?.find(c => c.id === baseCabinetId);

  // Amendment 6: Show contextual dropdown for special cabinet types
  const shouldShowDropdown = cabinet && (
    cabinet.type === 'network_rack' ||
    cabinet.type === 'half_cab' ||
    cabinet.type === 'quarter_cab'
  );

  const handleDropdownSelect = (selection: string) => {
    if (cabinet?.type === 'network_rack') {
      onChange(`${baseCabinetId}:${selection}`);
    } else if (cabinet?.type === 'half_cab') {
      onChange(`${baseCabinetId}${selection}`);
    } else if (cabinet?.type === 'quarter_cab') {
      onChange(`${baseCabinetId}${selection}`);
    }
    setShowDropdown(false);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <TooltipIcon content="Format: AB123 · Half-cab: AB123A or AB123B · Quarter-cab: AB123A–AB123D · Network rack: same format, detected automatically" />
      </div>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          onFocus={() => shouldShowDropdown && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          placeholder="e.g., AB123 or AB123A or AB123:1:1"
          className={`rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 w-full ${
            value && !isValid
              ? 'border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          }`}
        />
        
        {/* Amendment 6: Contextual dropdown for special cabinet types */}
        {showDropdown && cabinet && (
          <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-300 bg-white shadow-lg">
            {cabinet.type === 'network_rack' && (
              <div className="p-1">
                <div className="px-2 py-1 text-xs text-gray-500">Select panel (1-12)</div>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(panel => (
                  <button
                    key={panel}
                    type="button"
                    onClick={() => handleDropdownSelect(String(panel))}
                    className="block w-full px-3 py-1 text-left text-sm hover:bg-gray-100 rounded"
                  >
                    Panel {panel}
                  </button>
                ))}
              </div>
            )}
            {cabinet.type === 'half_cab' && (
              <div className="p-1">
                <div className="px-2 py-1 text-xs text-gray-500">Select side</div>
                {['A', 'B'].map(side => (
                  <button
                    key={side}
                    type="button"
                    onClick={() => handleDropdownSelect(side)}
                    className="block w-full px-3 py-1 text-left text-sm hover:bg-gray-100 rounded"
                  >
                    Side {side}
                  </button>
                ))}
              </div>
            )}
            {cabinet.type === 'quarter_cab' && (
              <div className="p-1">
                <div className="px-2 py-1 text-xs text-gray-500">Select position</div>
                {['A', 'B', 'C', 'D'].map(pos => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => handleDropdownSelect(pos)}
                    className="block w-full px-3 py-1 text-left text-sm hover:bg-gray-100 rounded"
                  >
                    Position {pos}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
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
