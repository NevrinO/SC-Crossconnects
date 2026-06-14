import { useState } from 'react'
import { PathSegment } from '../types/editor'
import { validateSegmentHeights } from '../lib/validation'

interface SegmentTableProps {
  segments: PathSegment[]
  onSegmentUpdate: (segments: PathSegment[]) => void
  onSegmentDelete: (segmentId: string) => void
  onSegmentSelect: (segmentId: string | null) => void
  selectedSegmentId: string | null
}

type SortField = 'id' | 'name' | 'type' | 'start' | 'end' | 'fiberHeight' | 'copperHeight'
type SortDirection = 'asc' | 'desc'

export function SegmentTable({
  segments,
  onSegmentUpdate,
  onSegmentDelete,
  onSegmentSelect,
  selectedSegmentId,
}: SegmentTableProps) {
  const [sortField, setSortField] = useState<SortField>('id')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<PathSegment>>({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)

  const sortedSegments = [...segments].sort((a, b) => {
    let comparison = 0

    switch (sortField) {
      case 'id':
        comparison = a.id.localeCompare(b.id)
        break
      case 'name':
        comparison = a.name.localeCompare(b.name)
        break
      case 'type':
        comparison = a.type.localeCompare(b.type)
        break
      case 'start':
        comparison = `${a.start.x}${a.start.y}`.localeCompare(`${b.start.x}${b.start.y}`)
        break
      case 'end':
        comparison = `${a.end.x}${a.end.y}`.localeCompare(`${b.end.x}${b.end.y}`)
        break
      case 'fiberHeight':
        comparison = (a.fiberHeight || 0) - (b.fiberHeight || 0)
        break
      case 'copperHeight':
        comparison = (a.copperHeight || 0) - (b.copperHeight || 0)
        break
    }

    return sortDirection === 'asc' ? comparison : -comparison
  })

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const handleEdit = (segment: PathSegment) => {
    setEditingSegmentId(segment.id)
    setEditData({
      id: segment.id,
      name: segment.name,
      type: segment.type,
      fiberHeight: segment.fiberHeight,
      copperHeight: segment.copperHeight,
    })
  }

  const handleSaveEdit = () => {
    if (!editingSegmentId) return

    setEditError(null)

    // Check ID uniqueness if ID is being changed
    if (editData.id && editData.id !== editingSegmentId) {
      const idExists = segments.some(s => s.id === editData.id)
      if (idExists) {
        setEditError('Segment ID must be unique')
        return
      }
    }

    // Get original segment once (avoid O(n×6) lookups)
    const originalSegment = segments.find(s => s.id === editingSegmentId)
    if (!originalSegment) {
      setEditError('Segment no longer exists')
      return
    }

    // Validate heights
    const tempSegment: PathSegment = {
      id: editData.id || editingSegmentId,
      name: editData.name || originalSegment.name,
      type: editData.type || originalSegment.type,
      start: originalSegment.start,
      end: originalSegment.end,
      fiberHeight: editData.fiberHeight ?? originalSegment.fiberHeight,
      copperHeight: editData.copperHeight ?? originalSegment.copperHeight,
    }

    const heightErrors = validateSegmentHeights(tempSegment)
    if (heightErrors.length > 0) {
      setEditError(heightErrors.map(e => e.message).join('; '))
      return
    }

    const updatedSegments = segments.map(segment => {
      if (segment.id === editingSegmentId) {
        return {
          ...segment,
          ...editData,
        }
      }
      return segment
    })

    onSegmentUpdate(updatedSegments)
    setEditingSegmentId(null)
    setEditData({})
    setEditError(null)
  }

  const handleCancelEdit = () => {
    setEditingSegmentId(null)
    setEditData({})
  }

  const handleDelete = (segmentId: string) => {
    onSegmentDelete(segmentId)
    setShowDeleteConfirm(null)
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? '↑' : '↓'
  }

  if (segments.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Segments</h2>
        <div className="flex items-center justify-center h-32 bg-gray-50 rounded border border-gray-300">
          <p className="text-gray-500">No segments yet. Create one in the grid editor.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Segments</h2>
        <span className="text-sm text-gray-600">{segments.length} segments</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th
                className="px-3 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('id')}
              >
                ID <SortIcon field="id" />
              </th>
              <th
                className="px-3 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('name')}
              >
                Name <SortIcon field="name" />
              </th>
              <th
                className="px-3 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('type')}
              >
                Type <SortIcon field="type" />
              </th>
              <th
                className="px-3 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('start')}
              >
                Start <SortIcon field="start" />
              </th>
              <th
                className="px-3 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('end')}
              >
                End <SortIcon field="end" />
              </th>
              <th
                className="px-3 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('fiberHeight')}
              >
                Fiber Height <SortIcon field="fiberHeight" />
              </th>
              <th
                className="px-3 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('copperHeight')}
              >
                Copper Height <SortIcon field="copperHeight" />
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedSegments.map((segment) => (
              <tr
                key={segment.id}
                className={`border-b border-gray-100 hover:bg-gray-50 ${
                  selectedSegmentId === segment.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => onSegmentSelect(segment.id)}
              >
                {editingSegmentId === segment.id ? (
                  <>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={editData.id || ''}
                        onChange={(e) => setEditData({ ...editData, id: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={editData.name || ''}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={editData.type || segment.type}
                        onChange={(e) => setEditData({ ...editData, type: e.target.value as any })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="fiber-path">Fiber Path</option>
                        <option value="ladder-rack">Ladder Rack</option>
                        <option value="mixed-path">Mixed Path</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {segment.start.x}{segment.start.y}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {segment.end.x}{segment.end.y}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={editData.fiberHeight ?? ''}
                        onChange={(e) => setEditData({
                          ...editData,
                          fiberHeight: e.target.value ? parseFloat(e.target.value) : null
                        })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={editData.copperHeight ?? ''}
                        onChange={(e) => setEditData({
                          ...editData,
                          copperHeight: e.target.value ? parseFloat(e.target.value) : null
                        })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSaveEdit()
                            }}
                            className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs"
                          >
                            Save
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCancelEdit()
                            }}
                            className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                        {editError && (
                          <div className="text-red-600 text-xs">{editError}</div>
                        )}
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2 font-mono text-xs">{segment.id}</td>
                    <td className="px-3 py-2">{segment.name}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          segment.type === 'fiber-path'
                            ? 'bg-blue-100 text-blue-800'
                            : segment.type === 'ladder-rack'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {segment.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono">{segment.start.x}{segment.start.y}</td>
                    <td className="px-3 py-2 font-mono">{segment.end.x}{segment.end.y}</td>
                    <td className="px-3 py-2">{segment.fiberHeight ?? '-'}</td>
                    <td className="px-3 py-2">{segment.copperHeight ?? '-'}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEdit(segment)
                          }}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowDeleteConfirm(segment.id)
                          }}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-2">Confirm Delete</h3>
            <p className="text-gray-600 mb-4">Are you sure you want to delete this segment?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
