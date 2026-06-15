import { useEffect, useState, useRef } from 'react'
import { Room } from '../types/editor'
import { compressToUTF16, decompressFromUTF16 } from 'lz-string'

const STORAGE_KEY = 'config-tool-backup'
const COMPRESSION_THRESHOLD = 4 * 1024 * 1024 // 4MB
const MAX_STORAGE_SIZE = 5 * 1024 * 1024 // 5MB hard limit for localStorage

interface AutoSaveReturn {
  lastSaved: Date | null
  clearBackup: () => void
  saveError: string | null
  restoredData: { rooms: Room[]; selectedRoomId: string | null } | null
  restoreAttempted: boolean
}

export function useAutoSave(
  rooms: Room[],
  selectedRoomId: string | null,
  ready: boolean = false,
  debounceMs: number = 1000
): AutoSaveReturn {
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [restoredData, setRestoredData] = useState<{ rooms: Room[]; selectedRoomId: string | null } | null>(null)
  const [restoreAttempted, setRestoreAttempted] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef<boolean>(true)
  const latestRoomsRef = useRef<Room[]>(rooms)
  const latestSelectedRoomIdRef = useRef<string | null>(selectedRoomId)
  const readyRef = useRef<boolean>(ready)

  // Update refs synchronously during render so beforeunload always reads latest values
  latestRoomsRef.current = rooms
  latestSelectedRoomIdRef.current = selectedRoomId
  readyRef.current = ready

  // Restore from backup on mount - only once
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        let data: { rooms: Room[]; selectedRoomId?: string | null; lastSaved?: string }
        try {
          data = JSON.parse(stored)
        } catch {
          // Nested try-catch for decompression - LZ-string can throw on malformed input
          try {
            const decompressed = decompressFromUTF16(stored)
            if (!decompressed) throw new Error('Failed to decompress backup data')
            data = JSON.parse(decompressed)
          } catch (decompressError) {
            console.error('Failed to decompress backup:', decompressError)
            // Re-throw to be caught by outer handler
            throw new Error('Backup data is corrupted or unreadable')
          }
        }
        if (data.rooms && Array.isArray(data.rooms)) {
          // Add default orientation if missing for backward compatibility
          const roomsWithOrientation = data.rooms.map((room: Room) => 
            room.orientation ? room : { ...room, orientation: 'numbers-vertical' as const }
          )
          setRestoredData({
            rooms: roomsWithOrientation,
            selectedRoomId: data.selectedRoomId || null
          })
        }
        if (data.lastSaved) {
          setLastSaved(new Date(data.lastSaved))
        }
      }
    } catch (error) {
      console.error('Failed to restore backup:', error)
    } finally {
      setRestoreAttempted(true)
    }
  }, [])

  // Auto-save on changes
  useEffect(() => {
    if (!ready) return

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      // Check if component is still mounted before updating state
      if (!mountedRef.current) return

      try {
        const data = {
          rooms,
          selectedRoomId,
          lastSaved: new Date().toISOString()
        }

        const jsonString = JSON.stringify(data)
        let stored: string

        // Compress if data exceeds threshold
        if (jsonString.length > COMPRESSION_THRESHOLD) {
          stored = compressToUTF16(jsonString)
        } else {
          stored = jsonString
        }

        // Pre-flight size check to prevent quota errors and UI freezes
        if (stored.length > MAX_STORAGE_SIZE) {
          throw new Error(`Data size (${(stored.length / 1024 / 1024).toFixed(2)}MB) exceeds maximum (${MAX_STORAGE_SIZE / 1024 / 1024}MB). Export and clear some rooms to continue.`)
        }

        localStorage.setItem(STORAGE_KEY, stored)
        
        // Only update state if component is still mounted
        if (mountedRef.current) {
          setLastSaved(new Date())
          setSaveError(null)
        }
      } catch (error) {
        // Handle LocalStorage quota errors
        if (mountedRef.current) {
          if (error instanceof Error) {
            if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
              setSaveError('Storage quota exceeded. Clear backup or export your data.')
            } else if (error.message.includes('access')) {
              setSaveError('Unable to access storage (private browsing mode?). Auto-save disabled.')
            } else {
              setSaveError(`Auto-save failed: ${error.message}`)
            }
          } else {
            setSaveError('Auto-save failed: Unknown error')
          }
        }
        console.error('Auto-save failed:', error)
      }
    }, debounceMs)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [rooms, selectedRoomId, ready, debounceMs])

  // Flush save synchronously before page unload (bypasses debounce)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!readyRef.current) return
      try {
        const data = {
          rooms: latestRoomsRef.current,
          selectedRoomId: latestSelectedRoomIdRef.current,
          lastSaved: new Date().toISOString()
        }
        const jsonString = JSON.stringify(data)
        const stored = jsonString.length > COMPRESSION_THRESHOLD
          ? compressToUTF16(jsonString)
          : jsonString

        // Pre-flight size check to prevent quota errors
        if (stored.length > MAX_STORAGE_SIZE) {
          console.error('Auto-save flush failed: Data exceeds maximum storage size')
          return
        }

        localStorage.setItem(STORAGE_KEY, stored)
      } catch (e) {
        console.error('Auto-save flush failed:', e)
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const clearBackup = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      setLastSaved(null)
      setSaveError(null)
    } catch (error) {
      console.error('Failed to clear backup:', error)
      setSaveError('Failed to clear backup')
    }
  }

  return {
    lastSaved,
    clearBackup,
    saveError,
    restoredData,
    restoreAttempted
  }
}
