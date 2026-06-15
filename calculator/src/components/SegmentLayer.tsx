import { useState } from 'react'
import { GridBounds, gridToScreenCenter, letterLabelToIndex } from '../lib/grid-utils'
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
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

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

  // Get segment style based on state
  const getSegmentStyle = (state: 'muted' | 'available' | 'selected') => {
    switch (state) {
      case 'selected':
        return { stroke: '#2563eb', strokeWidth: 4, opacity: 1 } // blue-600, thick
      case 'available':
        return { stroke: '#60a5fa', strokeWidth: 2, opacity: 0.7 } // blue-400, medium
      case 'muted':
      default:
        return { stroke: '#d1d5db', strokeWidth: 1, opacity: 0.4 } // gray-300, thin
    }
  }

  // Calculate segment length in grid units
  const getSegmentLength = (segment: PathSegment): number => {
    // Convert letter labels to numeric indices for x-axis
    const startXIndex = letterLabelToIndex(segment.start.x)
    const endXIndex = letterLabelToIndex(segment.end.x)
    const dx = Math.abs(endXIndex - startXIndex)
    const dy = Math.abs(segment.end.y - segment.start.y)
    return Math.sqrt(dx * dx + dy * dy)
  }

  return (
    <g>
      {segments.map(segment => {
        const startPos = gridToScreenCenter(segment.start, bounds, cellSize, orientation)
        const endPos = gridToScreenCenter(segment.end, bounds, cellSize, orientation)
        if (!startPos || !endPos) return null

        const state = getSegmentState(segment)
        const style = getSegmentStyle(state)
        const isHovered = hoveredSegment?.id === segment.id

        return (
          <line
            key={segment.id}
            x1={startPos.x}
            y1={startPos.y}
            x2={endPos.x}
            y2={endPos.y}
            stroke={style.stroke}
            strokeWidth={isHovered ? style.strokeWidth + 2 : style.strokeWidth}
            opacity={isHovered ? 1 : style.opacity}
            strokeLinecap="round"
            onMouseEnter={() => {
              setHoveredSegment(segment)
              // Calculate midpoint in SVG coordinates
              const midX = (startPos.x + endPos.x) / 2
              const midY = (startPos.y + endPos.y) / 2
              setTooltipPos({ x: midX, y: midY })
            }}
            onMouseLeave={() => {
              setHoveredSegment(null)
              setTooltipPos(null)
            }}
            style={{ cursor: 'pointer' }}
          />
        )
      })}

      {hoveredSegment && tooltipPos && (
        <foreignObject
          x={tooltipPos.x - 60}
          y={tooltipPos.y - 40}
          width={120}
          height={40}
          style={{ pointerEvents: 'none' }}
        >
          <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg">
            <div className="font-semibold">{hoveredSegment.id}</div>
            <div className="text-gray-300">{getSegmentLength(hoveredSegment).toFixed(1)} units</div>
          </div>
        </foreignObject>
      )}
    </g>
  )
}
