import { GridBounds } from '../lib/grid-utils'

interface GridLayerProps {
  bounds: GridBounds
  cellSize: number
  orientation: 'numbers-vertical' | 'numbers-horizontal'
}

export function GridLayer({ bounds, cellSize, orientation }: GridLayerProps) {
  const isHorizontalNumbers = orientation === 'numbers-horizontal'
  
  // Axis labels depending on orientation
  const xAxisLabels: string[] = isHorizontalNumbers
    ? bounds.yLabels.map(String)
    : bounds.xLabels
  const yAxisLabels: string[] = isHorizontalNumbers
    ? bounds.xLabels
    : bounds.yLabels.map(String)

  const xAxisCount = xAxisLabels.length
  const yAxisCount = yAxisLabels.length

  return (
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
          fontSize={12 * (cellSize / 40)}
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
          fontSize={12 * (cellSize / 40)}
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
          fontSize={12 * (cellSize / 40)}
          fill="#374151"
        >
          {String(label)}
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
          fontSize={12 * (cellSize / 40)}
          fill="#374151"
        >
          {String(label)}
        </text>
      ))}
    </g>
  )
}
