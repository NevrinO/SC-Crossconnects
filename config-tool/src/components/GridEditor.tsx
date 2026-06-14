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
  // Click-to-start / click-to-end segment creation
  const [segmentStart, setSegmentStart] = useState<GridPoint | null>(null)
  const [segmentEnd, setSegmentEnd] = useState<GridPoint | null>(null)
  const [hoverPoint, setHoverPoint] = useState<GridPoint | null>(null)
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

  const orientation = room.orientation || 'numbers-vertical'
  const isHorizontalNumbers = orientation === 'numbers-horizontal'

  // Axis labels depending on orientation:
  // numbers-vertical (default): X axis = letters, Y axis = numbers
  // numbers-horizontal: X axis = numbers (as strings), Y axis = letters
  const xAxisLabels: string[] = isHorizontalNumbers
    ? bounds.yLabels.map(String)
    : bounds.xLabels
  const yAxisLabels: string[] = isHorizontalNumbers
    ? bounds.xLabels
    : bounds.yLabels.map(String)

  const xAxisCount = xAxisLabels.length
  const yAxisCount = yAxisLabels.length

  // Convert screen coordinates to grid coordinates
  const screenToGrid = (clientX: number, clientY: number): GridPoint | null => {
    if (!containerRef.current) return null
    const rect = containerRef.current.getBoundingClientRect()
    // Account for container scroll position so coordinates are correct when scrolled
    const svgX = clientX - rect.left + containerRef.current.scrollLeft - pan.x
    const svgY = clientY - rect.top + containerRef.current.scrollTop - pan.y

    const xIndex = Math.floor(svgX / cellSize) - 1
    const yIndex = yAxisCount - Math.floor(svgY / cellSize)

    if (xIndex < 0 || xIndex >= xAxisCount || yIndex < 0 || yIndex >= yAxisCount) {
      return null
    }

    if (isHorizontalNumbers) {
      // X axis = numbers, Y axis = letters
      const numVal = bounds.yLabels[xIndex]
      const letterVal = bounds.xLabels[yIndex]
      return { x: letterVal, y: numVal }
    } else {
      return {
        x: bounds.xLabels[xIndex],
        y: bounds.yLabels[yIndex],
      }
    }
  }

  // Check if a new segment (defined only by path, height unknown until form) overlaps existing ones.
  // Same path at a different height is allowed, so we can only warn during drag.
  // 'full' = all heights on this path are taken (definite conflict regardless of choice).
  // 'partial' = path overlaps but heights may differ (warn, let validation decide after height entry).
  const checkOverlap = (start: GridPoint, end: GridPoint): 'none' | 'partial' | 'full' => {
    const isHorizontal = start.y === end.y
    let maxSeverity: 'none' | 'partial' | 'full' = 'none'

    for (const segment of room.pathSegments) {
      const segHorizontal = segment.start.y === segment.end.y
      if (isHorizontal !== segHorizontal) continue

      if (isHorizontal) {
        const [minX, maxX] = [start.x, end.x].sort(compareXLabels)
        const [segMinX, segMaxX] = [segment.start.x, segment.end.x].sort(compareXLabels)
        if (start.y !== segment.start.y) continue
        if (compareXLabels(maxX, segMinX) < 0 || compareXLabels(minX, segMaxX) > 0) continue
        const currentOverlap = (minX === segMinX && maxX === segMaxX) ? 'full' : 'partial'
        // During drag we don't know the new height yet — downgrade 'full' path overlap to 'partial'
        // so it shows as a warning instead of blocking. The form+validation handles the real height check.
        if (currentOverlap === 'full') return 'partial'
        if (currentOverlap === 'partial') maxSeverity = 'partial'
      } else {
        const [minY, maxY] = [start.y, end.y].sort((a, b) => a - b)
        const [segMinY, segMaxY] = [segment.start.y, segment.end.y].sort((a, b) => a - b)
        if (start.x !== segment.start.x) continue
        if (maxY < segMinY || minY > segMaxY) continue
        const currentOverlap = (minY === segMinY && maxY === segMaxY) ? 'full' : 'partial'
        // During drag we don't know the new height yet — downgrade 'full' path overlap to 'partial'
        // so it shows as a warning instead of blocking. The form+validation handles the real height check.
        if (currentOverlap === 'full') return 'partial'
        if (currentOverlap === 'partial') maxSeverity = 'partial'
      }
    }

    return maxSeverity
  }

  const handleZoomIn = () => setZoom(z => Math.min(maxZoom, parseFloat((z + 0.1).toFixed(1))))
  const handleZoomOut = () => setZoom(z => Math.max(minZoom, parseFloat((z - 0.1).toFixed(1))))


  // Snap to H or V from start based on which axis has greater distance
  const snapToAxis = (from: GridPoint, to: GridPoint): GridPoint => {
    const dx = Math.abs(
      (bounds.xIndexMap?.get(to.x) ?? 0) - (bounds.xIndexMap?.get(from.x) ?? 0)
    )
    const dy = Math.abs(to.y - from.y)
    if (dx >= dy) return { x: to.x, y: from.y }
    return { x: from.x, y: to.y }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    // Right-click drag to pan
    if (e.button === 2) {
      e.preventDefault()
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      return
    }
    if (e.button !== 0) return

    // Ignore clicks on the scrollbar (click target must be the SVG or a child of it)
    if (svgRef.current && !svgRef.current.contains(e.target as Node)) return

    const gridPoint = screenToGrid(e.clientX, e.clientY)
    if (!gridPoint) {
      // Clicked on grid margin/labels — start pan
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      return
    }

    // Clicking start dot: promote end→start, clear end so user picks a new end
    if (segmentStart && gridPoint.x === segmentStart.x && gridPoint.y === segmentStart.y) {
      if (segmentEnd) {
        setSegmentStart(segmentEnd)
        setSegmentEnd(null)
        setShowCreateButton(false)
        setOverlapWarning('none')
      } else {
        // No end yet — just cancel the start
        setSegmentStart(null)
        setOverlapWarning('none')
      }
      return
    }

    // Clicking end dot: clear only end so user repositions end (keep start)
    if (segmentEnd && gridPoint.x === segmentEnd.x && gridPoint.y === segmentEnd.y) {
      setSegmentEnd(null)
      setShowCreateButton(false)
      setOverlapWarning('none')
      return
    }

    // If create button is showing and click wasn't on a dot, ignore
    if (showCreateButton) return

    if (!segmentStart) {
      setSegmentStart(gridPoint)
      setOverlapWarning('none')
    } else {
      // Have start, picking end
      const snapped = snapToAxis(segmentStart, gridPoint)
      if (snapped.x === segmentStart.x && snapped.y === segmentStart.y) {
        // Same cell as start — cancel
        setSegmentStart(null)
        setSegmentEnd(null)
        setHoverPoint(null)
        return
      }
      setSegmentEnd(snapped)
      setOverlapWarning(checkOverlap(segmentStart, snapped))
      setShowCreateButton(true)
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
      return
    }
    // Update hover point for live preview line
    const gridPoint = screenToGrid(e.clientX, e.clientY)
    setHoverPoint(gridPoint)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }


  const handleCreateSegment = () => {
    if (segmentStart && segmentEnd) {
      setShowSegmentForm(true)
    }
  }

  const handleSegmentFormCreate = (segment: PathSegment) => {
    if (onSegmentCreate) onSegmentCreate(segment)
    setSegmentStart(null)
    setSegmentEnd(null)
    setHoverPoint(null)
    setShowCreateButton(false)
    setOverlapWarning('none')
  }

  const handleSegmentFormClose = () => {
    setShowSegmentForm(false)
    setSegmentStart(null)
    setSegmentEnd(null)
    setHoverPoint(null)
    setShowCreateButton(false)
    setOverlapWarning('none')
  }

  const handleCancelSegment = () => {
    setSegmentStart(null)
    setSegmentEnd(null)
    setHoverPoint(null)
    setShowCreateButton(false)
    setOverlapWarning('none')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleCancelSegment()
  }

  const handleReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const gridWidth = (xAxisCount + 2) * cellSize  // +1 left label col + 1 right label col
  const gridHeight = (yAxisCount + 2) * cellSize  // +1 top label row + 1 bottom label row

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
        <div>
          <h2 className="text-xl font-semibold">Grid Editor</h2>
          <p className="text-xs text-gray-500 mt-0.5">Click start → click end: draw segment &nbsp;•&nbsp; Right-click drag: pan &nbsp;•&nbsp; Scroll or +/− to zoom &nbsp;•&nbsp; Esc to cancel</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm font-bold w-8"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="text-sm text-gray-600 w-16 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm font-bold w-8"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm ml-2"
          >
            Reset View
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="border border-gray-300 rounded overflow-auto cursor-crosshair"
        style={{ height: '792px' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setIsDragging(false); setHoverPoint(null) }}
        onKeyDown={handleKeyDown}
        onContextMenu={(e) => e.preventDefault()}
        tabIndex={0}
      >
        <svg
          ref={svgRef}
          width={gridWidth}
          height={gridHeight}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
        >
          <g>
            {/* Grid cells */}
            {yAxisLabels.map((_y, yIndex) => (
              <g key={yIndex}>
                {xAxisLabels.map((_x, xIndex) => (
                  <rect
                    key={`${xIndex}-${yIndex}`}
                    x={(xIndex + 1) * cellSize}
                    y={(yAxisCount - yIndex) * cellSize}
                    width={cellSize}
                    height={cellSize}
                    fill="white"
                    stroke="#e5e7eb"
                    strokeWidth={1}
                  />
                ))}
              </g>
            ))}

            {/* X-axis labels — top */}
            {xAxisLabels.map((label, xIndex) => (
              <text
                key={`xt-${xIndex}`}
                x={(xIndex + 1) * cellSize + cellSize / 2}
                y={cellSize / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={12 * zoom}
                fill="#374151"
              >
                {label}
              </text>
            ))}

            {/* X-axis labels — bottom */}
            {xAxisLabels.map((label, xIndex) => (
              <text
                key={`xb-${xIndex}`}
                x={(xIndex + 1) * cellSize + cellSize / 2}
                y={(yAxisCount + 1) * cellSize + cellSize / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={12 * zoom}
                fill="#374151"
              >
                {label}
              </text>
            ))}

            {/* Y-axis labels — left */}
            {yAxisLabels.map((label, yIndex) => (
              <text
                key={`yl-${yIndex}`}
                x={cellSize / 2}
                y={(yAxisCount - yIndex) * cellSize + cellSize / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={12 * zoom}
                fill="#374151"
              >
                {label}
              </text>
            ))}

            {/* Y-axis labels — right */}
            {yAxisLabels.map((label, yIndex) => (
              <text
                key={`yr-${yIndex}`}
                x={(xAxisCount + 1) * cellSize + cellSize / 2}
                y={(yAxisCount - yIndex) * cellSize + cellSize / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={12 * zoom}
                fill="#374151"
              >
                {label}
              </text>
            ))}

            {/* Render segments */}
            {(() => {
              // Build a map from path-key → segment indices, so co-path segments get perpendicular offsets
              const pathGroups = new Map<string, number[]>()
              room.pathSegments.forEach((seg, idx) => {
                const isH = seg.start.y === seg.end.y
                const key = isH
                  ? `H:${seg.start.y}:${[seg.start.x, seg.end.x].sort(compareXLabels).join('-')}`
                  : `V:${seg.start.x}:${[seg.start.y, seg.end.y].sort((a,b)=>a-b).join('-')}`
                const group = pathGroups.get(key) ?? []
                group.push(idx)
                pathGroups.set(key, group)
              })

              // Compute perpendicular offset for each segment
              const OFFSET_PX = 5 * zoom
              const segmentOffsets = new Map<number, number>()
              pathGroups.forEach((indices) => {
                const count = indices.length
                indices.forEach((idx, slot) => {
                  // Centre the group: slot 0 of 1 → 0, slot 0 of 2 → -0.5, slot 1 of 2 → +0.5, etc.
                  segmentOffsets.set(idx, (slot - (count - 1) / 2) * OFFSET_PX)
                })
              })

              return room.pathSegments.map((segment, segIdx) => {
              let startXIndex: number, startYIndex: number, endXIndex: number, endYIndex: number
              if (isHorizontalNumbers) {
                startXIndex = bounds.yLabels.indexOf(segment.start.y)
                startYIndex = bounds.xLabels.indexOf(segment.start.x)
                endXIndex = bounds.yLabels.indexOf(segment.end.y)
                endYIndex = bounds.xLabels.indexOf(segment.end.x)
              } else {
                startXIndex = bounds.xLabels.indexOf(segment.start.x)
                startYIndex = bounds.yLabels.indexOf(segment.start.y)
                endXIndex = bounds.xLabels.indexOf(segment.end.x)
                endYIndex = bounds.yLabels.indexOf(segment.end.y)
              }

              if (startXIndex === -1 || startYIndex === -1 || endXIndex === -1 || endYIndex === -1) {
                return null
              }

              const x1 = (startXIndex + 1) * cellSize + cellSize / 2
              const y1 = (yAxisCount - startYIndex) * cellSize + cellSize / 2
              const x2 = (endXIndex + 1) * cellSize + cellSize / 2
              const y2 = (yAxisCount - endYIndex) * cellSize + cellSize / 2

              const color = segment.type === 'fiber-path'
                ? '#3b82f6'
                : segment.type === 'copper-path'
                  ? '#f97316'
                  : '#8b5cf6'

              // Apply perpendicular offset so co-path segments don't overlap
              const offset = segmentOffsets.get(segIdx) ?? 0
              const isHorizontalSeg = y1 === y2
              const ox = isHorizontalSeg ? 0 : offset
              const oy = isHorizontalSeg ? offset : 0
              const rx1 = x1 + ox, ry1 = y1 + oy, rx2 = x2 + ox, ry2 = y2 + oy

              const isSelected = selectedSegmentId === segment.id
              const strokeWidth = isSelected ? 5 * zoom : 3 * zoom

              return (
                <g key={segment.id}>
                  <line
                    x1={rx1}
                    y1={ry1}
                    x2={rx2}
                    y2={ry2}
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
                      x1={rx1}
                      y1={ry1}
                      x2={rx2}
                      y2={ry2}
                      stroke={color}
                      strokeWidth={strokeWidth + 4 * zoom}
                      strokeLinecap="round"
                      opacity={0.3}
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                </g>
              )
              })
            })()}

            {/* Render start point marker (clickable to reset) */}
            {segmentStart && (() => {
              let sxi: number, syi: number
              if (isHorizontalNumbers) {
                sxi = bounds.yLabels.indexOf(segmentStart.y)
                syi = bounds.xLabels.indexOf(segmentStart.x)
              } else {
                sxi = bounds.xLabels.indexOf(segmentStart.x)
                syi = bounds.yLabels.indexOf(segmentStart.y)
              }
              if (sxi === -1 || syi === -1) return null
              const cx = (sxi + 1) * cellSize + cellSize / 2
              const cy = (yAxisCount - syi) * cellSize + cellSize / 2
              return (
                <g style={{ cursor: 'pointer' }}>
                  <circle cx={cx} cy={cy} r={10 * zoom} fill="transparent" />
                  <circle cx={cx} cy={cy} r={7 * zoom} fill="#10b981" opacity={0.9} />
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={8 * zoom} fill="white" style={{ pointerEvents: 'none' }}>S</text>
                </g>
              )
            })()}

            {/* Render end point marker (clickable to re-pick) */}
            {segmentEnd && (() => {
              let exi: number, eyi: number
              if (isHorizontalNumbers) {
                exi = bounds.yLabels.indexOf(segmentEnd.y)
                eyi = bounds.xLabels.indexOf(segmentEnd.x)
              } else {
                exi = bounds.xLabels.indexOf(segmentEnd.x)
                eyi = bounds.yLabels.indexOf(segmentEnd.y)
              }
              if (exi === -1 || eyi === -1) return null
              const cx = (exi + 1) * cellSize + cellSize / 2
              const cy = (yAxisCount - eyi) * cellSize + cellSize / 2
              return (
                <g style={{ cursor: 'pointer' }}>
                  <circle cx={cx} cy={cy} r={10 * zoom} fill="transparent" />
                  <circle cx={cx} cy={cy} r={7 * zoom} fill="#3b82f6" opacity={0.9} />
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={8 * zoom} fill="white" style={{ pointerEvents: 'none' }}>E</text>
                </g>
              )
            })()}

            {/* Render preview line */}
            {(() => {
              // Determine the two anchor points for the preview
              let lineStart: GridPoint | null = null
              let lineEnd: GridPoint | null = null
              let isConfirmed = false

              if (segmentStart && segmentEnd) {
                lineStart = segmentStart; lineEnd = segmentEnd; isConfirmed = true
              } else if (segmentStart && hoverPoint && !showCreateButton) {
                lineStart = segmentStart; lineEnd = snapToAxis(segmentStart, hoverPoint)
              }

              if (!lineStart || !lineEnd) return null
              if (lineStart.x === lineEnd.x && lineStart.y === lineEnd.y) return null

              let x1i: number, y1i: number, x2i: number, y2i: number
              if (isHorizontalNumbers) {
                x1i = bounds.yLabels.indexOf(lineStart.y); y1i = bounds.xLabels.indexOf(lineStart.x)
                x2i = bounds.yLabels.indexOf(lineEnd.y);   y2i = bounds.xLabels.indexOf(lineEnd.x)
              } else {
                x1i = bounds.xLabels.indexOf(lineStart.x); y1i = bounds.yLabels.indexOf(lineStart.y)
                x2i = bounds.xLabels.indexOf(lineEnd.x);   y2i = bounds.yLabels.indexOf(lineEnd.y)
              }
              if (x1i === -1 || y1i === -1 || x2i === -1 || y2i === -1) return null
              return (
                <line
                  x1={(x1i + 1) * cellSize + cellSize / 2}
                  y1={(yAxisCount - y1i) * cellSize + cellSize / 2}
                  x2={(x2i + 1) * cellSize + cellSize / 2}
                  y2={(yAxisCount - y2i) * cellSize + cellSize / 2}
                  stroke={overlapWarning === 'partial' ? '#eab308' : '#10b981'}
                  strokeWidth={3 * zoom}
                  strokeLinecap="round"
                  strokeDasharray={isConfirmed ? undefined : `${5 * zoom}`}
                  opacity={isConfirmed ? 1 : 0.6}
                  style={{ pointerEvents: 'none' }}
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

      {/* Create Segment Button */}
      {showCreateButton && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Create Segment</span>
            {overlapWarning === 'partial' && (
              <span className="text-yellow-600 text-sm">⚠️ Same path — ensure different height</span>
            )}
          </div>
          <div className="text-sm text-gray-600 mb-3">
            From: {segmentStart?.x}{segmentStart?.y} → To: {segmentEnd?.x}{segmentEnd?.y}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreateSegment}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
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
      {segmentStart && segmentEnd && (
        <SegmentForm
          isOpen={showSegmentForm}
          start={segmentStart}
          end={segmentEnd}
          onClose={handleSegmentFormClose}
          onCreate={handleSegmentFormCreate}
        />
      )}
    </div>
  )
}
