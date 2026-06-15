import { Room } from '../types/editor'

interface RoomSelectorProps {
  rooms: Room[]
  selectedRoom: Room | null
  onRoomSelect: (room: Room | null) => void
  onNewRoomClick: () => void
  onRoomClone: (room: Room) => void
  onRoomEdit?: (room: Room) => void
}

export function RoomSelector({
  rooms,
  selectedRoom,
  onRoomSelect,
  onNewRoomClick,
  onRoomClone,
  onRoomEdit,
}: RoomSelectorProps) {

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">Room Selection</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Existing Room
          </label>
          <select
            value={selectedRoom?.id || ''}
            onChange={(e) => {
              const room = rooms.find(r => r.id === e.target.value)
              onRoomSelect(room || null)
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Select a room --</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} ({room.id})
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onNewRoomClick}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            Create New Room
          </button>
          {selectedRoom && (
            <>
              <button
                onClick={() => onRoomEdit && onRoomEdit(selectedRoom)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Edit Room
              </button>
              <button
                onClick={() => onRoomClone(selectedRoom)}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
              >
                Clone Room
              </button>
            </>
          )}
        </div>

        {selectedRoom && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="font-medium text-blue-900 mb-2">Room Summary</h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p><strong>Name:</strong> {selectedRoom.name}</p>
              <p><strong>ID:</strong> {selectedRoom.id}</p>
              <p><strong>Segments:</strong> {selectedRoom.pathSegments.length}</p>
              <p><strong>Coordinate Format:</strong> {selectedRoom.coordinateFormat}</p>
              <p><strong>Tile Size:</strong> {selectedRoom.tileSize}ft</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
