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

  return (
    <g>
      {cabinets.map(cabinet => {
        const screenPos = gridToScreen({ x: cabinet.x, y: cabinet.y }, bounds, cellSize, orientation)
        if (!screenPos) return null

        const colors = getCabinetColor(cabinet.type)
        const isStart = startCabinet === cabinet.id
        const isEnd = endCabinet === cabinet.id
        const isHovered = hoveredCabinet === cabinet.id
        const isHighlighted = highlightedCabinet === cabinet.id

        const rectSize = cellSize * 0.8
        const offset = (cellSize - rectSize) / 2

        return (
          <g key={cabinet.id}>
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
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation()
                onCabinetClick(cabinet.id)
              }}
              onMouseEnter={() => setHoveredCabinet(cabinet.id)}
              onMouseLeave={() => setHoveredCabinet(null)}
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
              />
            )}

            {/* Tooltip */}
            {isHovered && (
              <g>
                <rect
                  x={screenPos.x + cellSize / 2}
                  y={screenPos.y - 10}
                  width={80}
                  height={24}
                  fill="#1f2937"
                  rx={4}
                  opacity={0.9}
                />
                <text
                  x={screenPos.x + cellSize / 2 + 40}
                  y={screenPos.y + 2}
                  textAnchor="middle"
                  fontSize={11}
                  fill="white"
                  dominantBaseline="middle"
                >
                  {cabinet.id}
                </text>
              </g>
            )}
          </g>
        )
      })}
    </g>
  )
}
