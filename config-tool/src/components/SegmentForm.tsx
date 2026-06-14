import { useState } from 'react'
import { GridPoint, PathSegment } from '../types/editor'

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
  const [type, setType] = useState<'fiber-path' | 'ladder-rack' | 'mixed-path'>('fiber-path')
  const [fiberHeight, setFiberHeight] = useState<string>('')
  const [copperHeight, setCopperHeight] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const generateId = () => {
    return crypto.randomUUID()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate at least one height is provided based on type
    const fiberNum = fiberHeight !== '' ? parseFloat(fiberHeight) : null
    const copperNum = copperHeight !== '' ? parseFloat(copperHeight) : null

    if (type === 'fiber-path' && fiberNum === null) {
      setError('Fiber height is required for fiber-path segments')
      return
    }

    if (type === 'ladder-rack' && copperNum === null) {
      setError('Copper height is required for ladder-rack segments')
      return
    }

    if (type === 'mixed-path' && (fiberNum === null || copperNum === null)) {
      setError('Both fiber and copper heights are required for mixed-path segments')
      return
    }

    // Validate heights are positive numbers
    if (fiberNum !== null && (isNaN(fiberNum) || fiberNum <= 0)) {
      setError('Fiber height must be a positive number')
      return
    }

    if (copperNum !== null && (isNaN(copperNum) || copperNum <= 0)) {
      setError('Copper height must be a positive number')
      return
    }

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
    setFiberHeight('')
    setCopperHeight('')
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
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="fiber-path">Fiber Path</option>
              <option value="ladder-rack">Ladder Rack</option>
              <option value="mixed-path">Mixed Path</option>
            </select>
          </div>

          {/* Fiber Height */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fiber Height {type === 'fiber-path' || type === 'mixed-path' ? <span className="text-red-500">*</span> : '(optional)'}
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={fiberHeight}
              onChange={(e) => setFiberHeight(e.target.value)}
              placeholder="e.g., 6.0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required={type === 'fiber-path' || type === 'mixed-path'}
            />
          </div>

          {/* Copper Height */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Copper Height {type === 'ladder-rack' || type === 'mixed-path' ? <span className="text-red-500">*</span> : '(optional)'}
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={copperHeight}
              onChange={(e) => setCopperHeight(e.target.value)}
              placeholder="e.g., 6.0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required={type === 'ladder-rack' || type === 'mixed-path'}
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
