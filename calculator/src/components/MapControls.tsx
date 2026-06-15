import { useState } from 'react'

interface MapControlsProps {
  onJumpToCabinet: (cabinetId: string) => boolean | void
  onToggleGrid: () => void
  onToggleCabinets: () => void
  onToggleSegments: () => void
  onToggleAnimation: () => void
  showGrid: boolean
  showCabinets: boolean
  showSegments: boolean
  showAnimation: boolean
}

export function MapControls({
  onJumpToCabinet,
  onToggleGrid,
  onToggleCabinets,
  onToggleSegments,
  onToggleAnimation,
  showGrid,
  showCabinets,
  showSegments,
  showAnimation,
}: MapControlsProps) {
  const [searchValue, setSearchValue] = useState('')
  const [searchError, setSearchError] = useState<string | null>(null)
  const [showLegend, setShowLegend] = useState(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchValue.trim()) {
      setSearchError('Please enter a cabinet ID')
      return
    }
    setSearchError(null)
    const success = onJumpToCabinet(searchValue.toUpperCase())
    if (!success) {
      setSearchError(`Cabinet "${searchValue.toUpperCase()}" not found in this room`)
    }
  }

  return (
    <div className="space-y-2">
      {/* Legend toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowLegend(!showLegend)}
          className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
          title="Toggle legend"
        >
          Legend
        </button>
      </div>

      {/* Layer toggles */}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={onToggleGrid}
            className="rounded"
          />
          Grid
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={showCabinets}
            onChange={onToggleCabinets}
            className="rounded"
          />
          Cabinets
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={showSegments}
            onChange={onToggleSegments}
            className="rounded"
          />
          Segments
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={showAnimation}
            onChange={onToggleAnimation}
            className="rounded"
          />
          Animation
        </label>
      </div>

      {/* Cabinet search */}
      <div className="flex items-center gap-2">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value.toUpperCase())}
            placeholder="Jump to cabinet (e.g., FR132)"
            className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm"
          >
            Jump
          </button>
        </form>
        {searchError && (
          <span className="text-xs text-red-600">{searchError}</span>
        )}
      </div>

      {/* Legend panel */}
      {showLegend && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded text-sm">
          <h3 className="font-semibold mb-2">Cabinet Types</h3>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-100 border border-gray-400 rounded"></div>
              <span>Full cabinet</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-100 border border-blue-600 rounded"></div>
              <span>Network rack</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-amber-100 border border-amber-600 rounded"></div>
              <span>Half cab</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border border-green-600 rounded"></div>
              <span>Quarter cab</span>
            </div>
          </div>
          <h3 className="font-semibold mt-3 mb-2">Segment States</h3>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-gray-300"></div>
              <span>Muted (unrelated)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-blue-400"></div>
              <span>Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-1 bg-blue-600"></div>
              <span>Selected (active route)</span>
            </div>
          </div>
          <h3 className="font-semibold mt-3 mb-2">Keyboard Shortcuts</h3>
          <div className="text-xs text-gray-600 space-y-1">
            <div><kbd className="px-1 bg-gray-200 rounded">1</kbd> — Next click sets Start</div>
            <div><kbd className="px-1 bg-gray-200 rounded">2</kbd> — Next click sets End</div>
            <div><kbd className="px-1 bg-gray-200 rounded">Esc</kbd> — Clear both Start and End</div>
            <div><kbd className="px-1 bg-gray-200 rounded">Enter</kbd> — Trigger Calculate</div>
            <div><kbd className="px-1 bg-gray-200 rounded">X</kbd> — Swap Start and End</div>
            <div><kbd className="px-1 bg-gray-200 rounded">R</kbd> — Reset zoom</div>
            <div><kbd className="px-1 bg-gray-200 rounded">E/Q</kbd> — Zoom in/out</div>
            <div><kbd className="px-1 bg-gray-200 rounded">WASD/Arrows</kbd> — Pan</div>
          </div>
        </div>
      )}
    </div>
  )
}
