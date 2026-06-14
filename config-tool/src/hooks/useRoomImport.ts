import { useState, useCallback } from 'react'
import { Room } from '../types/editor'
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
  onImportSingleRoom: (room: Room) => void
): UseRoomImportReturn {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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
