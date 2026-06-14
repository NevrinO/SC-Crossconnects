import { useState } from 'react'
import { RoomSelector } from './components/RoomSelector'
import { GridEditor } from './components/GridEditor'
import { SegmentTable } from './components/SegmentTable'
import { FileOperations } from './components/FileOperations'
import { Room, PathSegment } from './types/editor'

function App() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null)

  const handleRoomSelect = (room: Room | null) => {
    setSelectedRoom(room)
  }

  const handleImportFullRooms = (importedRooms: Room[]) => {
    setRooms(importedRooms)
    setSelectedRoom(null)
  }

  const handleImportSingleRoom = (room: Room) => {
    setRooms(prev => {
      const existingIndex = prev.findIndex(r => r.id === room.id)
      if (existingIndex >= 0) {
        const updated = [...prev]
        updated[existingIndex] = room
        return updated
      }
      return [...prev, room]
    })
    setSelectedRoom(room)
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
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Config Tool</h1>
      <p className="text-gray-700 mb-6">Phase 2a: Core Editor (MVP)</p>
      
      <RoomSelector
        rooms={rooms}
        selectedRoom={selectedRoom}
        onRoomSelect={handleRoomSelect}
        onImportFullRooms={handleImportFullRooms}
        onImportSingleRoom={handleImportSingleRoom}
      />

      <FileOperations
        rooms={rooms}
        selectedRoom={selectedRoom}
        onImportFullRooms={handleImportFullRooms}
        onImportSingleRoom={handleImportSingleRoom}
      />

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
