import { PathSegment } from '../../types/room'
import { deepEqual } from '../lib/deep-equal'

interface Change {
  id: string
  type: 'create' | 'update' | 'delete'
  segmentId: string
  timestamp: Date
  before?: PathSegment
  after?: PathSegment
}

interface ChangeHistoryProps {
  onRevertChange: (change: Change) => void
  onClearHistory: () => void
  changes: Change[]
}

export function ChangeHistory({ onRevertChange, onClearHistory, changes }: ChangeHistoryProps) {
  if (changes.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Change History</h2>
        </div>
        <div className="flex items-center justify-center h-32 bg-gray-50 rounded border border-gray-300">
          <p className="text-gray-500">No changes since last save</p>
        </div>
      </div>
    )
  }

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const getChangeColor = (type: string) => {
    switch (type) {
      case 'create': return 'bg-green-100 text-green-800'
      case 'update': return 'bg-blue-100 text-blue-800'
      case 'delete': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getChangeLabel = (type: string) => {
    switch (type) {
      case 'create': return 'Created'
      case 'update': return 'Updated'
      case 'delete': return 'Deleted'
      default: return type
    }
  }

  const renderSegmentDiff = (before?: PathSegment, after?: PathSegment) => {
    if (!before && !after) return null

    const fields = ['name', 'type', 'fiberHeight', 'copperHeight', 'start', 'end'] as const
    const changedFields = fields.filter(field => {
      const beforeVal = before?.[field]
      const afterVal = after?.[field]
      return !deepEqual(beforeVal, afterVal)
    })

    if (changedFields.length === 0) return null

    return (
      <div className="mt-2 text-sm space-y-1">
        {changedFields.map(field => (
          <div key={field} className="flex items-center gap-2">
            <span className="font-medium text-gray-600 capitalize">{field}:</span>
            {before && (
              <span className="text-red-600 line-through">
                {String(before[field] ?? 'null')}
              </span>
            )}
            {after && (
              <span className="text-green-600">
                {String(after[field] ?? 'null')}
              </span>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Change History</h2>
        <button
          onClick={onClearHistory}
          className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
        >
          Clear History
        </button>
      </div>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {changes.map((change) => (
          <div
            key={change.id}
            className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${getChangeColor(change.type)}`}>
                  {getChangeLabel(change.type)}
                </span>
                <span className="text-sm text-gray-600">
                  Segment: {change.segmentId.slice(0, 8)}...
                </span>
                <span className="text-xs text-gray-400">
                  {formatTimestamp(change.timestamp)}
                </span>
              </div>
              <button
                onClick={() => onRevertChange(change)}
                className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs"
              >
                Revert
              </button>
            </div>
            {renderSegmentDiff(change.before, change.after)}
          </div>
        ))}
      </div>
    </div>
  )
}
