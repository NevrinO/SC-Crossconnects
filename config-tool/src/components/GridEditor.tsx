import { useState, useRef, useEffect } from 'react'
import { Room, GridPoint, PathSegment, Cabinet } from '../types/editor'
import { calculateGridBounds, compareXLabels } from '../lib/grid-utils'
import { SegmentForm } from './SegmentForm'
import { showSuccess, showError } from '../lib/toast'

interface GridEditorProps {
  room: Room
  onSegmentCreate?: (segment: PathSegment) => void
  onSegmentSelect?: (segmentId: string | null) => void
  onSegmentDelete?: (segmentId: string) => void
  onCabinetChange?: (cabinets: Cabinet[]) => void
  onUndo?: (room: Room) => void
  onRedo?: (room: Room) => void
  selectedSegmentId?: string | null
}

export function GridEditor({ room, onSegmentCreate, onSegmentSelect, onSegmentDelete, onCabinetChange, onUndo, onRedo, selectedSegmentId }: GridEditorProps) {
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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; segment: PathSegment } | null>(null)
  const [showConnections, setShowConnections] = useState(true)
  const [layerFilter, setLayerFilter] = useState<'all' | 'fiber' | 'copper'>('all')
  const [showShortcutDialog, setShowShortcutDialog] = useState(false)
  const [measurementMode, setMeasurementMode] = useState(false)
  const [measurementPoints, setMeasurementPoints] = useState<GridPoint[]>([])
  const [measurementFinished, setMeasurementFinished] = useState(false)
  const [cabinetPlacementMode, setCabinetPlacementMode] = useState(false)
  const [cabinetPopover, setCabinetPopover] = useState<{ x: number; y: number; point: GridPoint } | null>(null)
  const [undoStack, setUndoStack] = useState<Room[]>([])
  const [redoStack, setRedoStack] = useState<Room[]>([])
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const measurementTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastClickTimeRef = useRef<number>(0)
  const lastClickPointRef = useRef<GridPoint | null>(null)

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

  // Cleanup measurement timeout on unmount
  useEffect(() => {
    return () => {
      if (measurementTimeoutRef.current) {
        clearTimeout(measurementTimeoutRef.current)
      }
    }
  }, [])

  // Find connections between segments (end of one matches start of another)
  const findConnections = (segment: PathSegment): PathSegment[] => {
    return room.pathSegments.filter(other => {
      if (other.id === segment.id) return false
      return (
        (other.start.x === segment.end.x && other.start.y === segment.end.y) ||
        (other.end.x === segment.start.x && other.end.y === segment.start.y)
      )
    })
  }

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

    // Cabinet placement mode: click to add/remove cabinets
    if (cabinetPlacementMode) {
      handleCabinetClick(gridPoint, e.clientX, e.clientY)
      return
    }

    // Measurement mode: add point on click, double-click to finish
    if (measurementMode) {
      const now = Date.now()
      const isDoubleClick = lastClickPointRef.current &&
        lastClickPointRef.current.x === gridPoint.x &&
        lastClickPointRef.current.y === gridPoint.y &&
        (now - lastClickTimeRef.current) < 300

      if (isDoubleClick && measurementPoints.length > 1) {
        // Double-click on same point - finish measurement but keep it visible
        setMeasurementMode(false)
        setMeasurementFinished(true)
        return
      }

      if (measurementPoints.length === 0) {
        startMeasurement(gridPoint)
      } else {
        // Add new point to continue path
        setMeasurementPoints([...measurementPoints, gridPoint])
      }

      lastClickTimeRef.current = now
      lastClickPointRef.current = gridPoint
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

  const clearMeasurement = () => {
    setMeasurementMode(false)
    setMeasurementPoints([])
    setMeasurementFinished(false)
    if (measurementTimeoutRef.current) {
      clearTimeout(measurementTimeoutRef.current)
      measurementTimeoutRef.current = null
    }
  }

  const startMeasurement = (point: GridPoint) => {
    setMeasurementMode(true)
    setMeasurementPoints([point])
    lastClickTimeRef.current = Date.now()
    lastClickPointRef.current = point
  }

  const calculateDistance = (start: GridPoint, end: GridPoint): { tiles: number; feet: number } | null => {
    let x1i: number, y1i: number, x2i: number, y2i: number
    if (isHorizontalNumbers) {
      x1i = bounds.yLabels.indexOf(start.y)
      y1i = bounds.xLabels.indexOf(start.x)
      x2i = bounds.yLabels.indexOf(end.y)
      y2i = bounds.xLabels.indexOf(end.x)
    } else {
      x1i = bounds.xLabels.indexOf(start.x)
      y1i = bounds.yLabels.indexOf(start.y)
      x2i = bounds.xLabels.indexOf(end.x)
      y2i = bounds.yLabels.indexOf(end.y)
    }
    
    // Validate points are within bounds
    if (x1i === -1 || y1i === -1 || x2i === -1 || y2i === -1) {
      return null
    }
    
    const dx = Math.abs(x2i - x1i)
    const dy = Math.abs(y2i - y1i)
    const tiles = Math.sqrt(dx * dx + dy * dy)
    const feet = tiles * room.tileSize
    return { tiles, feet }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Focus guard: only fire shortcuts when GridEditor has focus (not in INPUT/TEXTAREA/SELECT)
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      return
    }

    if (e.key === 'Escape') {
      handleCancelSegment()
      setContextMenu(null)
      clearMeasurement()
      setCabinetPopover(null)
      return
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedSegmentId && onSegmentDelete) {
        onSegmentDelete(selectedSegmentId)
        showSuccess('Segment deleted')
      }
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

    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      // Trigger manual save - this will be handled by parent component
      window.dispatchEvent(new CustomEvent('manual-save'))
      showSuccess('Saved')
      return
    }

    if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      if (e.shiftKey) {
        handleRedo()
        showSuccess('Redo')
      } else {
        handleUndo()
        showSuccess('Undo')
      }
      return
    }

    if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleRedo()
      showSuccess('Redo')
      return
    }

    if (e.key === '?') {
      setShowShortcutDialog(!showShortcutDialog)
      return
    }
  }

  const handleContextMenu = (e: React.MouseEvent, segment: PathSegment) => {
    if (!e.shiftKey) return
    e.preventDefault()
    e.stopPropagation()
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    setContextMenu({
      x: e.clientX - rect.left + container.scrollLeft,
      y: e.clientY - rect.top + container.scrollTop,
      segment
    })
  }

  const handleDuplicateSegment = () => {
    if (!contextMenu) return
    const newSegment: PathSegment = {
      ...contextMenu.segment,
      id: crypto.randomUUID(),
      name: `${contextMenu.segment.name} (Copy)`
    }
    if (onSegmentCreate) {
      onSegmentCreate(newSegment)
      showSuccess('Segment duplicated')
    }
    setContextMenu(null)
  }

  const handleDeleteSegment = () => {
    if (!contextMenu || !onSegmentDelete) return
    onSegmentDelete(contextMenu.segment.id)
    showSuccess('Segment deleted')
    setContextMenu(null)
  }

  const handleEditSegment = () => {
    if (!contextMenu) return
    if (onSegmentSelect) {
      onSegmentSelect(contextMenu.segment.id)
    }
    setContextMenu(null)
  }

  const handleReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  // Cabinet helpers
  const getCabinetAtPoint = (point: GridPoint): Cabinet | null => {
    const cabinets = room.cabinets || []
    return cabinets.find(c => c.x === point.x && c.y === point.y) || null
  }

  const getCabinetColor = (type: Cabinet['type']): { fill: string; stroke: string } => {
    switch (type) {
      case 'full_cab':
        return { fill: '#f3f4f6', stroke: '#9ca3af' }
      case 'network_rack':
        return { fill: '#dbeafe', stroke: '#2563eb' }
      case 'half_cab':
        return { fill: '#fef3c7', stroke: '#d97706' }
      case 'quarter_cab':
        return { fill: '#d1fae5', stroke: '#059669' }
    }
  }

  const handleCabinetClick = (point: GridPoint, clientX: number, clientY: number) => {
    const existing = getCabinetAtPoint(point)
    if (existing) {
      // Show popover to change type or remove
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setCabinetPopover({
          x: clientX - rect.left + containerRef.current.scrollLeft,
          y: clientY - rect.top + containerRef.current.scrollTop,
          point
        })
      }
    } else {
      // Push current state to undo stack before adding cabinet
      setUndoStack(prev => [...prev.slice(-49), JSON.parse(JSON.stringify(room))])
      setRedoStack([])

      // Add new full_cab
      const newCabinet: Cabinet = {
        id: `${point.x}${point.y}`,
        x: point.x,
        y: point.y,
        type: 'full_cab'
      }
      const updatedCabinets = [...(room.cabinets || []), newCabinet]
      if (onCabinetChange) {
        onCabinetChange(updatedCabinets)
      }
    }
  }

  const handleCabinetTypeChange = (point: GridPoint, newType: Cabinet['type'] | 'remove') => {
    // Push current state to undo stack before making changes
    setUndoStack(prev => [...prev.slice(-49), JSON.parse(JSON.stringify(room))])
    setRedoStack([])

    const cabinets = room.cabinets || []
    const existing = getCabinetAtPoint(point)
    if (existing) {
      if (newType === 'remove') {
        const updated = cabinets.filter(c => !(c.x === point.x && c.y === point.y))
        if (onCabinetChange) onCabinetChange(updated)
      } else {
        const updated = cabinets.map(c =>
          c.x === point.x && c.y === point.y ? { ...c, type: newType } : c
        )
        if (onCabinetChange) onCabinetChange(updated)
      }
    }
    setCabinetPopover(null)
  }

  const handleUndo = () => {
    if (undoStack.length === 0) return
    const previous = undoStack[undoStack.length - 1]
    setUndoStack(prev => prev.slice(0, -1))
    setRedoStack(prev => [...prev, JSON.parse(JSON.stringify(room))])
    // Trigger parent to restore the room state
    if (onUndo) onUndo(previous)
  }

  const handleRedo = () => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setRedoStack(prev => prev.slice(0, -1))
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(room))])
    // Trigger parent to restore the room state
    if (onRedo) onRedo(next)
  }

  const handleExportImage = () => {
    if (!svgRef.current) return
    const svg = svgRef.current
    
    // Validate SVG has valid dimensions
    if (!svg.width.baseVal.value || !svg.height.baseVal.value) {
      showError('Cannot export: SVG has invalid dimensions')
      return
    }
    
    const serializer = new XMLSerializer()
    let svgString: string
    try {
      svgString = serializer.serializeToString(svg)
    } catch (e) {
      showError('Failed to serialize SVG for export')
      return
    }
    
    // Validate SVG string is not empty
    if (!svgString || svgString.length === 0) {
      showError('Cannot export: SVG serialization produced empty result')
      return
    }
    
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = svg.width.baseVal.value
        canvas.height = svg.height.baseVal.value
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.fillStyle = 'white'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0)
          const pngUrl = canvas.toDataURL('image/png')
          const link = document.createElement('a')
          link.download = `${room.name.replace(/[^a-z0-9]/gi, '_')}_grid.png`
          link.href = pngUrl
          link.click()
          showSuccess('Image exported')
        } else {
          showError('Failed to get canvas context for export')
        }
      } catch (e) {
        showError('Failed to convert SVG to PNG')
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    
    img.onerror = () => {
      showError('Failed to load SVG for export')
      URL.revokeObjectURL(url)
    }
    
    img.src = url
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
          <p className="text-xs text-gray-500 mt-0.5">Click start → click end: draw segment &nbsp;•&nbsp; Right-click drag: pan &nbsp;•&nbsp; Shift+Right-click: context menu &nbsp;•&nbsp; Scroll or +/− to zoom &nbsp;•&nbsp; WASD/Arrows: pan &nbsp;•&nbsp; Esc to cancel</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="px-2 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            ↶ Undo
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="px-2 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
          >
            ↷ Redo
          </button>
          <select
            value={layerFilter}
            onChange={(e) => setLayerFilter(e.target.value as any)}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          >
            <option value="all">All Layers</option>
            <option value="fiber">Fiber Only</option>
            <option value="copper">Copper Only</option>
          </select>
          <button
            onClick={() => setShowConnections(!showConnections)}
            className={`px-2 py-1 border rounded text-sm ${showConnections ? 'bg-blue-100 border-blue-300' : 'bg-gray-50 border-gray-300'}`}
          >
            {showConnections ? 'Hide Connections' : 'Show Connections'}
          </button>
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
            title="Reset zoom and pan to default"
          >
            Reset View
          </button>
          <button
            onClick={() => setShowShortcutDialog(true)}
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm ml-2"
            title="Keyboard shortcuts (?)"
          >
            ⌨️ Shortcuts
          </button>
          <button
            onClick={() => {
              clearMeasurement()
              setMeasurementMode(!measurementMode)
            }}
            className={`px-3 py-1 rounded text-sm ml-2 ${measurementMode ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-200 hover:bg-gray-300'}`}
            title="Measurement tool"
          >
            📏 Measure
          </button>
          <button
            onClick={() => setCabinetPlacementMode(!cabinetPlacementMode)}
            className={`px-3 py-1 rounded text-sm ml-2 ${cabinetPlacementMode ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-200 hover:bg-gray-300'}`}
            title="Cabinet placement mode"
          >
            🗄️ Cabinets
          </button>
          {measurementMode && measurementPoints.length >= 2 && (
            <button
              onClick={() => {
                setMeasurementMode(false)
                setMeasurementFinished(true)
              }}
              className="px-3 py-1 bg-green-500 text-white hover:bg-green-600 rounded text-sm ml-2"
              title="Finish measurement"
            >
              ✓ Finish
            </button>
          )}
          <button
            onClick={handleExportImage}
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm ml-2"
            title="Export as PNG"
          >
            📷 Export Image
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="border border-gray-300 rounded overflow-auto cursor-crosshair relative"
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
                {xAxisLabels.map((_x, xIndex) => {
                  // Map display position (xIndex, yIndex) to actual GridPoint coordinates
                  // GridPoint is always { x: string (letter), y: number } regardless of orientation
                  // Orientation only affects which axis displays letters vs numbers
                  let gridX: string, gridY: number
                  if (isHorizontalNumbers) {
                    // X axis displays numbers, Y axis displays letters
                    // So xIndex maps to bounds.yLabels (numbers), yIndex maps to bounds.xLabels (letters)
                    gridX = bounds.xLabels[yIndex]
                    gridY = bounds.yLabels[xIndex]
                  } else {
                    // X axis displays letters, Y axis displays numbers
                    // So xIndex maps to bounds.xLabels (letters), yIndex maps to bounds.yLabels (numbers)
                    gridX = bounds.xLabels[xIndex]
                    gridY = bounds.yLabels[yIndex]
                  }
                  const cabinet = getCabinetAtPoint({ x: gridX, y: gridY })
                  const colors = cabinet ? getCabinetColor(cabinet.type) : null

                  return (
                    <g key={`${xIndex}-${yIndex}`}>
                      <rect
                        x={(xIndex + 1) * cellSize}
                        y={(yAxisCount - yIndex) * cellSize}
                        width={cellSize}
                        height={cellSize}
                        fill={colors?.fill || 'white'}
                        stroke={colors?.stroke || '#e5e7eb'}
                        strokeWidth={cabinet ? 2 : 1}
                      />
                      {cabinet && cabinetPlacementMode && colors && (
                        <rect
                          x={(xIndex + 1) * cellSize + 4 * zoom}
                          y={(yAxisCount - yIndex) * cellSize + 4 * zoom}
                          width={cellSize - 8 * zoom}
                          height={cellSize - 8 * zoom}
                          fill="none"
                          stroke={colors.stroke}
                          strokeWidth={2 * zoom}
                          style={{ pointerEvents: 'none' }}
                        />
                      )}
                    </g>
                  )
                })}
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
              // Filter segments by layer first
              const filteredSegments = room.pathSegments.filter(segment => {
                if (layerFilter === 'all') return true
                if (layerFilter === 'fiber') return segment.type === 'fiber-path' || segment.type === 'mixed-path'
                if (layerFilter === 'copper') return segment.type === 'copper-path' || segment.type === 'mixed-path'
                return true
              })

              // Build a map from path-key → segment IDs, so co-path segments get perpendicular offsets
              const pathGroups = new Map<string, string[]>()
              filteredSegments.forEach((seg) => {
                const isH = seg.start.y === seg.end.y
                const key = isH
                  ? `H:${seg.start.y}:${[seg.start.x, seg.end.x].sort(compareXLabels).join('-')}`
                  : `V:${seg.start.x}:${[seg.start.y, seg.end.y].sort((a,b)=>a-b).join('-')}`
                const group = pathGroups.get(key) ?? []
                group.push(seg.id)
                pathGroups.set(key, group)
              })

              // Compute perpendicular offset for each segment by ID
              const OFFSET_PX = 5 * zoom
              const segmentOffsets = new Map<string, number>()
              pathGroups.forEach((segmentIds) => {
                const count = segmentIds.length
                segmentIds.forEach((segId, slot) => {
                  // Centre the group: slot 0 of 1 → 0, slot 0 of 2 → -0.5, slot 1 of 2 → +0.5, etc.
                  segmentOffsets.set(segId, (slot - (count - 1) / 2) * OFFSET_PX)
                })
              })

              return filteredSegments.map((segment) => {
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
              const offset = segmentOffsets.get(segment.id) ?? 0
              const isHorizontalSeg = y1 === y2
              const ox = isHorizontalSeg ? 0 : offset
              const oy = isHorizontalSeg ? offset : 0
              const rx1 = x1 + ox, ry1 = y1 + oy, rx2 = x2 + ox, ry2 = y2 + oy

              const isSelected = selectedSegmentId === segment.id
              const strokeWidth = isSelected ? 5 * zoom : 3 * zoom

              // Find connections for this segment
              const connections = showConnections ? findConnections(segment) : []

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
                    onContextMenu={(e) => handleContextMenu(e, segment)}
                    onMouseEnter={(e) => {
                      setHoveredSegment(segment)
                      if (containerRef.current) {
                        const rect = containerRef.current.getBoundingClientRect()
                        setTooltipPosition({
                          x: e.clientX - rect.left + (containerRef.current.scrollLeft || 0),
                          y: e.clientY - rect.top + (containerRef.current.scrollTop || 0)
                        })
                      }
                    }}
                    onMouseMove={(e) => {
                      if (containerRef.current) {
                        const rect = containerRef.current.getBoundingClientRect()
                        setTooltipPosition({
                          x: e.clientX - rect.left + (containerRef.current.scrollLeft || 0),
                          y: e.clientY - rect.top + (containerRef.current.scrollTop || 0)
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
                  {/* Connection indicators */}
                  {showConnections && connections.map(conn => {
                    // Determine connection point (start or end)
                    const isStartConnected = conn.start.x === segment.end.x && conn.start.y === segment.end.y
                    const isEndConnected = conn.end.x === segment.start.x && conn.end.y === segment.start.y
                    const cx = isStartConnected ? rx2 : isEndConnected ? rx1 : null
                    const cy = isStartConnected ? ry2 : isEndConnected ? ry1 : null
                    if (cx === null || cy === null) return null
                    return (
                      <circle
                        key={conn.id}
                        cx={cx}
                        cy={cy}
                        r={6 * zoom}
                        fill="#10b981"
                        stroke="white"
                        strokeWidth={2 * zoom}
                        style={{ pointerEvents: 'none' }}
                      />
                    )
                  })}
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

            {/* Render measurement lines */}
            {(measurementPoints.length > 0 || measurementFinished) && (() => {
              const segments: { x1: number; y1: number; x2: number; y2: number; distance: { tiles: number; feet: number } }[] = []
              let totalTiles = 0
              let totalFeet = 0

              // Calculate all segment distances
              for (let i = 0; i < measurementPoints.length - 1; i++) {
                const start = measurementPoints[i]
                const end = measurementPoints[i + 1]
                const distance = calculateDistance(start, end)
                if (distance) {
                  totalTiles += distance.tiles
                  totalFeet += distance.feet

                  let x1i: number, y1i: number, x2i: number, y2i: number
                  if (isHorizontalNumbers) {
                    x1i = bounds.yLabels.indexOf(start.y); y1i = bounds.xLabels.indexOf(start.x)
                    x2i = bounds.yLabels.indexOf(end.y);   y2i = bounds.xLabels.indexOf(end.x)
                  } else {
                    x1i = bounds.xLabels.indexOf(start.x); y1i = bounds.yLabels.indexOf(start.y)
                    x2i = bounds.xLabels.indexOf(end.x);   y2i = bounds.yLabels.indexOf(end.y)
                  }
                  if (x1i === -1 || y1i === -1 || x2i === -1 || y2i === -1) continue

                  const x1 = (x1i + 1) * cellSize + cellSize / 2
                  const y1 = (yAxisCount - y1i) * cellSize + cellSize / 2
                  const x2 = (x2i + 1) * cellSize + cellSize / 2
                  const y2 = (yAxisCount - y2i) * cellSize + cellSize / 2

                  segments.push({ x1, y1, x2, y2, distance })
                }
              }

              if (segments.length === 0 && measurementPoints.length === 0) return null

              // Add preview line to hover position if in measurement mode
              let previewLine = null
              if (measurementMode && hoverPoint && measurementPoints.length > 0) {
                const lastPoint = measurementPoints[measurementPoints.length - 1]
                let x1i: number, y1i: number, x2i: number, y2i: number
                if (isHorizontalNumbers) {
                  x1i = bounds.yLabels.indexOf(lastPoint.y); y1i = bounds.xLabels.indexOf(lastPoint.x)
                  x2i = bounds.yLabels.indexOf(hoverPoint.y);   y2i = bounds.xLabels.indexOf(hoverPoint.x)
                } else {
                  x1i = bounds.xLabels.indexOf(lastPoint.x); y1i = bounds.yLabels.indexOf(lastPoint.y)
                  x2i = bounds.xLabels.indexOf(hoverPoint.x);   y2i = bounds.yLabels.indexOf(hoverPoint.y)
                }
                if (x1i !== -1 && y1i !== -1 && x2i !== -1 && y2i !== -1) {
                  const x1 = (x1i + 1) * cellSize + cellSize / 2
                  const y1 = (yAxisCount - y1i) * cellSize + cellSize / 2
                  const x2 = (x2i + 1) * cellSize + cellSize / 2
                  const y2 = (yAxisCount - y2i) * cellSize + cellSize / 2
                  previewLine = (
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#ef4444"
                      strokeWidth={2 * zoom}
                      strokeLinecap="round"
                      strokeDasharray={`${5 * zoom}`}
                      opacity={0.5}
                      style={{ pointerEvents: 'none' }}
                    />
                  )
                }
              }

              return (
                <g>
                  {/* Render all segment lines */}
                  {segments.map((seg, idx) => (
                    <line
                      key={idx}
                      x1={seg.x1}
                      y1={seg.y1}
                      x2={seg.x2}
                      y2={seg.y2}
                      stroke="#ef4444"
                      strokeWidth={2 * zoom}
                      strokeLinecap="round"
                      strokeDasharray={`${5 * zoom}`}
                      style={{ pointerEvents: 'none' }}
                    />
                  ))}
                  {/* Render preview line */}
                  {previewLine}
                  {/* Render all points */}
                  {measurementPoints.map((point, idx) => {
                    let xi: number, yi: number
                    if (isHorizontalNumbers) {
                      xi = bounds.yLabels.indexOf(point.y)
                      yi = bounds.xLabels.indexOf(point.x)
                    } else {
                      xi = bounds.xLabels.indexOf(point.x)
                      yi = bounds.yLabels.indexOf(point.y)
                    }
                    if (xi === -1 || yi === -1) return null
                    const x = (xi + 1) * cellSize + cellSize / 2
                    const y = (yAxisCount - yi) * cellSize + cellSize / 2
                    return (
                      <circle
                        key={`point-${idx}`}
                        cx={x}
                        cy={y}
                        r={4 * zoom}
                        fill="#ef4444"
                        style={{ pointerEvents: 'none' }}
                      />
                    )
                  })}
                  {/* Render individual segment labels */}
                  {segments.map((seg, idx) => (
                    <text
                      key={`label-${idx}`}
                      x={(seg.x1 + seg.x2) / 2}
                      y={(seg.y1 + seg.y2) / 2 - 10 * zoom}
                      textAnchor="middle"
                      fontSize={10 * zoom}
                      fill="#ef4444"
                      style={{ pointerEvents: 'none' }}
                    >
                      {seg.distance.tiles.toFixed(1)}t ({seg.distance.feet.toFixed(1)}ft)
                    </text>
                  ))}
                  {/* Render total distance label */}
                  {segments.length > 0 && (
                    <text
                      x={segments[segments.length - 1].x2}
                      y={segments[segments.length - 1].y2 - 20 * zoom}
                      textAnchor="middle"
                      fontSize={12 * zoom}
                      fontWeight="bold"
                      fill="#ef4444"
                      style={{ pointerEvents: 'none' }}
                    >
                      Total: {totalTiles.toFixed(1)} tiles ({totalFeet.toFixed(1)}ft)
                    </text>
                  )}
                </g>
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

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="absolute bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={() => setContextMenu(null)}
        >
          <button
            onClick={handleEditSegment}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
          >
            ✏️ Edit
          </button>
          <button
            onClick={handleDuplicateSegment}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
          >
            📋 Duplicate
          </button>
          <button
            onClick={handleDeleteSegment}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 text-red-600 flex items-center gap-2"
          >
            🗑️ Delete
          </button>
        </div>
      )}

      {/* Cabinet Type Popover */}
      {cabinetPopover && (
        <div
          className="absolute bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50"
          style={{
            left: cabinetPopover.x,
            top: cabinetPopover.y,
          }}
          onClick={() => setCabinetPopover(null)}
        >
          <div className="px-3 py-1 text-xs text-gray-500 border-b border-gray-100 mb-1">
            {cabinetPopover.point.x}{cabinetPopover.point.y}
          </div>
          <button
            onClick={() => handleCabinetTypeChange(cabinetPopover.point, 'full_cab')}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
          >
            <span className="w-4 h-4 bg-gray-100 border border-gray-400 rounded"></span>
            Full Cabinet
          </button>
          <button
            onClick={() => handleCabinetTypeChange(cabinetPopover.point, 'network_rack')}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
          >
            <span className="w-4 h-4 bg-blue-100 border border-blue-600 rounded"></span>
            Network Rack
          </button>
          <button
            onClick={() => handleCabinetTypeChange(cabinetPopover.point, 'half_cab')}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
          >
            <span className="w-4 h-4 bg-amber-100 border border-amber-600 rounded"></span>
            Half Cab
          </button>
          <button
            onClick={() => handleCabinetTypeChange(cabinetPopover.point, 'quarter_cab')}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
          >
            <span className="w-4 h-4 bg-green-100 border border-green-600 rounded"></span>
            Quarter Cab
          </button>
          <div className="border-t border-gray-100 my-1"></div>
          <button
            onClick={() => handleCabinetTypeChange(cabinetPopover.point, 'remove')}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 text-red-600 flex items-center gap-2"
          >
            🗑️ Remove
          </button>
        </div>
      )}

      {/* Keyboard Shortcuts Dialog */}
      {showShortcutDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
              <button
                onClick={() => setShowShortcutDialog(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Pan grid</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded">Arrow keys / WASD</kbd>
              </div>
              <div className="flex justify-between">
                <span>Zoom in</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded">+ / E</kbd>
              </div>
              <div className="flex justify-between">
                <span>Zoom out</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded">- / Q</kbd>
              </div>
              <div className="flex justify-between">
                <span>Cancel operation</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded">Escape</kbd>
              </div>
              <div className="flex justify-between">
                <span>Delete selected segment</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded">Delete</kbd>
              </div>
              <div className="flex justify-between">
                <span>Save</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded">Ctrl+S</kbd>
              </div>
              <div className="flex justify-between">
                <span>Show shortcuts</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded">?</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
