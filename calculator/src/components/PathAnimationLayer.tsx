import { useMemo } from 'react'
import { GridBounds, gridToScreenCenter } from '../lib/grid-utils'
import { PathSegment } from '../types/room'

interface PathAnimationLayerProps {
  bounds: GridBounds
  cellSize: number
  orientation: 'numbers-vertical' | 'numbers-horizontal'
  selectedPathSegments: PathSegment[]
  selectedPathNodes?: string[]
  visible: boolean
}

export function PathAnimationLayer({
  bounds,
  cellSize,
  orientation,
  selectedPathSegments,
  selectedPathNodes,
  visible,
}: PathAnimationLayerProps) {
  // Build polyline path string from actual traversed nodes (includes midpoints)
  const pathData = useMemo(() => {
    if (selectedPathNodes && selectedPathNodes.length > 0) {
      // Use nodes array for accurate path (includes cabinet entry midpoints)
      return selectedPathNodes
        .map(nodeId => {
          const [x, y] = nodeId.split('-')
          const gridPoint = { x, y: Number(y) }
          const screenPos = gridToScreenCenter(gridPoint, bounds, cellSize, orientation)
          if (!screenPos) return null
          return `${screenPos.x} ${screenPos.y}`
        })
        .filter(Boolean)
        .join(' L ')
        .replace(/^/, 'M ')
    } else if (selectedPathSegments.length > 0) {
      // Fallback to segment endpoints if nodes not available
      return selectedPathSegments
        .map(segment => {
          const startPos = gridToScreenCenter(segment.start, bounds, cellSize, orientation)
          const endPos = gridToScreenCenter(segment.end, bounds, cellSize, orientation)
          if (!startPos || !endPos) return null
          return `M ${startPos.x} ${startPos.y} L ${endPos.x} ${endPos.y}`
        })
        .filter(Boolean)
        .join(' ')
    }
    return ''
  }, [selectedPathNodes, selectedPathSegments, bounds, cellSize, orientation])

  // Use pathData as key to force re-render and restart animation
  if (!visible || !pathData) return null

  return (
    <>
      <style>{`
        @keyframes path-travel {
          0% {
            stroke-dashoffset: 1000;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
      <g key={pathData}>
        {/* Animated traveling dot/dashed line along the path */}
        <path
          d={pathData}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={3}
          strokeDasharray="10 10"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            animation: 'path-travel 1.5s linear forwards',
          }}
        />
      </g>
    </>
  )
}
