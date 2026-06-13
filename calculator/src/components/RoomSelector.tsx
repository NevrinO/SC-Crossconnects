import type { Room } from '../types/room';

interface RoomSelectorProps {
  rooms: Room[];
  selectedRoomId: string | null;
  onSelect: (roomId: string) => void;
}

export default function RoomSelector({ rooms, selectedRoomId, onSelect }: RoomSelectorProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="room" className="text-sm font-medium text-gray-700">
        Room
      </label>
      <select
        id="room"
        value={selectedRoomId ?? ''}
        onChange={(e) => onSelect(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">Select a room...</option>
        {rooms.map((room) => (
          <option key={room.id} value={room.id}>
            {room.name}
          </option>
        ))}
      </select>
    </div>
  );
}
