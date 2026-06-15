import { useState, useEffect } from 'react'
import { RoomSelector } from './components/RoomSelector'
import { GridEditor } from './components/GridEditor'
import { SegmentTable } from './components/SegmentTable'
import { FileOperations } from './components/FileOperations'
import { NewRoomForm } from './components/NewRoomForm'
import { SpecialCabinetEditor } from './components/SpecialCabinetEditor'
import { ValidationSummaryPanel } from './components/ValidationSummaryPanel'
import { RoomStatisticsDashboard } from './components/RoomStatisticsDashboard'
import { ChangeHistory } from './components/ChangeHistory'
import { useAutoSave } from './hooks/useAutoSave'
import { Room, PathSegment } from './types/editor'
import { Toaster } from 'react-hot-toast'
import { showError, showSuccess } from './lib/toast'
import { deepEqual } from './lib/deep-equal'

interface Change {
  id: string
  type: 'create' | 'update' | 'delete'
  segmentId: string
  timestamp: Date
  before?: PathSegment
  after?: PathSegment
  originalIndex?: number
}

const MAX_CHANGE_HISTORY = 100

function App() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null)
  const [showNewRoomForm, setShowNewRoomForm] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [saveReady, setSaveReady] = useState(false)
  const [restorationDone, setRestorationDone] = useState(false)
  const [changes, setChanges] = useState<Change[]>([])

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

  // Handle manual save (Ctrl+S)
  useEffect(() => {
    const handleManualSave = () => {
      setChanges([]) // Clear history on save
      showSuccess('Changes saved, history cleared')
    }
    window.addEventListener('manual-save', handleManualSave)
    return () => window.removeEventListener('manual-save', handleManualSave)
  }, [])

  const handleRevertChange = (change: Change) => {
    if (!selectedRoom) return

    try {
      if (change.type === 'create') {
        // Revert create: remove the segment (inline for consistency)
        setRooms(prev => prev.map(room => {
          if (room.id === selectedRoom.id) {
            return {
              ...room,
              pathSegments: room.pathSegments.filter(s => s.id !== change.segmentId)
            }
          }
          return room
        }))
        setSelectedRoom(prev => prev ? {
          ...prev,
          pathSegments: prev.pathSegments.filter(s => s.id !== change.segmentId)
        } : null)
      } else if (change.type === 'delete' && change.before) {
        // Check for ID collision before reverting delete
        const idExists = selectedRoom.pathSegments.some(s => s.id === change.segmentId)
        if (idExists) {
          showError(`Cannot revert delete: segment ID "${change.segmentId}" already exists`)
          return
        }
        // Revert delete: restore the segment at its original position
        const insertIndex = change.originalIndex ?? selectedRoom.pathSegments.length
        setRooms(prev => prev.map(room => {
          if (room.id === selectedRoom.id) {
            const newSegments = [...room.pathSegments]
            newSegments.splice(insertIndex, 0, change.before!)
            return {
              ...room,
              pathSegments: newSegments
            }
          }
          return room
        }))
        setSelectedRoom(prev => prev ? {
          ...prev,
          pathSegments: (() => {
            const newSegments = [...prev.pathSegments]
            newSegments.splice(insertIndex, 0, change.before!)
            return newSegments
          })()
        } : null)
      } else if (change.type === 'update' && change.before) {
        // Check for ID collision before reverting update
        const idExists = selectedRoom.pathSegments.some(s => s.id === change.segmentId)
        if (!idExists) {
          showError(`Cannot revert update: segment ID "${change.segmentId}" no longer exists`)
          return
        }
        // Revert update: restore the before state
        setRooms(prev => prev.map(room => {
          if (room.id === selectedRoom.id) {
            return {
              ...room,
              pathSegments: room.pathSegments.map(s =>
                s.id === change.segmentId ? change.before! : s
            )
            }
          }
          return room
        }))
        setSelectedRoom(prev => prev ? {
          ...prev,
          pathSegments: prev.pathSegments.map(s =>
            s.id === change.segmentId ? change.before! : s
          )
        } : null)
      }

      // Remove the reverted change from history after state update is confirmed
      setChanges(prev => prev.filter(c => c.id !== change.id))
      showSuccess('Change reverted')
    } catch (e) {
      showError('Failed to revert change')
    }
  }

  const handleClearHistory = () => {
    setChanges([])
    showSuccess('Change history cleared')
  }

  const handleRoomSelect = (room: Room | null) => {
    setSelectedRoom(room)
    setChanges([]) // Clear history when switching rooms
  }

  const handleImportFullRooms = (importedRooms: Room[]) => {
    setRooms(importedRooms)
    setSelectedRoom(null)
    setChanges([]) // Clear history on import
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
    setChanges([]) // Clear history on import
  }

  const handleRoomCreate = (room: Room) => {
    setRooms(prev => [...prev, room])
    setSelectedRoom(room)
    setShowNewRoomForm(false)
    setChanges([]) // Clear history for new room
  }

  const handleRoomUpdate = (room: Room) => {
    setRooms(prev => prev.map(r => r.id === room.id ? room : r))
    setSelectedRoom(room)
    setEditingRoom(null)
    setShowNewRoomForm(false)
    setChanges([]) // Clear history on room update
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
    setChanges([]) // Clear history for cloned room
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
      showError(`Segment ID "${segment.id}" already exists in this room`)
      return
    }

    // Track change
    const newChange: Change = {
      id: crypto.randomUUID(),
      type: 'create',
      segmentId: segment.id,
      timestamp: new Date(),
      after: segment
    }
    setChanges(prev => {
      const updated = [...prev, newChange]
      // Enforce maximum history size (Lesson 2)
      if (updated.length > MAX_CHANGE_HISTORY) {
        return updated.slice(-MAX_CHANGE_HISTORY)
      }
      return updated
    })

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

    // Track changes for each modified segment
    const oldSegmentsMap = new Map(selectedRoom.pathSegments.map(s => [s.id, s]))
    const newChanges: Change[] = []

    updatedSegments.forEach(newSeg => {
      const oldSeg = oldSegmentsMap.get(newSeg.id)
      if (oldSeg && !deepEqual(oldSeg, newSeg)) {
        newChanges.push({
          id: crypto.randomUUID(),
          type: 'update',
          segmentId: newSeg.id,
          timestamp: new Date(),
          before: oldSeg,
          after: newSeg
        })
      }
    })

    if (newChanges.length > 0) {
      setChanges(prev => {
        const updated = [...prev, ...newChanges]
        // Enforce maximum history size (Lesson 2)
        if (updated.length > MAX_CHANGE_HISTORY) {
          return updated.slice(-MAX_CHANGE_HISTORY)
        }
        return updated
      })
    }

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
    const deletedSegment = selectedRoom.pathSegments.find(s => s.id === segmentId)

    // Track change
    if (deletedSegment) {
      const originalIndex = selectedRoom.pathSegments.findIndex(s => s.id === segmentId)
      const newChange: Change = {
        id: crypto.randomUUID(),
        type: 'delete',
        segmentId,
        timestamp: new Date(),
        before: deletedSegment,
        originalIndex
      }
      setChanges(prev => {
        const updated = [...prev, newChange]
        // Enforce maximum history size (Lesson 2)
        if (updated.length > MAX_CHANGE_HISTORY) {
          return updated.slice(-MAX_CHANGE_HISTORY)
        }
        return updated
      })
    }

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
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <Toaster position="top-right" toastOptions={{
        style: {
          background: '#111827',
          color: '#fff',
        },
      }} />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Config Tool</h1>
          <p className="text-gray-700">Phase 2c: Advanced Features</p>
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
          onSegmentDelete={handleSegmentDelete}
          selectedSegmentId={selectedSegmentId}
        />
      )}

      {selectedRoom && (
        <ChangeHistory
          changes={changes}
          onRevertChange={handleRevertChange}
          onClearHistory={handleClearHistory}
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
