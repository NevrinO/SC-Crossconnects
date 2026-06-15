import { useState } from 'react'
import { createPortal } from 'react-dom'
import { GridBounds, gridToScreenCenter } from '../lib/grid-utils'
import { PathSegment } from '../types/room'

interface SegmentLayerProps {
  bounds: GridBounds
  cellSize: number
  orientation: 'numbers-vertical' | 'numbers-horizontal'
  segments: PathSegment[]
  selectedPathSegments?: PathSegment[]
  cableType?: 'fiber' | 'copper' | null
}

export function SegmentLayer({
  bounds,
  cellSize,
  orientation,
  segments,
  selectedPathSegments = [],
  cableType,
}: SegmentLayerProps) {
  const [hoveredSegment, setHoveredSegment] = useState<PathSegment | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)

  // Determine segment visual state
  const getSegmentState = (segment: PathSegment): 'muted' | 'available' | 'selected' => {
    // Check if segment is in selected path
    if (selectedPathSegments.some(s => s.id === segment.id)) {
      return 'selected'
    }

    // Check if segment is available for selected cable type
    if (cableType) {
      const isFiber = cableType === 'fiber'
      const hasFiber = segment.fiberHeight !== null
      const hasCopper = segment.copperHeight !== null

      if (isFiber && hasFiber) return 'available'
      if (!isFiber && hasCopper) return 'available'
    }

    return 'muted'
  }

  // Get segment color based on type (matching config tool)
  const getSegmentColor = (segment: PathSegment): string => {
    if (segment.type === 'fiber-path') return '#3b82f6' // blue-500
    if (segment.type === 'copper-path') return '#f97316' // orange-500
    return '#8b5cf6' // violet-500 (mixed-path)
  }

  // Get segment style based on state
  const getSegmentStyle = (state: 'muted' | 'available' | 'selected', segment: PathSegment, zoom: number) => {
    const baseColor = getSegmentColor(segment)
    switch (state) {
      case 'selected':
        return { stroke: baseColor, strokeWidth: 5 * zoom, opacity: 1 }
      case 'available':
        return { stroke: baseColor, strokeWidth: 3 * zoom, opacity: 0.7 }
      case 'muted':
      default:
        return { stroke: baseColor, strokeWidth: 2 * zoom, opacity: 0.5 } // use type color with low opacity
    }
  }

  // Helper to compare letter labels for sorting
  const compareXLabels = (a: string, b: string) => a.localeCompare(b)

  // Build path groups and compute perpendicular offsets for co-path segments
  const pathGroups = new Map<string, string[]>()
  segments.forEach((seg) => {
    const isH = seg.start.y === seg.end.y
    const key = isH
      ? `H:${seg.start.y}:${[seg.start.x, seg.end.x].sort(compareXLabels).join('-')}`
      : `V:${seg.start.x}:${[seg.start.y, seg.end.y].sort((a,b)=>a-b).join('-')}`
    const group = pathGroups.get(key) ?? []
    group.push(seg.id)
    pathGroups.set(key, group)
  })

  // Compute perpendicular offset for each segment by ID
  // Offset scales with zoom (cellSize = 40 * zoom, so zoom = cellSize / 40)
  const zoom = cellSize / 40
  const OFFSET_PX = 5 * zoom
  const segmentOffsets = new Map<string, number>()
  pathGroups.forEach((segmentIds) => {
    const count = segmentIds.length
    segmentIds.forEach((segId, slot) => {
      // Centre the group: slot 0 of 1 → 0, slot 0 of 2 → -0.5, slot 1 of 2 → +0.5, etc.
      segmentOffsets.set(segId, (slot - (count - 1) / 2) * OFFSET_PX)
    })
  })

  return (
    <>
      <g>
        {segments.map(segment => {
          const startPos = gridToScreenCenter(segment.start, bounds, cellSize, orientation)
          const endPos = gridToScreenCenter(segment.end, bounds, cellSize, orientation)
          if (!startPos || !endPos) return null

          // Apply perpendicular offset so co-path segments don't overlap
          const offset = segmentOffsets.get(segment.id) ?? 0
          const isHorizontalSeg = startPos.y === endPos.y
          const ox = isHorizontalSeg ? 0 : offset
          const oy = isHorizontalSeg ? offset : 0
          const rx1 = startPos.x + ox, ry1 = startPos.y + oy, rx2 = endPos.x + ox, ry2 = endPos.y + oy

          const state = getSegmentState(segment)
          const style = getSegmentStyle(state, segment, zoom)
          const isHovered = hoveredSegment?.id === segment.id

          return (
            <line
              key={segment.id}
              x1={rx1}
              y1={ry1}
              x2={rx2}
              y2={ry2}
              stroke={style.stroke}
              strokeWidth={isHovered ? style.strokeWidth + 2 : style.strokeWidth}
              opacity={isHovered ? 1 : style.opacity}
              strokeLinecap="round"
              onMouseEnter={(e) => {
                setHoveredSegment(segment)
                setMousePos({ x: e.clientX, y: e.clientY })
              }}
              onMouseMove={(e) => {
                if (hoveredSegment?.id === segment.id) {
                  setMousePos({ x: e.clientX, y: e.clientY })
                }
              }}
              onMouseLeave={() => {
                setHoveredSegment(null)
                setMousePos(null)
              }}
              style={{ cursor: 'pointer' }}
            />
          )
        })}
      </g>
      {hoveredSegment && mousePos && createPortal(
        <div
          style={{
            position: 'fixed',
            left: mousePos.x + 10,
            top: mousePos.y + 10,
            pointerEvents: 'none',
            zIndex: 1000
          }}
        >
          <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg">
            <div className="font-semibold">{hoveredSegment.name}</div>
            {hoveredSegment.fiberHeight && <div className="text-blue-300">Fiber: {hoveredSegment.fiberHeight}ft</div>}
            {hoveredSegment.copperHeight && <div className="text-orange-300">Copper: {hoveredSegment.copperHeight}ft</div>}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
