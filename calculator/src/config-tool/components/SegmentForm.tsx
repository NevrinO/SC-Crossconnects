import { useState } from 'react'
import { GridPoint, PathSegment } from '../../types/room'

interface SegmentFormProps {
  isOpen: boolean
  start: GridPoint
  end: GridPoint
  onClose: () => void
  onCreate: (segment: PathSegment) => void
}

export function SegmentForm({ isOpen, start, end, onClose, onCreate }: SegmentFormProps) {
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<'fiber-path' | 'copper-path' | 'mixed-path'>('fiber-path')
  const [height, setHeight] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const generateId = () => {
    return crypto.randomUUID()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate height is provided
    if (height === '') {
      setError('Height is required')
      return
    }
    const heightNum = parseFloat(height)
    if (isNaN(heightNum) || heightNum <= 0) {
      setError('Height must be a positive number')
      return
    }

    // Map height to the correct field based on type
    const fiberNum = (type === 'fiber-path' || type === 'mixed-path') ? heightNum : null
    const copperNum = (type === 'copper-path' || type === 'mixed-path') ? heightNum : null

    // Validate ID uniqueness if provided manually
    const segmentId = id.trim() || generateId()

    const segment: PathSegment = {
      id: segmentId,
      name: name.trim() || `${start.x}${start.y}-${end.x}${end.y}`,
      start,
      end,
      fiberHeight: fiberNum,
      copperHeight: copperNum,
      type,
    }

    onCreate(segment)
    handleClose()
  }

  const handleClose = () => {
    setId('')
    setName('')
    setType('fiber-path')
    setHeight('')
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Create Segment</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Coordinates (read-only) */}
          <div className="bg-gray-50 p-3 rounded-md">
            <div className="text-sm text-gray-600">
              <p><strong>Start:</strong> {start.x}{start.y}</p>
              <p><strong>End:</strong> {end.x}{end.y}</p>
            </div>
          </div>

          {/* ID (optional, auto-generated if empty) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ID (optional, auto-generated if empty)
            </label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="Leave empty for auto-generated UUID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Name (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name (optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Auto-generated from coordinates if empty"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Type (required) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'fiber-path' | 'copper-path' | 'mixed-path')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="fiber-path">Fiber Path</option>
              <option value="copper-path">Copper Path</option>
              <option value="mixed-path">Mixed Path</option>
            </select>
          </div>

          {/* Height */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Height (ft) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="e.g., 6.0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
