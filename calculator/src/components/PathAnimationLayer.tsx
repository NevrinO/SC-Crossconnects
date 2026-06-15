import { useMemo } from 'react'
import { GridBounds, gridToScreenCenter } from '../lib/grid-utils'
import { PathSegment } from '../types/room'

interface PathAnimationLayerProps {
  bounds: GridBounds
  cellSize: number
  orientation: 'numbers-vertical' | 'numbers-horizontal'
  selectedPathSegments: PathSegment[]
  visible: boolean
}

export function PathAnimationLayer({
  bounds,
  cellSize,
  orientation,
  selectedPathSegments,
  visible,
}: PathAnimationLayerProps) {
  // Build polyline path string from selected segments
  const pathData = useMemo(() => {
    if (selectedPathSegments.length === 0) return ''
    return selectedPathSegments
      .map(segment => {
        const startPos = gridToScreenCenter(segment.start, bounds, cellSize, orientation)
        const endPos = gridToScreenCenter(segment.end, bounds, cellSize, orientation)
        if (!startPos || !endPos) return null
        return `M ${startPos.x} ${startPos.y} L ${endPos.x} ${endPos.y}`
      })
      .filter(Boolean)
      .join(' ')
  }, [selectedPathSegments, bounds, cellSize, orientation])

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
