import { useState, useEffect } from 'react'
import { RoomSelector } from './components/RoomSelector'
import { GridEditor } from './components/GridEditor'
import { SegmentTable } from './components/SegmentTable'
import { FileOperations } from './components/FileOperations'
import { NewRoomForm } from './components/NewRoomForm'
import { SpecialCabinetEditor } from './components/SpecialCabinetEditor'
import { ValidationSummaryPanel } from './components/ValidationSummaryPanel'
import { RoomStatisticsDashboard } from './components/RoomStatisticsDashboard'
import { useAutoSave } from './hooks/useAutoSave'
import { Room, PathSegment } from './types/editor'

function App() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null)
  const [showNewRoomForm, setShowNewRoomForm] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [saveReady, setSaveReady] = useState(false)
  const [restorationDone, setRestorationDone] = useState(false)

  // Auto-save hook - saveReady=false prevents saving empty initial state over a valid backup
  const { lastSaved, clearBackup, saveError, restoredData, restoreAttempted } = useAutoSave(rooms, selectedRoom?.id || null, saveReady)

  // Step 1: Apply restored data once the hook has finished its restore attempt
  useEffect(() => {
    if (!restoreAttempted) return
    if (restoredData) {
      setRooms(restoredData.rooms)
      if (restoredData.selectedRoomId) {
        const room = restoredData.rooms.find(r => r.id === restoredData.selectedRoomId)
        if (room) {
          setSelectedRoom(room)
        }
      }
    }
    setRestorationDone(true)
  }, [restoreAttempted])

  // Step 2: Enable saving only after restoration is complete
  // IMPORTANT: Do NOT include 'rooms' in dependencies - this creates a race condition
  // where saveReady becomes true before restored data is fully applied.
  useEffect(() => {
    if (restorationDone) {
      setSaveReady(true)
    }
  }, [restorationDone])

  const handleRoomSelect = (room: Room | null) => {
    setSelectedRoom(room)
  }

  const handleImportFullRooms = (importedRooms: Room[]) => {
    setRooms(importedRooms)
    setSelectedRoom(null)
  }

  const handleImportSingleRoom = (room: Room) => {
    // Add default orientation if missing for backward compatibility
    const roomWithOrientation = room.orientation ? room : { ...room, orientation: 'numbers-vertical' as const }
    
    setRooms(prev => {
      const existingIndex = prev.findIndex(r => r.id === roomWithOrientation.id)
      if (existingIndex >= 0) {
        const updated = [...prev]
        updated[existingIndex] = roomWithOrientation
        return updated
      }
      return [...prev, roomWithOrientation]
    })
    setSelectedRoom(roomWithOrientation)
  }

  const handleRoomCreate = (room: Room) => {
    setRooms(prev => [...prev, room])
    setSelectedRoom(room)
    setShowNewRoomForm(false)
  }

  const handleRoomUpdate = (room: Room) => {
    setRooms(prev => prev.map(r => r.id === room.id ? room : r))
    setSelectedRoom(room)
    setEditingRoom(null)
    setShowNewRoomForm(false)
  }

  const handleRoomEdit = (room: Room) => {
    setEditingRoom(room)
    setShowNewRoomForm(true)
  }

  const handleRoomClone = (room: Room) => {
    const clonedRoom: Room = {
      ...room,
      id: crypto.randomUUID(),
      name: `${room.name} (Copy)`,
      orientation: room.orientation || 'numbers-vertical'
    }
    setRooms(prev => [...prev, clonedRoom])
    setSelectedRoom(clonedRoom)
  }

  const handleSpecialCabinetsUpdate = (specialCabinets: Room['specialCabinets']) => {
    if (!selectedRoom) return
    const roomId = selectedRoom.id

    setRooms(prev => prev.map(room =>
      room.id === roomId ? { ...room, specialCabinets } : room
    ))

    setSelectedRoom(prev => prev?.id === roomId ? { ...prev, specialCabinets } : prev)
  }

  const handleSegmentCreate = (segment: PathSegment) => {
    if (!selectedRoom) return

    // Validate ID uniqueness
    const idExists = selectedRoom.pathSegments.some(s => s.id === segment.id)
    if (idExists) {
      alert(`Segment ID "${segment.id}" already exists in this room`)
      return
    }

    setRooms(prev => prev.map(room => {
      if (room.id === selectedRoom.id) {
        return {
          ...room,
          pathSegments: [...room.pathSegments, segment]
        }
      }
      return room
    }))

    setSelectedRoom(prev => prev ? {
      ...prev,
      pathSegments: [...prev.pathSegments, segment]
    } : null)
  }

  const handleSegmentUpdate = (updatedSegments: PathSegment[]) => {
    if (!selectedRoom) return

    setRooms(prev => prev.map(room => {
      if (room.id === selectedRoom.id) {
        return {
          ...room,
          pathSegments: updatedSegments
        }
      }
      return room
    }))

    setSelectedRoom(prev => prev ? {
      ...prev,
      pathSegments: updatedSegments
    } : null)
  }

  const handleSegmentDelete = (segmentId: string) => {
    if (!selectedRoom) return

    const roomId = selectedRoom.id

    setRooms(prev => prev.map(room => {
      if (room.id === roomId) {
        return {
          ...room,
          pathSegments: room.pathSegments.filter(s => s.id !== segmentId)
        }
      }
      return room
    }))

    setSelectedRoom(prev => prev ? {
      ...prev,
      pathSegments: prev.pathSegments.filter(s => s.id !== segmentId)
    } : null)

    if (selectedSegmentId === segmentId) {
      setSelectedSegmentId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Config Tool</h1>
          <p className="text-gray-700">Phase 2b: Room Management & Data</p>
        </div>
        <div className="flex items-center gap-4">
          {lastSaved && (
            <span className="text-sm text-gray-600">
              Last saved: {lastSaved.toLocaleTimeString()}
            </span>
          )}
          {saveError && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-1 rounded-md">
              {saveError}
            </div>
          )}
          {lastSaved && (
            <button
              onClick={clearBackup}
              className="text-sm text-gray-600 hover:text-gray-800 underline"
            >
              Clear backup
            </button>
          )}
        </div>
      </div>
      
      <RoomSelector
        rooms={rooms}
        selectedRoom={selectedRoom}
        onRoomSelect={handleRoomSelect}
        onNewRoomClick={() => setShowNewRoomForm(true)}
        onRoomClone={handleRoomClone}
        onRoomEdit={handleRoomEdit}
      />

      {showNewRoomForm && (
        <NewRoomForm
          existingRooms={rooms}
          onRoomCreate={handleRoomCreate}
          onRoomUpdate={handleRoomUpdate}
          onCancel={() => {
            setShowNewRoomForm(false)
            setEditingRoom(null)
          }}
          editingRoom={editingRoom}
        />
      )}

      <FileOperations
        rooms={rooms}
        selectedRoom={selectedRoom}
        onImportFullRooms={handleImportFullRooms}
        onImportSingleRoom={handleImportSingleRoom}
      />

      {selectedRoom && (
        <ValidationSummaryPanel room={selectedRoom} />
      )}

      {selectedRoom && (
        <RoomStatisticsDashboard room={selectedRoom} />
      )}

      {selectedRoom && (
        <SpecialCabinetEditor
          room={selectedRoom}
          onUpdate={handleSpecialCabinetsUpdate}
        />
      )}

      {selectedRoom && (
        <GridEditor
          room={selectedRoom}
          onSegmentCreate={handleSegmentCreate}
          onSegmentSelect={setSelectedSegmentId}
          selectedSegmentId={selectedSegmentId}
        />
      )}

      {selectedRoom && (
        <SegmentTable
          segments={selectedRoom.pathSegments}
          onSegmentUpdate={handleSegmentUpdate}
          onSegmentDelete={handleSegmentDelete}
          onSegmentSelect={setSelectedSegmentId}
          selectedSegmentId={selectedSegmentId}
        />
      )}
    </div>
  )
}

export default App
