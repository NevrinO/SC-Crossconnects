# Config Tool - Visual Room Configuration Editor

A visual drag-and-drop editor for creating and editing room configurations with segment management, special cabinet tracking, and flexible file export/import.

## Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Setup

1. Navigate to the config-tool directory:
```bash
cd config-tool
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to the URL shown (typically `http://localhost:5173`)

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Usage Guide

### Creating a New Room

1. Click the **"Create New Room"** button in the Room Selection panel
2. Fill in the required fields:
   - **Room ID**: Unique identifier (e.g., "CR-15")
   - **Room Name**: Display name (e.g., "Computer Room 15")
   - **Coordinate Format**: Choose between letters-first (FK132) or numbers-first (132FK)
   - **Start/End Coordinates**: Define the grid bounds for the room
   - **Start Corner**: Which corner is the reference point (top-left, top-right, etc.)
   - **Orientation**: Direction of cabinet numbering (numbers-vertical or numbers-horizontal)
   - **Tile Size**: Size of each grid tile in feet (default: 2ft)
3. Click **"Create Room"** to initialize an empty room

### Adding Segments

1. Select a room from the dropdown
2. In the Grid Editor, click and drag to create a segment:
   - Click to set the start point
   - Drag to set the end point
   - Release to open the segment form
3. Fill in segment details:
   - **Type**: fiber-path, copper-path, or mixed-path
   - **Name**: Optional identifier (auto-generated from coordinates if empty)
   - **Fiber Height**: Required for fiber-path and mixed-path
   - **Copper Height**: Required for copper-path and mixed-path
4. Click **"Create"** to add the segment

### Editing Segments

**Via Table:**
- Click on any field in the Segment Table to edit inline
- Click **"Apply Changes"** to save all edits
- Click **"Delete"** to remove a segment

**Via Grid:**
- Right-click (Shift+Right-click) on a segment to open the context menu
- Choose Edit, Delete, or Duplicate

**Bulk Edit:**
- Select multiple rows in the Segment Table (checkboxes)
- Change type/height fields to apply to all selected segments
- Click **"Apply Changes"** to save

### Special Cabinets

1. Expand the **Special Cabinets** panel
2. Enter cabinet IDs in the textareas (one per line):
   - Single entries: `EU108`
   - Range syntax: `EU108-EU122` (expands to EU108, EU109, ..., EU122)
   - Mixed content: Both formats work in the same textarea
3. Click **"Apply Changes"** to save
4. Validation ensures cabinets are within room bounds

### Exporting Rooms

**Single Room:**
- Select a room
- Click **"Export Single Room"** to download as JSON

**All Rooms:**
- Click **"Export All Rooms"** to download the full rooms.json array

**For Calculator (Local Dev Only):**
- Click **"Download for Calculator"** to download the selected room
- Manually merge the file into `calculator/src/data/rooms.json`

### Importing Rooms

**Single Room:**
- Click **"Import Single Room"**
- Select a JSON file
- The room will be added or replace an existing room with the same ID

**Full rooms.json:**
- Click **"Import Full rooms.json"**
- Select a rooms.json file
- This replaces all existing rooms with the imported data

## File Format Reference

### Room Structure

```typescript
interface Room {
  id: string                          // Unique identifier
  name: string                        // Display name
  tileSize: number                    // Tile size in feet
  offset: number                      // Offset value
  spilloverAdditionalLength: number   // Spillover length
  coordinateFormat: 'letters-first' | 'numbers-first'
  orientation: 'numbers-vertical' | 'numbers-horizontal'
  startCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  xyRange: {
    start: { x: string, y: number }   // Grid bounds start
    end: { x: string, y: number }     // Grid bounds end
  }
  pathSegments: PathSegment[]         // Array of segments
  specialCabinets: SpecialCabinets    // Special cabinet lists
}
```

### Segment Structure

```typescript
interface PathSegment {
  id: string                          // Unique identifier (UUID)
  name: string                        // Optional display name
  type: 'fiber-path' | 'copper-path' | 'mixed-path'
  start: { x: string, y: number }     // Start coordinate
  end: { x: string, y: number }       // End coordinate
  fiberHeight: number | null          // Fiber tray height
  copperHeight: number | null         // Copper tray height
}
```

### Special Cabinets Structure

```typescript
interface SpecialCabinets {
  networkRacks: string[]              // Network rack cabinet IDs
  halfCabs: string[]                  // Half cabinet IDs
  quarterCabs: string[]               // Quarter cabinet IDs
}
```

### Coordinate Formats

**Letters-First** (e.g., "FK132"):
- Pattern: `[A-Z]{1,3}[0-9]+`
- Grid: Letters on X-axis, numbers on Y-axis

**Numbers-First** (e.g., "132FK"):
- Pattern: `[0-9]+[A-Z]{1,3}`
- Grid: Numbers on X-axis, letters on Y-axis

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Arrow Keys` | Pan the grid |
| `+` / `-` | Zoom in / out |
| `Escape` | Cancel current operation |
| `Delete` | Remove selected segment |
| `Ctrl+S` | Manual save (clears change history) |
| `Shift+Right-Click` | Open context menu on segment |

**Note:** Shortcuts only work when the Grid Editor has focus (not in input fields).

## Grid Features

### Zoom & Pan
- **Mouse Wheel**: Zoom in/out
- **Click & Drag**: Pan the grid
- **Reset Button**: Return to default zoom level

### Layer Toggle
- Toggle visibility of fiber vs copper segments independently
- Useful for focusing on specific cable types

### Connection Indicators
- Green dots indicate valid end-to-end connections
- Gray dots indicate broken connections
- Connection criteria: Segment A's end matches Segment B's start exactly

### Measurement Tool
- Toggle measurement mode to measure distances
- Click to set the first point, then click additional points to create a multi-section path
- Preview line shows from the first point to hover position
- Shows individual segment lengths (tiles and feet) along each section
- Shows total distance (tiles and feet) at the last point
- Double-click on the same point to finish measurement (lines stay visible)
- Press Escape to clear the measurement

### Change History
- Tracks all segment changes since last save
- Shows before/after values for each change
- Revert individual changes or clear entire history
- History clears on save (Ctrl+S)

## Validation

The tool provides real-time validation for:

- **Segment Bounds**: Ensures segments stay within room grid
- **Overlap Detection**: Warns about full or partial segment overlaps
- **Coordinate Format**: Validates coordinate strings match room format
- **Height Requirements**: Ensures required heights are set per segment type
- **Cabinet Bounds**: Validates special cabinets are within room bounds
- **Room ID Uniqueness**: Ensures room IDs are unique across all operations

Validation status is shown in the Validation Summary panel with color-coded indicators:
- **Green**: Room is valid
- **Red**: Errors that must be fixed
- **Yellow**: Warnings that can be ignored

## Auto-Save

The tool automatically saves your work to LocalStorage:
- **Debounce**: Saves 1 second after the last change
- **Compression**: Compresses data if it exceeds 4MB
- **Restore**: Automatically restores on page load
- **Clear Backup**: Manual button to clear saved data
- **Private Browsing**: Gracefully handles when LocalStorage is unavailable

## Room Statistics

The Room Statistics Dashboard shows:
- **Segment Count**: Total segments by type (fiber, copper, mixed)
- **Total Length**: Sum of all segment lengths (tiles and feet)
- **Grid Coverage**: Percentage of grid cells with at least one segment
- **Special Cabinets**: Count of network racks, half cabs, and quarter cabs

Statistics update in real-time with 500ms debounce to prevent UI blocking.

## Troubleshooting

### "Storage quota exceeded" error
- Export your rooms and clear the backup
- Reduce the number of rooms or segments
- The tool compresses data automatically when it exceeds 4MB

### "Unable to access storage" error
- You may be in private browsing mode
- Auto-save is disabled, but you can still export/import manually

### Grid not rendering
- Ensure the room has valid xyRange metadata
- Check that coordinate format matches the room setting
- Try creating a new room with valid bounds

### Segments not appearing
- Check the layer toggle (fiber/copper visibility)
- Verify segments are within room bounds
- Check the Validation Summary for errors

### Import fails
- Ensure the JSON file matches the room structure
- Check that room IDs are unique
- Verify file size is under 1MB limit
- Check the error message for specific validation issues

### Duplicate room ID error
- Room IDs must be unique across all rooms
- Use the Clone feature to create a copy with a new ID
- Edit the room ID before importing if it conflicts

## Future Enhancements

Planned features for future releases:

- **Undo/Redo**: Full history navigation beyond current change history
- **Diagonal Segments**: Support for non-axis-aligned segments
- **Segment Grouping**: Organize segments into named groups
- **Auto-Suggest Connections**: Suggest segment connections based on proximity
- **Dark Mode**: Toggle between light and dark themes
- **Collaborative Editing**: Real-time multi-user editing
- **Side-by-Side Comparison**: Compare two rooms simultaneously
- **Grid Snapping Toggle**: Fine-tuned positioning without snap
- **Path Tracing**: Click two cabinets to visualize cable route
- **Cabinet Heatmap**: Density overlay showing cabinet distribution

## Development

### Type Validation

The config-tool shares type definitions with the calculator. A validation script runs on build to detect type drift:

```bash
npm run validate-types
```

This compares types between `calculator/src/types/room.ts` and `config-tool/src/types/editor.ts`.

### Project Structure

```
config-tool/
├── src/
│   ├── components/      # React components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility functions
│   └── types/           # TypeScript type definitions
├── public/              # Static assets
└── scripts/             # Build scripts
```

## License

This tool is part of the SC-Crossconnects project.
