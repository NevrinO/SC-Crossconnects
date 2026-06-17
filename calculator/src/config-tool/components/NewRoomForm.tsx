import { useState } from 'react'
import { Room, CoordinateFormat, Orientation, StartCorner } from '../../types/room'

interface NewRoomFormProps {
  existingRooms: Room[]
  onRoomCreate: (room: Room) => void
  onRoomUpdate?: (room: Room) => void
  onCancel: () => void
  editingRoom?: Room | null
}

export function NewRoomForm({ existingRooms, onRoomCreate, onRoomUpdate, onCancel, editingRoom }: NewRoomFormProps) {
  const isEditing = !!editingRoom

  const [formData, setFormData] = useState(() => {
    if (editingRoom) {
      // Format coordinates based on format
      const formatCoord = (x: string, y: number) => {
        if (editingRoom.coordinateFormat === 'letters-first') {
          return `${x}${y}`
        } else {
          return `${y}${x}`
        }
      }

      return {
        id: editingRoom.id,
        name: editingRoom.name,
        xyRangeStart: editingRoom.xyRange ? formatCoord(editingRoom.xyRange.start.x, editingRoom.xyRange.start.y) : '',
        xyRangeEnd: editingRoom.xyRange ? formatCoord(editingRoom.xyRange.end.x, editingRoom.xyRange.end.y) : '',
        coordinateFormat: editingRoom.coordinateFormat,
        orientation: editingRoom.orientation || 'numbers-vertical',
        startCorner: editingRoom.startCorner || 'top-left',
        tileSize: editingRoom.tileSize,
        offset: editingRoom.offset,
        spilloverAdditionalLength: editingRoom.spilloverAdditionalLength
      }
    }

    return {
      id: '',
      name: '',
      xyRangeStart: '',
      xyRangeEnd: '',
      coordinateFormat: 'letters-first' as CoordinateFormat,
      orientation: 'numbers-vertical' as Orientation,
      startCorner: 'top-left' as StartCorner,
      tileSize: 2,
      offset: 0,
      spilloverAdditionalLength: 0
    }
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Validate ID (only check uniqueness when creating new room)
    if (!formData.id.trim()) {
      newErrors.id = 'Room ID is required'
    } else if (!isEditing && existingRooms.some(r => r.id === formData.id.trim())) {
      newErrors.id = 'Room ID must be unique'
    }

    // Validate name
    if (!formData.name.trim()) {
      newErrors.name = 'Room name is required'
    }

    // Validate xyRange - should be full coordinates
    if (!formData.xyRangeStart.trim()) {
      newErrors.xyRangeStart = 'Start coordinate is required'
    } else {
      if (formData.coordinateFormat === 'letters-first') {
        const match = formData.xyRangeStart.trim().match(/^([A-Z]{1,3})(\d{1,4})$/)
        if (!match) {
          newErrors.xyRangeStart = 'Start coordinate must be letters-first format (e.g., "FK132")'
        }
      } else {
        const match = formData.xyRangeStart.trim().match(/^(\d{1,4})([A-Z]{1,3})$/)
        if (!match) {
          newErrors.xyRangeStart = 'Start coordinate must be numbers-first format (e.g., "132FK")'
        }
      }
    }

    if (!formData.xyRangeEnd.trim()) {
      newErrors.xyRangeEnd = 'End coordinate is required'
    } else {
      if (formData.coordinateFormat === 'letters-first') {
        const match = formData.xyRangeEnd.trim().match(/^([A-Z]{1,3})(\d{1,4})$/)
        if (!match) {
          newErrors.xyRangeEnd = 'End coordinate must be letters-first format (e.g., "GN185")'
        }
      } else {
        const match = formData.xyRangeEnd.trim().match(/^(\d{1,4})([A-Z]{1,3})$/)
        if (!match) {
          newErrors.xyRangeEnd = 'End coordinate must be numbers-first format (e.g., "185GN")'
        }
      }
    }

    // Validate tile size
    if (formData.tileSize <= 0 || formData.tileSize > 100) {
      newErrors.tileSize = 'Tile size must be between 0.1 and 100 feet'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    // Parse coordinates based on format
    const parseCoord = (coord: string) => {
      if (formData.coordinateFormat === 'letters-first') {
        const match = coord.match(/^([A-Z]{1,3})(\d{1,4})$/)
        if (!match) throw new Error(`Invalid coordinate: ${coord}`)
        const y = parseInt(match[2], 10)
        if (y < 1 || y > 9999) throw new Error(`Y coordinate out of range (1-9999): ${y}`)
        return { x: match[1], y }
      } else {
        const match = coord.match(/^(\d{1,4})([A-Z]{1,3})$/)
        if (!match) throw new Error(`Invalid coordinate: ${coord}`)
        const y = parseInt(match[1], 10)
        if (y < 1 || y > 9999) throw new Error(`Y coordinate out of range (1-9999): ${y}`)
        return { x: match[2], y }
      }
    }

    const newRoom: Room = {
      id: formData.id.trim(),
      name: formData.name.trim(),
      tileSize: formData.tileSize,
      offset: formData.offset,
      spilloverAdditionalLength: formData.spilloverAdditionalLength,
      pathSegments: [],
      specialCabinets: {
        networkRacks: [],
        halfCabs: [],
        quarterCabs: []
      },
      coordinateFormat: formData.coordinateFormat,
      orientation: formData.orientation,
      xyRange: {
        start: parseCoord(formData.xyRangeStart.trim()),
        end: parseCoord(formData.xyRangeEnd.trim())
      },
      startCorner: formData.startCorner
    }

    if (isEditing && onRoomUpdate) {
      onRoomUpdate(newRoom)
    } else {
      onRoomCreate(newRoom)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        {isEditing ? 'Edit Room' : 'Create New Room'}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Room ID *
            </label>
            <input
              type="text"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              disabled={isEditing}
              className={`w-full px-3 py-2 border rounded-md ${errors.id ? 'border-red-500' : 'border-gray-300'} ${isEditing ? 'bg-gray-100' : ''}`}
              placeholder="e.g., CR-15"
            />
            {errors.id && <p className="text-red-500 text-sm mt-1">{errors.id}</p>}
            {isEditing && <p className="text-xs text-gray-500 mt-1">ID cannot be changed when editing</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Room Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full px-3 py-2 border rounded-md ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="e.g., Computer Room 15"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Coordinate Format *
          </label>
          <select
            value={formData.coordinateFormat}
            onChange={(e) => setFormData({ ...formData, coordinateFormat: e.target.value as CoordinateFormat })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="letters-first">Letters-First (e.g., FK132)</option>
            <option value="numbers-first">Numbers-First (e.g., 132FK)</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Coordinate *
            </label>
            <input
              type="text"
              value={formData.xyRangeStart}
              onChange={(e) => setFormData({ ...formData, xyRangeStart: e.target.value.toUpperCase() })}
              className={`w-full px-3 py-2 border rounded-md ${errors.xyRangeStart ? 'border-red-500' : 'border-gray-300'}`}
              placeholder={formData.coordinateFormat === 'letters-first' ? 'e.g., FK132' : 'e.g., 132FK'}
            />
            {errors.xyRangeStart && <p className="text-red-500 text-sm mt-1">{errors.xyRangeStart}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Coordinate *
            </label>
            <input
              type="text"
              value={formData.xyRangeEnd}
              onChange={(e) => setFormData({ ...formData, xyRangeEnd: e.target.value.toUpperCase() })}
              className={`w-full px-3 py-2 border rounded-md ${errors.xyRangeEnd ? 'border-red-500' : 'border-gray-300'}`}
              placeholder={formData.coordinateFormat === 'letters-first' ? 'e.g., GN185' : 'e.g., 185GN'}
            />
            {errors.xyRangeEnd && <p className="text-red-500 text-sm mt-1">{errors.xyRangeEnd}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Corner
            </label>
            <select
              value={formData.startCorner}
              onChange={(e) => setFormData({ ...formData, startCorner: e.target.value as StartCorner })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="top-left">Top-Left</option>
              <option value="top-right">Top-Right</option>
              <option value="bottom-left">Bottom-Left</option>
              <option value="bottom-right">Bottom-Right</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Which corner is the reference point</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Orientation
            </label>
            <select
              value={formData.orientation}
              onChange={(e) => setFormData({ ...formData, orientation: e.target.value as Orientation })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="numbers-vertical">Numbers Vertical (default)</option>
              <option value="numbers-horizontal">Numbers Horizontal</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Direction of cabinet numbering</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tile Size (ft)
            </label>
            <input
              type="number"
              value={formData.tileSize}
              onChange={(e) => setFormData({ ...formData, tileSize: parseFloat(e.target.value) || 0 })}
              className={`w-full px-3 py-2 border rounded-md ${errors.tileSize ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="2"
              min="0.1"
              step="0.1"
            />
            {errors.tileSize && <p className="text-red-500 text-sm mt-1">{errors.tileSize}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Offset
            </label>
            <input
              type="number"
              value={formData.offset}
              onChange={(e) => setFormData({ ...formData, offset: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="0"
              step="0.1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Spillover Length
            </label>
            <input
              type="number"
              value={formData.spilloverAdditionalLength}
              onChange={(e) => setFormData({ ...formData, spilloverAdditionalLength: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="0"
              step="0.1"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            {isEditing ? 'Update Room' : 'Create Room'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
