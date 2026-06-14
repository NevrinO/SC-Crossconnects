import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_TYPES_PATH = path.resolve(__dirname, '../../calculator/src/types/room.ts');
const TARGET_TYPES_PATH = path.resolve(__dirname, '../src/types/editor.ts');

console.log('Validating type sync between calculator and config-tool...');

if (!fs.existsSync(SOURCE_TYPES_PATH)) {
  console.error(`Source types file not found: ${SOURCE_TYPES_PATH}`);
  process.exit(1);
}

if (!fs.existsSync(TARGET_TYPES_PATH)) {
  console.error(`Target types file not found: ${TARGET_TYPES_PATH}`);
  process.exit(1);
}

const sourceContent = fs.readFileSync(SOURCE_TYPES_PATH, 'utf-8');
const targetContent = fs.readFileSync(TARGET_TYPES_PATH, 'utf-8');

// Extract only type/interface definitions, ignoring comments, imports, and exports
const extractTypeDefinitions = (content) => {
  // Remove single-line comments
  let cleaned = content.replace(/\/\/.*$/gm, '');
  // Remove multi-line comments
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove import statements
  cleaned = cleaned.replace(/^import\s+.*$/gm, '');
  // Remove export keywords (keep the definitions)
  cleaned = cleaned.replace(/^export\s+/gm, '');
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
};

const sourceTypes = extractTypeDefinitions(sourceContent);
const targetTypes = extractTypeDefinitions(targetContent);

if (sourceTypes !== targetTypes) {
  console.error('⚠️  Type drift detected!');
  console.error('The types in config-tool/src/types/editor.ts do not match calculator/src/types/room.ts');
  console.error('Please copy the latest types from calculator/src/types/room.ts to config-tool/src/types/editor.ts');
  process.exit(1);
}

console.log('✅ Types are in sync');
