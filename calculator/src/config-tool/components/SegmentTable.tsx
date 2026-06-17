import { useState } from 'react'
import { PathSegment } from '../../types/room'
import { validateSegmentHeights } from '../lib/validation'
import { showSuccess, showError } from '../lib/toast'

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
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [bulkEditData, setBulkEditData] = useState<Partial<PathSegment>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'fiber-path' | 'copper-path' | 'mixed-path'>('all')

  // Auto-name generation from coordinates
  const generateAutoName = (segment: PathSegment): string => {
    return `${segment.start.x}${segment.start.y}-${segment.end.x}${segment.end.y}`
  }

  // Filter and search segments
  const filteredSegments = [...segments].filter(segment => {
    // Type filter
    if (filterType !== 'all' && segment.type !== filterType) {
      return false
    }

    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesName = segment.name.toLowerCase().includes(query)
      const matchesId = segment.id.toLowerCase().includes(query)
      const matchesCoords = `${segment.start.x}${segment.start.y}-${segment.end.x}${segment.end.y}`.toLowerCase().includes(query)
      if (!matchesName && !matchesId && !matchesCoords) {
        return false
      }
    }

    return true
  })

  const sortedSegments = filteredSegments.sort((a, b) => {
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

  const handleRowSelect = (segmentId: string) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(segmentId)) {
        newSet.delete(segmentId)
      } else {
        newSet.add(segmentId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedRows.size === sortedSegments.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(sortedSegments.map(s => s.id)))
    }
  }

  const handleBulkEdit = () => {
    if (selectedRows.size === 0) {
      showError('No segments selected')
      return
    }
    setShowBulkEdit(true)
  }

  const handleBulkEditSave = () => {
    if (selectedRows.size === 0) return

    // Apply bulk edits
    const updatedSegments = segments.map(segment => {
      if (selectedRows.has(segment.id)) {
        const updated = { ...segment }
        if (bulkEditData.type) updated.type = bulkEditData.type
        if (bulkEditData.fiberHeight !== undefined) updated.fiberHeight = bulkEditData.fiberHeight
        if (bulkEditData.copperHeight !== undefined) updated.copperHeight = bulkEditData.copperHeight
        return updated
      }
      return segment
    })

    // Apply type-height consistency fixes first (Lesson 61: validate final transformed state)
    const finalSegments = updatedSegments.map(segment => {
      if (selectedRows.has(segment.id) && bulkEditData.type) {
        const updated = { ...segment }
        if (bulkEditData.type === 'fiber-path') {
          updated.copperHeight = null
        } else if (bulkEditData.type === 'copper-path') {
          updated.fiberHeight = null
        }
        return updated
      }
      return segment
    })

    // Validate heights and type-height consistency for all updated segments (on final state)
    const errors: string[] = []
    finalSegments.forEach(segment => {
      if (selectedRows.has(segment.id)) {
        const heightErrors = validateSegmentHeights(segment)
        if (heightErrors.length > 0) {
          errors.push(`${segment.id}: ${heightErrors.map(e => e.message).join(', ')}`)
        }

        // Type-height consistency validation - check final values after applying consistency fixes
        if (segment.type === 'fiber-path' && (!segment.fiberHeight || segment.copperHeight)) {
          errors.push(`${segment.id}: Fiber path requires fiber height and no copper height`)
        }
        if (segment.type === 'copper-path' && (!segment.copperHeight || segment.fiberHeight)) {
          errors.push(`${segment.id}: Copper path requires copper height and no fiber height`)
        }
        if (segment.type === 'mixed-path' && (!segment.fiberHeight || !segment.copperHeight)) {
          errors.push(`${segment.id}: Mixed path requires both fiber and copper heights`)
        }
      }
    })

    if (errors.length > 0) {
      showError(errors.join('; '))
      return
    }

    onSegmentUpdate(finalSegments)
    setSelectedRows(new Set())
    setShowBulkEdit(false)
    setBulkEditData({})
    showSuccess(`Updated ${selectedRows.size} segments`)
  }

  const handleBulkEditCancel = () => {
    setShowBulkEdit(false)
    setBulkEditData({})
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

    // Auto-name if name field is empty
    const finalName = editData.name || generateAutoName(originalSegment)

    // Determine the final type
    const finalType = editData.type || originalSegment.type

    // Determine final heights
    const finalFiberHeight = editData.fiberHeight !== undefined ? editData.fiberHeight : originalSegment.fiberHeight
    const finalCopperHeight = editData.copperHeight !== undefined ? editData.copperHeight : originalSegment.copperHeight

    // Validate heights
    const tempSegment: PathSegment = {
      id: editData.id || editingSegmentId,
      name: finalName,
      type: finalType,
      start: originalSegment.start,
      end: originalSegment.end,
      fiberHeight: finalFiberHeight,
      copperHeight: finalCopperHeight,
    }

    const heightErrors = validateSegmentHeights(tempSegment)
    if (heightErrors.length > 0) {
      setEditError(heightErrors.map(e => e.message).join('; '))
      return
    }

    // Type-height consistency validation
    if (finalType === 'fiber-path' && (!finalFiberHeight || finalCopperHeight)) {
      setEditError('Fiber path requires fiber height and no copper height')
      return
    }
    if (finalType === 'copper-path' && (!finalCopperHeight || finalFiberHeight)) {
      setEditError('Copper path requires copper height and no fiber height')
      return
    }
    if (finalType === 'mixed-path' && (!finalFiberHeight || !finalCopperHeight)) {
      setEditError('Mixed path requires both fiber and copper heights')
      return
    }

    // Apply type-height consistency fixes
    const finalEditData = { ...editData, name: finalName }
    if (finalType === 'fiber-path') {
      finalEditData.copperHeight = null
    } else if (finalType === 'copper-path') {
      finalEditData.fiberHeight = null
    }

    const updatedSegments = segments.map(segment => {
      if (segment.id === editingSegmentId) {
        return {
          ...segment,
          ...finalEditData,
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

      {/* Search and Filter Controls */}
      <div className="flex gap-4 mb-4">
        <input
          type="text"
          placeholder="Search by name, ID, or coordinates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="all">All Types</option>
          <option value="fiber-path">Fiber Path</option>
          <option value="copper-path">Copper Path</option>
          <option value="mixed-path">Mixed Path</option>
        </select>
        {selectedRows.size > 0 && (
          <button
            onClick={handleBulkEdit}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm"
          >
            Bulk Edit ({selectedRows.size})
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-3 py-2 text-left font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={selectedRows.size === sortedSegments.length && sortedSegments.length > 0}
                  onChange={handleSelectAll}
                  className="cursor-pointer"
                />
              </th>
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
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(segment.id)}
                    onChange={(e) => {
                      e.stopPropagation()
                      handleRowSelect(segment.id)
                    }}
                    className="cursor-pointer"
                  />
                </td>
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
                        <option value="copper-path">Copper Path</option>
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
                            : segment.type === 'copper-path'
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

      {/* Bulk Edit Dialog */}
      {showBulkEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Bulk Edit {selectedRows.size} Segments</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={bulkEditData.type || ''}
                  onChange={(e) => setBulkEditData({ ...bulkEditData, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">(No change)</option>
                  <option value="fiber-path">Fiber Path</option>
                  <option value="copper-path">Copper Path</option>
                  <option value="mixed-path">Mixed Path</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fiber Height</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="(No change)"
                  value={bulkEditData.fiberHeight ?? ''}
                  onChange={(e) => setBulkEditData({
                    ...bulkEditData,
                    fiberHeight: e.target.value ? parseFloat(e.target.value) : undefined
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Copper Height</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="(No change)"
                  value={bulkEditData.copperHeight ?? ''}
                  onChange={(e) => setBulkEditData({
                    ...bulkEditData,
                    copperHeight: e.target.value ? parseFloat(e.target.value) : undefined
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleBulkEditCancel}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkEditSave}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md"
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
