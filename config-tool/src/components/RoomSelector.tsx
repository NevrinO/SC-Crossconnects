import { Room } from '../types/editor'
import { useRoomImport } from '../hooks/useRoomImport'

interface RoomSelectorProps {
  rooms: Room[]
  selectedRoom: Room | null
  onRoomSelect: (room: Room | null) => void
  onImportFullRooms: (rooms: Room[]) => void
  onImportSingleRoom: (room: Room) => void
}

export function RoomSelector({
  rooms,
  selectedRoom,
  onRoomSelect,
  onImportFullRooms,
  onImportSingleRoom,
}: RoomSelectorProps) {
  const { error, handleImportFullRooms, handleImportSingleRoom } = useRoomImport(
    onImportFullRooms,
    onImportSingleRoom
  )

  const onImportFull = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    await handleImportFullRooms(file)
    event.target.value = ''
  }

  const onImportSingle = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    await handleImportSingleRoom(file)
    event.target.value = ''
  }

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
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Import Full rooms.json
            </label>
            <input
              type="file"
              accept=".json"
              onChange={onImportFull}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Import Single Room
            </label>
            <input
              type="file"
              accept=".json"
              onChange={onImportSingle}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md">
            {error}
          </div>
        )}

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
