import { useState, useCallback } from 'react'
import { Room } from '../../types/room'
import { useRoomImport } from '../hooks/useRoomImport'

interface FileOperationsProps {
  rooms: Room[]
  selectedRoom: Room | null
  onImportFullRooms: (rooms: Room[]) => void
  onImportSingleRoom: (room: Room) => void
}

export function FileOperations({
  rooms,
  selectedRoom,
  onImportFullRooms,
  onImportSingleRoom,
}: FileOperationsProps) {
  const [showImportConfirm, setShowImportConfirm] = useState<'full' | 'single' | null>(null)
  const [localSuccess, setLocalSuccess] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportSuccess, setExportSuccess] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  // Wrap callbacks to add local success handling and close dialog
  const wrappedImportFull = useCallback((rooms: Room[]) => {
    onImportFullRooms(rooms)
    setLocalSuccess(`Imported ${rooms.length} rooms`)
    setTimeout(() => setLocalSuccess(null), 3000)
    setShowImportConfirm(null)
  }, [onImportFullRooms])

  const wrappedImportSingle = useCallback((room: Room) => {
    onImportSingleRoom(room)
    setLocalSuccess(`Imported room: ${room.name}`)
    setTimeout(() => setLocalSuccess(null), 3000)
    setShowImportConfirm(null)
  }, [onImportSingleRoom])

  const { error, success: hookSuccess, handleImportFullRooms, handleImportSingleRoom } = useRoomImport(
    wrappedImportFull,
    wrappedImportSingle,
    rooms
  )

  // Combine success messages from hook and local
  const success = localSuccess || hookSuccess

  const exportSingleRoom = () => {
    if (!selectedRoom) {
      setExportError('No room selected to export')
      setTimeout(() => setExportError(null), 3000)
      return
    }

    setIsExporting(true)
    const dataStr = JSON.stringify(selectedRoom, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedRoom.id}-${selectedRoom.name.replace(/\s+/g, '_')}.json`
    link.click()
    URL.revokeObjectURL(url)
    setExportSuccess(`Exported room: ${selectedRoom.name}`)
    setTimeout(() => setExportSuccess(null), 3000)
    setIsExporting(false)
  }

  const exportAllRooms = () => {
    if (rooms.length === 0) {
      setExportError('No rooms to export')
      setTimeout(() => setExportError(null), 3000)
      return
    }

    setIsExporting(true)
    const dataStr = JSON.stringify(rooms, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'rooms.json'
    link.click()
    URL.revokeObjectURL(url)
    setExportSuccess(`Exported ${rooms.length} rooms`)
    setTimeout(() => setExportSuccess(null), 3000)
    setIsExporting(false)
  }

  const downloadForCalculator = () => {
    if (!selectedRoom) {
      setExportError('No room selected to download')
      setTimeout(() => setExportError(null), 3000)
      return
    }

    setIsExporting(true)
    const dataStr = JSON.stringify(selectedRoom, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedRoom.id}-${selectedRoom.name.replace(/\s+/g, '_')}.json`
    link.click()
    URL.revokeObjectURL(url)
    setExportSuccess(`Downloaded room for calculator: ${selectedRoom.name}`)
    setTimeout(() => setExportSuccess(null), 3000)
    setIsExporting(false)
  }

  const onImportFull = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setIsExporting(true)
    await handleImportFullRooms(file)
    setIsExporting(false)
    event.target.value = ''
  }

  const onImportSingle = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setIsExporting(true)
    await handleImportSingleRoom(file)
    setIsExporting(false)
    event.target.value = ''
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">File Operations</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Export Section */}
        <div className="space-y-3">
          <h3 className="font-medium text-gray-700">Export</h3>
          <button
            onClick={exportSingleRoom}
            disabled={!selectedRoom || isExporting}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md text-sm flex items-center justify-center gap-2"
            title="Download selected room as JSON file"
          >
            {isExporting ? (
              <>
                <span className="animate-spin">⏳</span>
                Exporting...
              </>
            ) : (
              'Export Single Room'
            )}
          </button>
          <button
            onClick={exportAllRooms}
            disabled={rooms.length === 0 || isExporting}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md text-sm flex items-center justify-center gap-2"
            title="Download all rooms as rooms.json"
          >
            {isExporting ? (
              <>
                <span className="animate-spin">⏳</span>
                Exporting...
              </>
            ) : (
              'Export All Rooms'
            )}
          </button>
          {import.meta.env.DEV && (
            <button
              onClick={downloadForCalculator}
              disabled={!selectedRoom || isExporting}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md text-sm flex items-center justify-center gap-2"
              title="Download this file, then manually merge into calculator/src/data/rooms.json"
            >
              {isExporting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Downloading...
                </>
              ) : (
                'Download for Calculator'
              )}
            </button>
          )}
        </div>

        {/* Import Section */}
        <div className="space-y-3">
          <h3 className="font-medium text-gray-700">Import</h3>
          <button
            onClick={() => setShowImportConfirm('single')}
            disabled={isExporting}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md text-sm flex items-center justify-center gap-2"
            title="Load a single room JSON file"
          >
            {isExporting ? (
              <>
                <span className="animate-spin">⏳</span>
                Importing...
              </>
            ) : (
              'Import Single Room'
            )}
          </button>
          <button
            onClick={() => setShowImportConfirm('full')}
            disabled={isExporting}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md text-sm flex items-center justify-center gap-2"
            title="Load a full rooms.json file (replaces all rooms)"
          >
            {isExporting ? (
              <>
                <span className="animate-spin">⏳</span>
                Importing...
              </>
            ) : (
              'Import Full rooms.json'
            )}
          </button>
        </div>
      </div>

      {/* Import Confirmation Dialog */}
      {showImportConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-2">
              {showImportConfirm === 'full' ? 'Import Full rooms.json' : 'Import Single Room'}
            </h3>
            <p className="text-gray-600 mb-4">
              {showImportConfirm === 'full'
                ? 'This will replace all existing rooms with the imported data. Are you sure?'
                : 'This will add or replace a single room. Are you sure?'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowImportConfirm(null)}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md"
              >
                Cancel
              </button>
              <label className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-center cursor-pointer">
                Confirm Import
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={showImportConfirm === 'full' ? onImportFull : onImportSingle}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Import Error Message */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm whitespace-pre-wrap">
          {error}
        </div>
      )}

      {/* Export Error Message */}
      {exportError && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm">
          {exportError}
        </div>
      )}

      {/* Import Success Message */}
      {success && (
        <div className="mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-md text-sm">
          {success}
        </div>
      )}

      {/* Export Success Message */}
      {exportSuccess && (
        <div className="mt-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-md text-sm">
          {exportSuccess}
        </div>
      )}
    </div>
  )
}
