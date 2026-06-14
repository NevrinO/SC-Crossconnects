import { useState, useRef } from 'react'
import { Room, GridPoint, PathSegment } from '../types/editor'
import { calculateGridBounds, compareXLabels } from '../lib/grid-utils'
import { SegmentForm } from './SegmentForm'

interface GridEditorProps {
  room: Room
  onSegmentCreate?: (segment: PathSegment) => void
  onSegmentSelect?: (segmentId: string | null) => void
  selectedSegmentId?: string | null
}

export function GridEditor({ room, onSegmentCreate, onSegmentSelect, selectedSegmentId }: GridEditorProps) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isCreatingSegment, setIsCreatingSegment] = useState(false)
  const [segmentDragStart, setSegmentDragStart] = useState<GridPoint | null>(null)
  const [segmentDragEnd, setSegmentDragEnd] = useState<GridPoint | null>(null)
  const [segmentDragStartScreen, setSegmentDragStartScreen] = useState<{ x: number; y: number } | null>(null)
  const [showCreateButton, setShowCreateButton] = useState(false)
  const [overlapWarning, setOverlapWarning] = useState<'none' | 'partial' | 'full'>('none')
  const [showSegmentForm, setShowSegmentForm] = useState(false)
  const [hoveredSegment, setHoveredSegment] = useState<PathSegment | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const bounds = calculateGridBounds(room)
  const cellSize = 40 * zoom
  const minZoom = 0.5
  const maxZoom = 3

  // Convert screen coordinates to grid coordinates
  const screenToGrid = (clientX: number, clientY: number): GridPoint | null => {
    if (!containerRef.current) return null
    const rect = containerRef.current.getBoundingClientRect()
    const svgX = clientX - rect.left - pan.x
    const svgY = clientY - rect.top - pan.y

    const xIndex = Math.floor(svgX / cellSize) - 1
    const yIndex = bounds.yLabels.length - Math.floor(svgY / cellSize)

    if (xIndex < 0 || xIndex >= bounds.xLabels.length || yIndex < 0 || yIndex >= bounds.yLabels.length) {
      return null
    }

    return {
      x: bounds.xLabels[xIndex],
      y: bounds.yLabels[yIndex],
    }
  }

  // Check if two segments overlap
  const checkOverlap = (start: GridPoint, end: GridPoint): 'none' | 'partial' | 'full' => {
    for (const segment of room.pathSegments) {
      const isHorizontal = start.y === end.y
      const segHorizontal = segment.start.y === segment.end.y

      if (isHorizontal !== segHorizontal) continue

      if (isHorizontal) {
        const [minX, maxX] = [start.x, end.x].sort(compareXLabels)
        const [segMinX, segMaxX] = [segment.start.x, segment.end.x].sort(compareXLabels)
        
        if (minX === segMinX && maxX === segMaxX && start.y === segment.start.y) {
          return 'full'
        }
        if (compareXLabels(maxX, segMinX) >= 0 && compareXLabels(minX, segMaxX) <= 0 && start.y === segment.start.y) {
          return 'partial'
        }
      } else {
        const [minY, maxY] = [start.y, end.y].sort()
        const [segMinY, segMaxY] = [segment.start.y, segment.end.y].sort()
        
        if (minY === segMinY && maxY === segMaxY && start.x === segment.start.x) {
          return 'full'
        }
        if (maxY >= segMinY && minY <= segMaxY && start.x === segment.start.x) {
          return 'partial'
        }
      }
    }
    return 'none'
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    const newZoom = Math.max(minZoom, Math.min(maxZoom, zoom + delta))
    setZoom(newZoom)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      const gridPoint = screenToGrid(e.clientX, e.clientY)
      if (gridPoint) {
        setIsCreatingSegment(true)
        setSegmentDragStart(gridPoint)
        setSegmentDragEnd(gridPoint)
        setSegmentDragStartScreen({ x: e.clientX, y: e.clientY })
        setShowCreateButton(false)
        setOverlapWarning('none')
      } else {
        setIsDragging(true)
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isCreatingSegment && segmentDragStart && segmentDragStartScreen) {
      const gridPoint = screenToGrid(e.clientX, e.clientY)
      if (gridPoint) {
        // Snap to horizontal or vertical only
        const dx = gridPoint.x !== segmentDragStart.x
        const dy = gridPoint.y !== segmentDragStart.y
        
        let newEnd: GridPoint
        if (dx && dy) {
          // Prefer the axis with larger movement from drag start
          const screenDx = Math.abs(e.clientX - segmentDragStartScreen.x)
          const screenDy = Math.abs(e.clientY - segmentDragStartScreen.y)
          if (screenDx > screenDy) {
            newEnd = { x: gridPoint.x, y: segmentDragStart.y }
          } else {
            newEnd = { x: segmentDragStart.x, y: gridPoint.y }
          }
        } else {
          newEnd = gridPoint
        }

        setSegmentDragEnd(newEnd)
        setOverlapWarning(checkOverlap(segmentDragStart, newEnd))
      }
    } else if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }

  const handleMouseUp = () => {
    if (isCreatingSegment && segmentDragStart && segmentDragEnd) {
      // Only show create button if we have a valid segment (not just a click)
      if (segmentDragStart.x !== segmentDragEnd.x || segmentDragStart.y !== segmentDragEnd.y) {
        setShowCreateButton(true)
      } else {
        setIsCreatingSegment(false)
        setSegmentDragStart(null)
        setSegmentDragEnd(null)
      }
    }
    setIsDragging(false)
  }

  const handleCreateSegment = () => {
    if (segmentDragStart && segmentDragEnd) {
      setShowSegmentForm(true)
    }
  }

  const handleSegmentFormCreate = (segment: PathSegment) => {
    if (onSegmentCreate) {
      onSegmentCreate(segment)
    }
    setIsCreatingSegment(false)
    setSegmentDragStart(null)
    setSegmentDragEnd(null)
    setSegmentDragStartScreen(null)
    setShowCreateButton(false)
    setOverlapWarning('none')
  }

  const handleSegmentFormClose = () => {
    setShowSegmentForm(false)
    setIsCreatingSegment(false)
    setSegmentDragStart(null)
    setSegmentDragEnd(null)
    setSegmentDragStartScreen(null)
    setShowCreateButton(false)
    setOverlapWarning('none')
  }

  const handleCancelSegment = () => {
    setIsCreatingSegment(false)
    setSegmentDragStart(null)
    setSegmentDragEnd(null)
    setSegmentDragStartScreen(null)
    setShowCreateButton(false)
    setOverlapWarning('none')
  }

  const handleReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const gridWidth = (bounds.xLabels.length + 1) * cellSize
  const gridHeight = (bounds.yLabels.length + 1) * cellSize

  // Handle empty rooms gracefully
  if (bounds.xLabels.length === 0 || bounds.yLabels.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Grid Editor</h2>
        </div>
        <div className="flex items-center justify-center h-96 bg-gray-50 rounded border border-gray-300">
          <p className="text-gray-500">No segments to display</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Grid Editor</h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            Zoom: {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleReset}
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
          >
            Reset View
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="border border-gray-300 rounded overflow-hidden cursor-move"
        style={{ height: '600px' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          ref={svgRef}
          width={gridWidth}
          height={gridHeight}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
        >
          <g>
            {/* Grid cells */}
            {bounds.yLabels.map((y, yIndex) => (
              <g key={y}>
                {bounds.xLabels.map((x, xIndex) => (
                  <rect
                    key={`${x}-${y}`}
                    x={(xIndex + 1) * cellSize}
                    y={(bounds.yLabels.length - yIndex) * cellSize}
                    width={cellSize}
                    height={cellSize}
                    fill="white"
                    stroke="#e5e7eb"
                    strokeWidth={1}
                  />
                ))}
              </g>
            ))}

            {/* X-axis labels */}
            {bounds.xLabels.map((x, xIndex) => (
              <text
                key={`x-${x}`}
                x={(xIndex + 1) * cellSize + cellSize / 2}
                y={cellSize / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={12 * zoom}
                fill="#374151"
              >
                {x}
              </text>
            ))}

            {/* Y-axis labels */}
            {bounds.yLabels.map((y, yIndex) => (
              <text
                key={`y-${y}`}
                x={cellSize / 2}
                y={(bounds.yLabels.length - yIndex) * cellSize + cellSize / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={12 * zoom}
                fill="#374151"
              >
                {y}
              </text>
            ))}

            {/* Render segments */}
            {room.pathSegments.map((segment) => {
              const startXIndex = bounds.xLabels.indexOf(segment.start.x)
              const startYIndex = bounds.yLabels.indexOf(segment.start.y)
              const endXIndex = bounds.xLabels.indexOf(segment.end.x)
              const endYIndex = bounds.yLabels.indexOf(segment.end.y)

              if (startXIndex === -1 || startYIndex === -1 || endXIndex === -1 || endYIndex === -1) {
                return null
              }

              const x1 = (startXIndex + 1) * cellSize + cellSize / 2
              const y1 = (bounds.yLabels.length - startYIndex) * cellSize + cellSize / 2
              const x2 = (endXIndex + 1) * cellSize + cellSize / 2
              const y2 = (bounds.yLabels.length - endYIndex) * cellSize + cellSize / 2

              const color = segment.type === 'fiber-path'
                ? '#3b82f6'
                : segment.type === 'ladder-rack'
                  ? '#f97316'
                  : '#8b5cf6'

              const isSelected = selectedSegmentId === segment.id
              const strokeWidth = isSelected ? 5 * zoom : 3 * zoom

              return (
                <g key={segment.id}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (onSegmentSelect) {
                        onSegmentSelect(segment.id)
                      }
                    }}
                    onMouseEnter={(e) => {
                      setHoveredSegment(segment)
                      if (containerRef.current) {
                        const rect = containerRef.current.getBoundingClientRect()
                        setTooltipPosition({
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top
                        })
                      }
                    }}
                    onMouseMove={(e) => {
                      if (containerRef.current) {
                        const rect = containerRef.current.getBoundingClientRect()
                        setTooltipPosition({
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top
                        })
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredSegment(null)
                      setTooltipPosition(null)
                    }}
                  />
                  {/* Selection highlight glow */}
                  {isSelected && (
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={color}
                      strokeWidth={strokeWidth + 4 * zoom}
                      strokeLinecap="round"
                      opacity={0.3}
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                </g>
              )
            })}

            {/* Render preview line during segment creation */}
            {isCreatingSegment && segmentDragStart && segmentDragEnd && (() => {
              const startXIndex = bounds.xLabels.indexOf(segmentDragStart.x)
              const startYIndex = bounds.yLabels.indexOf(segmentDragStart.y)
              const endXIndex = bounds.xLabels.indexOf(segmentDragEnd.x)
              const endYIndex = bounds.yLabels.indexOf(segmentDragEnd.y)

              if (startXIndex === -1 || startYIndex === -1 || endXIndex === -1 || endYIndex === -1) {
                return null
              }

              return (
                <line
                  x1={(startXIndex + 1) * cellSize + cellSize / 2}
                  y1={(bounds.yLabels.length - startYIndex) * cellSize + cellSize / 2}
                  x2={(endXIndex + 1) * cellSize + cellSize / 2}
                  y2={(bounds.yLabels.length - endYIndex) * cellSize + cellSize / 2}
                  stroke={overlapWarning === 'full' ? '#ef4444' : overlapWarning === 'partial' ? '#eab308' : '#10b981'}
                  strokeWidth={3 * zoom}
                  strokeLinecap="round"
                  strokeDasharray={5 * zoom}
                />
              )
            })()}
          </g>

          {/* Tooltip */}
          {hoveredSegment && tooltipPosition && (
            <foreignObject
              x={tooltipPosition.x + 10}
              y={tooltipPosition.y + 10}
              width={200}
              height={100}
            >
              <div className="bg-gray-900 text-white text-xs p-2 rounded shadow-lg pointer-events-none">
                <div className="font-semibold mb-1">{hoveredSegment.name}</div>
                <div>Type: {hoveredSegment.type}</div>
                <div>Start: {hoveredSegment.start.x}{hoveredSegment.start.y}</div>
                <div>End: {hoveredSegment.end.x}{hoveredSegment.end.y}</div>
                {hoveredSegment.fiberHeight && <div>Fiber: {hoveredSegment.fiberHeight}ft</div>}
                {hoveredSegment.copperHeight && <div>Copper: {hoveredSegment.copperHeight}ft</div>}
              </div>
            </foreignObject>
          )}
        </svg>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p>Scroll to zoom • Drag to pan • Click and drag on grid to create segment</p>
      </div>

      {/* Create Segment Button */}
      {showCreateButton && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Create Segment</span>
            {overlapWarning === 'full' && (
              <span className="text-red-600 text-sm">⚠️ Full overlap detected</span>
            )}
            {overlapWarning === 'partial' && (
              <span className="text-yellow-600 text-sm">⚠️ Partial overlap detected</span>
            )}
          </div>
          <div className="text-sm text-gray-600 mb-3">
            From: {segmentDragStart?.x}{segmentDragStart?.y} → To: {segmentDragEnd?.x}{segmentDragEnd?.y}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreateSegment}
              disabled={overlapWarning === 'full'}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md text-sm"
            >
              Create Segment
            </button>
            <button
              onClick={handleCancelSegment}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Segment Form Modal */}
      {segmentDragStart && segmentDragEnd && (
        <SegmentForm
          isOpen={showSegmentForm}
          start={segmentDragStart}
          end={segmentDragEnd}
          onClose={handleSegmentFormClose}
          onCreate={handleSegmentFormCreate}
        />
      )}
    </div>
  )
}
