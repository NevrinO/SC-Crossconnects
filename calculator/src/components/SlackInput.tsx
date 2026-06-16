import { CONSTANTS } from '../lib/constants';
import { TooltipIcon } from './TooltipIcon';

interface SlackInputProps {
  value: number;
  onChange: (value: number) => void;
}

export default function SlackInput({ value, onChange }: SlackInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <label htmlFor="slack" className="text-sm font-medium text-gray-700">
          Slack (ft)
        </label>
        <TooltipIcon content="Extra feet added to the calculated length for service loops, dressing, or drops to lower U-positions. 0 = tight run." />
      </div>
      <input
        id="slack"
        type="number"
        min={0}
        max={CONSTANTS.MAX_SLACK}
        value={value}
        onChange={(e) => {
          const val = parseFloat(e.target.value);
          onChange(isNaN(val) ? 0 : Math.min(CONSTANTS.MAX_SLACK, Math.max(0, val)));
        }}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <span className="text-xs text-gray-500">Add extra length if needed.</span>
    </div>
  );
}
