import { useState } from 'react'
import { Room, SpecialCabinets, Cabinet } from '../types/editor'
import { expandCabinetRange, validateCabinetBounds, parseCabinetCoordinate } from '../lib/cabinet-utils'

interface SpecialCabinetEditorProps {
  room: Room
  onUpdate: (specialCabinets: SpecialCabinets) => void
  onCabinetImport?: (cabinets: Cabinet[]) => void
}

export function SpecialCabinetEditor({ room, onUpdate, onCabinetImport }: SpecialCabinetEditorProps) {
  const [networkRacksText, setNetworkRacksText] = useState(
    room.specialCabinets.networkRacks.join('\n')
  )
  const [halfCabsText, setHalfCabsText] = useState(
    room.specialCabinets.halfCabs.join('\n')
  )
  const [quarterCabsText, setQuarterCabsText] = useState(
    room.specialCabinets.quarterCabs.join('\n')
  )

  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [isCollapsed, setIsCollapsed] = useState(true)

  const validateCabinets = (text: string): string[] => {
    const validationErrors: string[] = []
    const expanded = expandCabinetRange(text, room.coordinateFormat)

    for (const cabinet of expanded) {
      const validation = validateCabinetBounds(cabinet, room, room.coordinateFormat)
      if (!validation.isValid) {
        validationErrors.push(validation.error || `Invalid cabinet: ${cabinet}`)
      }
    }

    return validationErrors
  }

  const handleApply = () => {
    const newErrors: Record<string, string[]> = {}

    const networkErrors = validateCabinets(networkRacksText)
    const halfErrors = validateCabinets(halfCabsText)
    const quarterErrors = validateCabinets(quarterCabsText)

    if (networkErrors.length > 0) newErrors.networkRacks = networkErrors
    if (halfErrors.length > 0) newErrors.halfCabs = halfErrors
    if (quarterErrors.length > 0) newErrors.quarterCabs = quarterErrors

    setErrors(newErrors)

    if (Object.keys(newErrors).length === 0) {
      onUpdate({
        networkRacks: expandCabinetRange(networkRacksText, room.coordinateFormat),
        halfCabs: expandCabinetRange(halfCabsText, room.coordinateFormat),
        quarterCabs: expandCabinetRange(quarterCabsText, room.coordinateFormat)
      })
    }
  }

  const handleCancel = () => {
    setNetworkRacksText(room.specialCabinets.networkRacks.join('\n'))
    setHalfCabsText(room.specialCabinets.halfCabs.join('\n'))
    setQuarterCabsText(room.specialCabinets.quarterCabs.join('\n'))
    setErrors({})
  }

  const handleImportToGrid = () => {
    const newErrors: Record<string, string[]> = {}

    const networkErrors = validateCabinets(networkRacksText)
    const halfErrors = validateCabinets(halfCabsText)
    const quarterErrors = validateCabinets(quarterCabsText)

    if (networkErrors.length > 0) newErrors.networkRacks = networkErrors
    if (halfErrors.length > 0) newErrors.halfCabs = halfErrors
    if (quarterErrors.length > 0) newErrors.quarterCabs = quarterErrors

    setErrors(newErrors)

    if (Object.keys(newErrors).length === 0) {
      const networkRacks = expandCabinetRange(networkRacksText, room.coordinateFormat)
      const halfCabs = expandCabinetRange(halfCabsText, room.coordinateFormat)
      const quarterCabs = expandCabinetRange(quarterCabsText, room.coordinateFormat)

      // Convert to Cabinet array
      const cabinets: Cabinet[] = []

      for (const id of networkRacks) {
        const parsed = parseCabinetCoordinate(id, room.coordinateFormat)
        if (!parsed) {
          newErrors.networkRacks = [`Invalid cabinet format: ${id}`]
          setErrors(newErrors)
          return
        }
        cabinets.push({ id, x: parsed.prefix, y: parsed.number, type: 'network_rack' })
      }

      for (const id of halfCabs) {
        const parsed = parseCabinetCoordinate(id, room.coordinateFormat)
        if (!parsed) {
          newErrors.halfCabs = [`Invalid cabinet format: ${id}`]
          setErrors(newErrors)
          return
        }
        cabinets.push({ id, x: parsed.prefix, y: parsed.number, type: 'half_cab' })
      }

      for (const id of quarterCabs) {
        const parsed = parseCabinetCoordinate(id, room.coordinateFormat)
        if (!parsed) {
          newErrors.quarterCabs = [`Invalid cabinet format: ${id}`]
          setErrors(newErrors)
          return
        }
        cabinets.push({ id, x: parsed.prefix, y: parsed.number, type: 'quarter_cab' })
      }

      if (onCabinetImport) {
        onCabinetImport(cabinets)
      }

      // Also update specialCabinets
      onUpdate({
        networkRacks,
        halfCabs,
        quarterCabs
      })
    }
  }

  const totalCount = room.specialCabinets.networkRacks.length
    + room.specialCabinets.halfCabs.length
    + room.specialCabinets.quarterCabs.length

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <button
        onClick={() => setIsCollapsed(c => !c)}
        className="w-full flex items-center justify-between text-left group"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-900">Special Cabinets</h2>
          {isCollapsed && totalCount > 0 && (
            <span className="text-sm text-gray-500 font-normal">
              {room.specialCabinets.networkRacks.length} racks · {room.specialCabinets.halfCabs.length} half · {room.specialCabinets.quarterCabs.length} quarter
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!isCollapsed && <div className="space-y-6 mt-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Network Racks
            <span className="text-gray-500 font-normal ml-2">
              (One per line, or use range syntax like EU108-EU122)
            </span>
          </label>
          <textarea
            value={networkRacksText}
            onChange={(e) => setNetworkRacksText(e.target.value.toUpperCase())}
            className={`w-full px-3 py-2 border rounded-md font-mono text-sm ${
              errors.networkRacks ? 'border-red-500' : 'border-gray-300'
            }`}
            rows={4}
            placeholder="EU108&#10;EU110&#10;EU108-EU122"
          />
          {errors.networkRacks && (
            <div className="mt-2 text-red-600 text-sm">
              {errors.networkRacks.map((err, i) => (
                <div key={i}>• {err}</div>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Current count: {expandCabinetRange(networkRacksText, room.coordinateFormat).length}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Half Cabs
            <span className="text-gray-500 font-normal ml-2">
              (One per line, or use range syntax like EU108-EU122)
            </span>
          </label>
          <textarea
            value={halfCabsText}
            onChange={(e) => setHalfCabsText(e.target.value.toUpperCase())}
            className={`w-full px-3 py-2 border rounded-md font-mono text-sm ${
              errors.halfCabs ? 'border-red-500' : 'border-gray-300'
            }`}
            rows={4}
            placeholder="EU108&#10;EU110&#10;EU108-EU122"
          />
          {errors.halfCabs && (
            <div className="mt-2 text-red-600 text-sm">
              {errors.halfCabs.map((err, i) => (
                <div key={i}>• {err}</div>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Current count: {expandCabinetRange(halfCabsText, room.coordinateFormat).length}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quarter Cabs
            <span className="text-gray-500 font-normal ml-2">
              (One per line, or use range syntax like EU108-EU122)
            </span>
          </label>
          <textarea
            value={quarterCabsText}
            onChange={(e) => setQuarterCabsText(e.target.value.toUpperCase())}
            className={`w-full px-3 py-2 border rounded-md font-mono text-sm ${
              errors.quarterCabs ? 'border-red-500' : 'border-gray-300'
            }`}
            rows={4}
            placeholder="EU108&#10;EU110&#10;EU108-EU122"
          />
          {errors.quarterCabs && (
            <div className="mt-2 text-red-600 text-sm">
              {errors.quarterCabs.map((err, i) => (
                <div key={i}>• {err}</div>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Current count: {expandCabinetRange(quarterCabsText, room.coordinateFormat).length}
          </p>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleApply}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Apply Changes
          </button>
          <button
            onClick={handleImportToGrid}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            Import to Grid
          </button>
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>}
    </div>
  )
}
