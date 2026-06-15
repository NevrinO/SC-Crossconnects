import { useState, useRef, useEffect, ReactNode } from 'react'
import { Room, GridPoint } from '../types/room'
import { calculateGridBounds } from '../lib/grid-utils'

interface RoomMapContainerProps {
  room: Room
  startCabinet?: string
  endCabinet?: string
  onSelectStart: (cabinetId: string) => void
  onSelectEnd: (cabinetId: string) => void
  children: (props: {
    bounds: ReturnType<typeof calculateGridBounds>
    cellSize: number
    orientation: 'numbers-vertical' | 'numbers-horizontal'
    startCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  }) => ReactNode
}

type ClickState = 'idle' | 'waiting-for-end' | 'both-selected'

export function RoomMapContainer({
  room,
  startCabinet,
  endCabinet,
  onSelectStart,
  onSelectEnd,
  children,
}: RoomMapContainerProps) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [clickState, setClickState] = useState<ClickState>('idle')
  
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const bounds = calculateGridBounds(room)
  const cellSize = 40 * zoom
  const minZoom = 0.5
  const maxZoom = 3

  const orientation = room.orientation || 'numbers-vertical'
  const startCorner = room.startCorner || 'top-left'

  // Axis labels depending on orientation
  const isHorizontalNumbers = orientation === 'numbers-horizontal'
  const xAxisLabels: string[] = isHorizontalNumbers
    ? bounds.yLabels.map(String)
    : bounds.xLabels
  const yAxisLabels: string[] = isHorizontalNumbers
    ? bounds.xLabels
    : bounds.yLabels.map(String)

  const xAxisCount = xAxisLabels.length
  const yAxisCount = yAxisLabels.length

  // Calculate grid dimensions for SVG viewBox
  const gridWidth = (xAxisCount + 2) * cellSize
  const gridHeight = (yAxisCount + 2) * cellSize

  // Update click state based on start/end cabinet values
  useEffect(() => {
    if (startCabinet && endCabinet) {
      setClickState('both-selected')
    } else if (startCabinet) {
      setClickState('waiting-for-end')
    } else {
      setClickState('idle')
    }
  }, [startCabinet, endCabinet])

  // Convert screen coordinates to grid coordinates
  const screenToGrid = (clientX: number, clientY: number): GridPoint | null => {
    if (!containerRef.current) return null
    const rect = containerRef.current.getBoundingClientRect()
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

  // Convert grid coordinates to cabinet ID
  const gridToCabinetId = (point: GridPoint): string => {
    if (room.coordinateFormat === 'numbers-first') {
      return `${point.y}${point.x}`
    }
    return `${point.x}${point.y}`
  }

  const handleZoomIn = () => setZoom(z => Math.min(maxZoom, parseFloat((z + 0.1).toFixed(1))))
  const handleZoomOut = () => setZoom(z => Math.max(minZoom, parseFloat((z - 0.1).toFixed(1))))
  const handleResetZoom = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Focus guard: only fire shortcuts when container has focus (not in INPUT/TEXTAREA/SELECT)
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      return
    }

    if (e.key === '+' || e.key === '=' || e.key === 'e' || e.key === 'E') {
      handleZoomIn()
      return
    }

    if (e.key === '-' || e.key === '_' || e.key === 'q' || e.key === 'Q') {
      handleZoomOut()
      return
    }

    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault()
      setPan(p => ({ ...p, y: p.y + 50 }))
      return
    }

    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      e.preventDefault()
      setPan(p => ({ ...p, y: p.y - 50 }))
      return
    }

    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      e.preventDefault()
      setPan(p => ({ ...p, x: p.x + 50 }))
      return
    }

    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      e.preventDefault()
      setPan(p => ({ ...p, x: p.x - 50 }))
      return
    }

    if (e.key === 'r' || e.key === 'R') {
      handleResetZoom()
      return
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    // Right-click drag to pan (unless Shift is held for context menu)
    if (e.button === 2 && !e.shiftKey) {
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

    const cabinetId = gridToCabinetId(gridPoint)

    // Amendment 8: Map click interaction rules
    if (clickState === 'idle') {
      // First click → sets Start
      onSelectStart(cabinetId)
      onSelectEnd('')
    } else if (clickState === 'waiting-for-end') {
      if (cabinetId === startCabinet) {
        // Click the start cabinet again → clear start
        onSelectStart('')
        onSelectEnd('')
      } else {
        // Second click → sets End
        onSelectEnd(cabinetId)
      }
    } else if (clickState === 'both-selected') {
      if (cabinetId === endCabinet) {
        // Click the End cabinet again → unsets End
        onSelectEnd('')
      } else if (cabinetId !== startCabinet) {
        // Click a third cabinet (neither start nor end) → clear both, set as new Start
        onSelectStart(cabinetId)
        onSelectEnd('')
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  return (
    <div className="flex flex-col h-full select-none">
      <div className="mb-2">
        <p className="text-xs text-gray-500">Click to select cabinets &nbsp;•&nbsp; Right-click drag: pan &nbsp;•&nbsp; +/− to zoom &nbsp;•&nbsp; WASD/Arrows: pan &nbsp;•&nbsp; R to reset</p>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={handleZoomOut}
          className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
          title="Zoom out (Q or -)"
        >
          −
        </button>
        <button
          onClick={handleZoomIn}
          className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
          title="Zoom in (E or +)"
        >
          +
        </button>
        <button
          onClick={handleResetZoom}
          className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
          title="Reset zoom (R)"
        >
          Reset
        </button>
        <span className="text-sm text-gray-600">
          Zoom: {Math.round(zoom * 100)}%
        </span>
      </div>

      <div
        ref={containerRef}
        className="flex-1 border border-gray-300 rounded overflow-auto bg-white cursor-crosshair relative"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onKeyDown={handleKeyDown}
        onContextMenu={handleContextMenu}
        tabIndex={0}
      >
        <svg
          ref={svgRef}
          width={gridWidth}
          height={gridHeight}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
        >
          <g>
            {children({
              bounds,
              cellSize,
              orientation,
              startCorner,
            })}
          </g>
        </svg>
      </div>
    </div>
  )
}
