import { useState } from 'react'

interface MapControlsProps {
  onJumpToCabinet: (cabinetId: string) => boolean
}

export function MapControls({ onJumpToCabinet }: MapControlsProps) {
  const [searchValue, setSearchValue] = useState('')
  const [searchError, setSearchError] = useState<string | null>(null)

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
    <div className="flex items-center gap-2 mb-2">
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
  )
}
