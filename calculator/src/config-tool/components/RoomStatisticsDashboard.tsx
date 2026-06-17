import { useEffect, useState } from 'react'
import { Room } from '../../types/room'
import { letterLabelToIndex, generateLetterRange, calculateGridBounds } from '../lib/grid-utils'

interface RoomStatisticsDashboardProps {
  room: Room
}

interface Statistics {
  segmentCount: number
  fiberPathCount: number
  copperPathCount: number
  mixedPathCount: number
  totalSegmentLength: number
  totalSegmentLengthFt: number
  coveragePercentage: number
  networkRacksCount: number
  halfCabsCount: number
  quarterCabsCount: number
}

export function RoomStatisticsDashboard({ room }: RoomStatisticsDashboardProps) {
  const [stats, setStats] = useState<Statistics | null>(null)

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Calculate segment counts by type
      const fiberPathCount = room.pathSegments.filter(s => s.type === 'fiber-path').length
      const copperPathCount = room.pathSegments.filter(s => s.type === 'copper-path').length
      const mixedPathCount = room.pathSegments.filter(s => s.type === 'mixed-path').length

      // Calculate total segment length
      let totalSegmentLength = 0
      for (const segment of room.pathSegments) {
        const isHorizontal = segment.start.y === segment.end.y
        if (isHorizontal) {
          const width = Math.max(segment.start.x.length, segment.end.x.length)
          totalSegmentLength += Math.abs(
            letterLabelToIndex(segment.end.x, width) - letterLabelToIndex(segment.start.x, width)
          )
        } else {
          totalSegmentLength += Math.abs(segment.end.y - segment.start.y)
        }
      }

      const totalSegmentLengthFt = totalSegmentLength * room.tileSize

      // Calculate coverage: % of grid cells that have at least one segment passing through them
      const coveredCells = new Set<string>()
      for (const segment of room.pathSegments) {
        const isHorizontal = segment.start.y === segment.end.y
        if (isHorizontal) {
          const y = segment.start.y
          const w = Math.max(segment.start.x.length, segment.end.x.length)
          const [minX, maxX] = [segment.start.x, segment.end.x]
            .sort((a, b) => letterLabelToIndex(a, w) - letterLabelToIndex(b, w))
          const cols = generateLetterRange(minX, maxX)
          for (const col of cols) coveredCells.add(`${col}-${y}`)
        } else {
          const x = segment.start.x
          for (let y = Math.min(segment.start.y, segment.end.y); y <= Math.max(segment.start.y, segment.end.y); y++) {
            coveredCells.add(`${x}-${y}`)
          }
        }
      }

      // Total grid cells from full bounds
      const bounds = calculateGridBounds(room)
      const totalGridCells = bounds.xLabels.length * bounds.yLabels.length

      const coveragePercentage = totalGridCells > 0
        ? (coveredCells.size / totalGridCells) * 100
        : 0

      setStats({
        segmentCount: room.pathSegments.length,
        fiberPathCount,
        copperPathCount,
        mixedPathCount,
        totalSegmentLength,
        totalSegmentLengthFt,
        coveragePercentage,
        networkRacksCount: room.specialCabinets.networkRacks.length,
        halfCabsCount: room.specialCabinets.halfCabs.length,
        quarterCabsCount: room.specialCabinets.quarterCabs.length
      })
    }, 500) // 500ms debounce

    return () => clearTimeout(timeoutId)
  }, [room])

  if (!stats) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Room Statistics</h2>
        <p className="text-gray-500">Calculating...</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Room Statistics</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-600 font-medium">Total Segments</p>
          <p className="text-2xl font-bold text-blue-900">{stats.segmentCount}</p>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-green-600 font-medium">Fiber Paths</p>
          <p className="text-2xl font-bold text-green-900">{stats.fiberPathCount}</p>
        </div>

        <div className="bg-orange-50 rounded-lg p-4">
          <p className="text-sm text-orange-600 font-medium">Copper Paths</p>
          <p className="text-2xl font-bold text-orange-900">{stats.copperPathCount}</p>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-sm text-purple-600 font-medium">Mixed Paths</p>
          <p className="text-2xl font-bold text-purple-900">{stats.mixedPathCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 font-medium">Total Length</p>
          <p className="text-lg font-bold text-gray-900">
            {stats.totalSegmentLength} tiles ({stats.totalSegmentLengthFt.toFixed(1)}ft)
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 font-medium">Grid Coverage</p>
          <p className="text-lg font-bold text-gray-900">{stats.coveragePercentage.toFixed(1)}%</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 font-medium">Special Cabinets</p>
          <p className="text-lg font-bold text-gray-900">
            {stats.networkRacksCount + stats.halfCabsCount + stats.quarterCabsCount}
          </p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Special Cabinet Breakdown</h3>
        <div className="flex gap-4 text-sm">
          <span className="text-gray-600">
            <strong>Network Racks:</strong> {stats.networkRacksCount}
          </span>
          <span className="text-gray-600">
            <strong>Half Cabs:</strong> {stats.halfCabsCount}
          </span>
          <span className="text-gray-600">
            <strong>Quarter Cabs:</strong> {stats.quarterCabsCount}
          </span>
        </div>
      </div>
    </div>
  )
}
