import type { PathSegment } from '../types/room';

interface PathSelectorProps {
  segments: PathSegment[];
  selectedSegmentId: string | null;
  onSelect: (segmentId: string) => void;
}

export default function PathSelector({ segments, selectedSegmentId, onSelect }: PathSelectorProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="path" className="text-sm font-medium text-gray-700">
        Path
      </label>
      <select
        id="path"
        value={selectedSegmentId ?? ''}
        onChange={(e) => onSelect(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">Select a path...</option>
        {segments.map((seg) => (
          <option key={seg.id} value={seg.id}>
            {seg.name}
          </option>
        ))}
      </select>
      {segments.length === 0 && (
        <span className="text-xs text-gray-500">No paths available for selected room and cable type.</span>
      )}
    </div>
  );
}
