import { useState } from 'react'
import { GridBounds, gridToScreen } from '../lib/grid-utils'
import { Cabinet } from '../types/room'

interface CabinetLayerProps {
  bounds: GridBounds
  cellSize: number
  orientation: 'numbers-vertical' | 'numbers-horizontal'
  cabinets: Cabinet[]
  startCabinet?: string
  endCabinet?: string
  highlightedCabinet?: string | null
  onCabinetClick: (cabinetId: string) => void
}

export function CabinetLayer({
  bounds,
  cellSize,
  orientation,
  cabinets,
  startCabinet,
  endCabinet,
  highlightedCabinet,
  onCabinetClick,
}: CabinetLayerProps) {
  const [hoveredCabinet, setHoveredCabinet] = useState<string | null>(null)

  // Get cabinet color based on type
  const getCabinetColor = (type: Cabinet['type']) => {
    switch (type) {
      case 'full_cab':
        return { fill: '#f3f4f6', stroke: '#9ca3af' } // gray-100, gray-400
      case 'network_rack':
        return { fill: '#dbeafe', stroke: '#2563eb' } // blue-100, blue-600
      case 'half_cab':
        return { fill: '#fef3c7', stroke: '#d97706' } // amber-100, amber-600
      case 'quarter_cab':
        return { fill: '#d1fae5', stroke: '#059669' } // green-100, green-600
      default:
        return { fill: '#ffffff', stroke: '#e5e7eb' } // white, gray-200
    }
  }

  const rectSize = cellSize * 0.8
  const offset = (cellSize - rectSize) / 2
  const hoverTargetSize = cellSize * 1.2
  const hoverOffset = (cellSize - hoverTargetSize) / 2

  return (
    <g>
      {/* Render all cabinets first */}
      {cabinets.map(cabinet => {
        const screenPos = gridToScreen({ x: cabinet.x, y: cabinet.y }, bounds, cellSize, orientation)
        if (!screenPos) return null

        const colors = getCabinetColor(cabinet.type)
        const isStart = startCabinet === cabinet.id
        const isEnd = endCabinet === cabinet.id
        const isHovered = hoveredCabinet === cabinet.id
        const isHighlighted = highlightedCabinet === cabinet.id

        return (
          <g key={cabinet.id}>
            {/* Invisible larger hover target for easier mouseover */}
            <rect
              x={screenPos.x + hoverOffset}
              y={screenPos.y + hoverOffset}
              width={hoverTargetSize}
              height={hoverTargetSize}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation()
                onCabinetClick(cabinet.id)
              }}
              onMouseEnter={() => setHoveredCabinet(cabinet.id)}
              onMouseLeave={() => setHoveredCabinet(null)}
            />

            {/* Cabinet rectangle */}
            <rect
              x={screenPos.x + offset}
              y={screenPos.y + offset}
              width={rectSize}
              height={rectSize}
              fill={colors.fill}
              stroke={colors.stroke}
              strokeWidth={isHovered ? 2 : 1}
              rx={2}
              pointerEvents="none"
            />

            {/* Start cabinet ring */}
            {isStart && (
              <rect
                x={screenPos.x + offset - 2}
                y={screenPos.y + offset - 2}
                width={rectSize + 4}
                height={rectSize + 4}
                fill="none"
                stroke="#2563eb"
                strokeWidth={3}
                rx={3}
                pointerEvents="none"
              />
            )}

            {/* End cabinet ring */}
            {isEnd && (
              <rect
                x={screenPos.x + offset - 2}
                y={screenPos.y + offset - 2}
                width={rectSize + 4}
                height={rectSize + 4}
                fill="none"
                stroke="#16a34a"
                strokeWidth={3}
                rx={3}
                pointerEvents="none"
              />
            )}

            {/* Highlighted cabinet ring (from search/jump) */}
            {isHighlighted && (
              <rect
                x={screenPos.x + offset - 4}
                y={screenPos.y + offset - 4}
                width={rectSize + 8}
                height={rectSize + 8}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={4}
                rx={4}
                style={{ animation: 'pulse 1s ease-in-out infinite' }}
                pointerEvents="none"
              />
            )}
          </g>
        )
      })}

      {/* Render tooltips after all cabinets so they're always on top */}
      {hoveredCabinet && (() => {
        const cabinet = cabinets.find(c => c.id === hoveredCabinet)
        if (!cabinet) return null
        const screenPos = gridToScreen({ x: cabinet.x, y: cabinet.y }, bounds, cellSize, orientation)
        if (!screenPos) return null

        return (
          <g key={`tooltip-${cabinet.id}`}>
            <rect
              x={screenPos.x + cellSize / 2}
              y={screenPos.y - 10}
              width={100}
              height={36}
              fill="#1f2937"
              rx={4}
              opacity={0.95}
            />
            <text
              x={screenPos.x + cellSize / 2 + 50}
              y={screenPos.y - 2}
              textAnchor="middle"
              fontSize={11}
              fill="white"
              dominantBaseline="middle"
              fontWeight="bold"
              pointerEvents="none"
            >
              {cabinet.id}
            </text>
            <text
              x={screenPos.x + cellSize / 2 + 50}
              y={screenPos.y + 12}
              textAnchor="middle"
              fontSize={10}
              fill="#9ca3af"
              dominantBaseline="middle"
              pointerEvents="none"
            >
              {cabinet.type.replace('_', ' ')}
            </text>
          </g>
        )
      })()}
    </g>
  )
}
