import { useState, useCallback, useRef } from 'react'
import { Room } from '../../types/room'
import { validateRoomStructure } from '../lib/validation'

export interface ImportResult {
  success: boolean
  message: string
}

export interface UseRoomImportReturn {
  error: string | null
  success: string | null
  clearMessages: () => void
  handleImportFullRooms: (file: File) => Promise<ImportResult>
  handleImportSingleRoom: (file: File) => Promise<ImportResult>
}

const MAX_FILE_SIZE = 1024 * 1024 // 1MB

export function useRoomImport(
  onImportFullRooms: (rooms: Room[]) => void,
  onImportSingleRoom: (room: Room) => void,
  existingRooms: Room[] = []
): UseRoomImportReturn {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const existingRoomsRef = useRef(existingRooms)

  // Update ref when existingRooms changes
  existingRoomsRef.current = existingRooms

  const clearMessages = useCallback(() => {
    setError(null)
    setSuccess(null)
  }, [])

  const handleImportFullRooms = useCallback(async (file: File): Promise<ImportResult> => {
    clearMessages()

    if (file.size > MAX_FILE_SIZE) {
      const msg = 'File too large. Maximum size is 1MB.'
      setError(msg)
      return { success: false, message: msg }
    }

    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          const parsed = JSON.parse(content)

          if (!Array.isArray(parsed)) {
            throw new Error('Invalid format: Expected an array of rooms')
          }

          const validationResults = parsed.map((room: any) => ({
            room,
            validation: validateRoomStructure(room)
          }))

          const invalidRooms = validationResults.filter(r => !r.validation.isValid)
          if (invalidRooms.length > 0) {
            const errorDetails = invalidRooms.map((r, idx) => {
              const roomId = r.room.id || `Room ${idx + 1}`
              return `${roomId}: ${r.validation.errors.join(', ')}`
            }).join('\n')
            throw new Error(`Invalid room format:\n${errorDetails}`)
          }

          // Check for duplicate room IDs
          const existingIds = new Set(existingRoomsRef.current.map(r => r.id))
          const duplicateIds = new Set<string>()
          const idMap = new Map<string, any>()

          for (const room of parsed) {
            if (existingIds.has(room.id)) {
              duplicateIds.add(room.id)
            }
            if (idMap.has(room.id)) {
              duplicateIds.add(room.id)
            }
            idMap.set(room.id, room)
          }

          if (duplicateIds.size > 0) {
            throw new Error(`Duplicate room IDs found: ${Array.from(duplicateIds).join(', ')}. Room IDs must be unique.`)
          }

          onImportFullRooms(parsed)
          const msg = `Imported ${parsed.length} rooms`
          setSuccess(msg)
          setTimeout(() => setSuccess(null), 3000)
          resolve({ success: true, message: msg })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to parse file'
          setError(msg)
          resolve({ success: false, message: msg })
        }
      }
      reader.onerror = () => {
        const msg = 'Failed to read file'
        setError(msg)
        resolve({ success: false, message: msg })
      }
      reader.readAsText(file)
    })
  }, [clearMessages, onImportFullRooms])

  const handleImportSingleRoom = useCallback(async (file: File): Promise<ImportResult> => {
    clearMessages()

    if (file.size > MAX_FILE_SIZE) {
      const msg = 'File too large. Maximum size is 1MB.'
      setError(msg)
      return { success: false, message: msg }
    }

    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          const parsed = JSON.parse(content)

          const validation = validateRoomStructure(parsed)
          if (!validation.isValid) {
            const roomId = parsed.id || 'Unknown room'
            throw new Error(`Invalid room format for ${roomId}: ${validation.errors.join(', ')}`)
          }

          // Check for duplicate room ID
          const existingIds = new Set(existingRoomsRef.current.map(r => r.id))
          if (existingIds.has(parsed.id)) {
            throw new Error(`Room ID "${parsed.id}" already exists. Room IDs must be unique.`)
          }

          onImportSingleRoom(parsed)
          const msg = `Imported room: ${parsed.name}`
          setSuccess(msg)
          setTimeout(() => setSuccess(null), 3000)
          resolve({ success: true, message: msg })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to parse file'
          setError(msg)
          resolve({ success: false, message: msg })
        }
      }
      reader.onerror = () => {
        const msg = 'Failed to read file'
        setError(msg)
        resolve({ success: false, message: msg })
      }
      reader.readAsText(file)
    })
  }, [clearMessages, onImportSingleRoom])

  return {
    error,
    success,
    clearMessages,
    handleImportFullRooms,
    handleImportSingleRoom
  }
}
