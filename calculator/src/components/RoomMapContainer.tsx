import { useState, useRef, useEffect, ReactNode } from 'react'
import { Room, GridPoint } from '../types/room'
import { calculateGridBounds } from '../lib/grid-utils'

interface RoomMapContainerProps {
  room: Room
  startCabinet?: string
  endCabinet?: string
  selectedPathSegments?: import('../types/room').PathSegment[]
  cableType?: 'fiber' | 'copper' | null
  onSelectStart: (cabinetId: string) => void
  onSelectEnd: (cabinetId: string) => void
  onCalculate: () => void
  children: (props: {
    bounds: ReturnType<typeof calculateGridBounds>
    cellSize: number
    orientation: 'numbers-vertical' | 'numbers-horizontal'
    startCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    selectedPathSegments?: import('../types/room').PathSegment[]
    cableType?: 'fiber' | 'copper' | null
    startCabinet?: string
    endCabinet?: string
    highlightedCabinet?: string | null
    onCabinetClick: (cabinetId: string) => void
    onJumpToCabinet: (cabinetId: string) => void
    showGrid: boolean
    showCabinets: boolean
    showSegments: boolean
    showAnimation: boolean
    onToggleGrid: () => void
    onToggleCabinets: () => void
    onToggleSegments: () => void
    onToggleAnimation: () => void
  }) => ReactNode
}

type ClickState = 'idle' | 'waiting-for-end' | 'both-selected'

export function RoomMapContainer({
  room,
  startCabinet,
  endCabinet,
  selectedPathSegments,
  cableType,
  onSelectStart,
  onSelectEnd,
  onCalculate,
  children,
}: RoomMapContainerProps) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [clickState, setClickState] = useState<ClickState>('idle')
  const [highlightedCabinet, setHighlightedCabinet] = useState<string | null>(null)
  const [clickMode, setClickMode] = useState<'start' | 'end' | null>(null)
  const [showGrid, setShowGrid] = useState(true)
  const [showCabinets, setShowCabinets] = useState(true)
  const [showSegments, setShowSegments] = useState(true)
  const [showAnimation, setShowAnimation] = useState(true)
  
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

  // Cleanup clickMode on unmount to prevent confusing state persistence
  useEffect(() => {
    return () => {
      setClickMode(null)
    }
  }, [])

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

  const handleZoomIn = () => setZoom(z => Math.min(maxZoom, parseFloat((z + 0.1).toFixed(1))))
  const handleZoomOut = () => setZoom(z => Math.max(minZoom, parseFloat((z - 0.1).toFixed(1))))
  const handleResetZoom = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  // Feature 5: Cabinet search/jump functionality
  const handleJumpToCabinet = (cabinetId: string): boolean => {
    const cabinet = room.cabinets?.find(c => c.id === cabinetId)
    if (!cabinet) return false

    // Calculate screen position of the cabinet
    let xIndex: number
    let yIndex: number

    if (isHorizontalNumbers) {
      xIndex = bounds.yLabels.indexOf(cabinet.y)
      yIndex = bounds.xLabels.indexOf(cabinet.x)
    } else {
      xIndex = bounds.xLabels.indexOf(cabinet.x)
      yIndex = bounds.yLabels.indexOf(cabinet.y)
    }

    if (xIndex === -1 || yIndex === -1) return false

    const cabinetScreenX = (xIndex + 1) * cellSize + cellSize / 2
    const cabinetScreenY = (yAxisCount - yIndex) * cellSize + cellSize / 2

    // Calculate pan to center the cabinet
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const centerX = rect.width / 2
      const centerY = rect.height / 2

      setPan({
        x: centerX - cabinetScreenX,
        y: centerY - cabinetScreenY,
      })

      // Set zoom to a reasonable level for viewing
      setZoom(1.5)

      // Brief highlight
      setHighlightedCabinet(cabinetId)
      setTimeout(() => setHighlightedCabinet(null), 2000)
      return true
    }
    return false
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Focus guard: only fire shortcuts when container has focus (not in INPUT/TEXTAREA/SELECT)
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      return
    }

    // Feature 3: Keyboard shortcuts for map interaction
    if (e.key === '1') {
      // 1 — next click sets Start
      setClickMode('start')
      return
    }

    if (e.key === '2') {
      // 2 — next click sets End
      setClickMode('end')
      return
    }

    if (e.key === 'Escape') {
      // Esc — clear both Start and End
      onSelectStart('')
      onSelectEnd('')
      setClickMode(null)
      return
    }

    if (e.key === 'Enter') {
      // Enter — trigger Calculate
      onCalculate()
      return
    }

    if (e.key === 'x' || e.key === 'X') {
      // X — swap Start and End
      const temp = startCabinet
      onSelectStart(endCabinet || '')
      onSelectEnd(temp || '')
      return
    }

    // Navigation shortcuts
    if (e.key === 'e' || e.key === 'E') {
      handleZoomIn()
      return
    }

    if (e.key === 'q' || e.key === 'Q') {
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

    // Cabinet clicks are now handled by the CabinetLayer via onCabinetClick callback
    // Only start pan if clicking on non-cabinet areas
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
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
        <p className="text-xs text-gray-500">Click to select cabinets &nbsp;•&nbsp; Right-click drag: pan &nbsp;•&nbsp; E/Q: zoom &nbsp;•&nbsp; WASD/Arrows: pan &nbsp;•&nbsp; R: reset &nbsp;•&nbsp; 1/2: set Start/End &nbsp;•&nbsp; X: swap &nbsp;•&nbsp; Enter: calculate</p>
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
              selectedPathSegments,
              cableType,
              startCabinet,
              endCabinet,
              highlightedCabinet,
              onCabinetClick: (cabinetId: string) => {
                // Feature 3: If click mode is set, use it
                if (clickMode === 'start') {
                  onSelectStart(cabinetId)
                  onSelectEnd('')
                  setClickMode(null)
                  return
                }
                if (clickMode === 'end') {
                  onSelectEnd(cabinetId)
                  setClickMode(null)
                  return
                }

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
              },
              onJumpToCabinet: handleJumpToCabinet,
              showGrid,
              showCabinets,
              showSegments,
              showAnimation,
              onToggleGrid: () => setShowGrid(!showGrid),
              onToggleCabinets: () => setShowCabinets(!showCabinets),
              onToggleSegments: () => setShowSegments(!showSegments),
              onToggleAnimation: () => setShowAnimation(!showAnimation),
            })}
          </g>
        </svg>
      </div>
    </div>
  )
}
