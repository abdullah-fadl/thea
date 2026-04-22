#!/usr/bin/env node
/**
 * CVision UI Migration Script
 * Migrates CVision pages from shadcn/Tailwind to CVision theme + inline styles
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const CVISION_DIR = join(ROOT, 'app/(dashboard)/cvision');
const COMPONENTS_DIR = join(ROOT, 'components/cvision');

// Collect all .tsx files under cvision
function collectFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) collectFiles(full, files);
    else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) files.push(full);
  }
  return files;
}

// Map old imports to new
const IMPORT_MAP = {
  "from '@/components/ui/card'": { remove: true, components: ['Card', 'CardContent', 'CardHeader', 'CardTitle', 'CardDescription', 'CardFooter'] },
  "from '@/components/ui/button'": { remove: true, components: ['Button'] },
  "from '@/components/ui/badge'": { remove: true, components: ['Badge'] },
  "from '@/components/ui/input'": { remove: true, components: ['Input'] },
  "from '@/components/ui/textarea'": { remove: true, components: ['Textarea'] },
  "from '@/components/ui/label'": { remove: true, components: ['Label'] },
  "from '@/components/ui/skeleton'": { remove: true, components: ['Skeleton'] },
  "from '@/components/ui/dialog'": { remove: true, components: ['Dialog', 'DialogContent', 'DialogHeader', 'DialogTitle', 'DialogDescription', 'DialogFooter', 'DialogTrigger', 'DialogClose'] },
  "from '@/components/ui/alert-dialog'": { remove: true, components: ['AlertDialog', 'AlertDialogContent', 'AlertDialogHeader', 'AlertDialogTitle', 'AlertDialogDescription', 'AlertDialogFooter', 'AlertDialogTrigger', 'AlertDialogAction', 'AlertDialogCancel'] },
  "from '@/components/ui/alert'": { remove: true, components: ['Alert', 'AlertDescription', 'AlertTitle'] },
  "from '@/components/ui/tabs'": { remove: true, components: ['Tabs', 'TabsList', 'TabsTrigger', 'TabsContent'] },
  "from '@/components/ui/table'": { remove: true, components: ['Table', 'TableHeader', 'TableBody', 'TableRow', 'TableHead', 'TableCell'] },
  "from '@/components/ui/select'": { remove: true, components: ['Select', 'SelectContent', 'SelectItem', 'SelectTrigger', 'SelectValue', 'SelectGroup', 'SelectLabel'] },
  "from '@/components/ui/switch'": { remove: true, components: ['Switch'] },
  "from '@/components/ui/checkbox'": { remove: true, components: ['Checkbox'] },
  "from '@/components/ui/progress'": { remove: true, components: ['Progress'] },
  "from '@/components/ui/scroll-area'": { remove: true, components: ['ScrollArea'] },
  "from '@/components/ui/tooltip'": { remove: true, components: ['Tooltip', 'TooltipContent', 'TooltipProvider', 'TooltipTrigger'] },
  "from '@/components/ui/separator'": { remove: true, components: ['Separator'] },
  "from '@/components/ui/dropdown-menu'": { remove: true, components: ['DropdownMenu', 'DropdownMenuContent', 'DropdownMenuItem', 'DropdownMenuTrigger', 'DropdownMenuSeparator', 'DropdownMenuLabel'] },
};

// Component replacement JSX patterns
const JSX_REPLACEMENTS = [
  // Card components
  [/<Card\b/g, '<CVisionCard C={C}'],
  [/<\/Card>/g, '</CVisionCard>'],
  [/<CardHeader\b/g, '<CVisionCardHeader C={C}'],
  [/<\/CardHeader>/g, '</CVisionCardHeader>'],
  [/<CardContent\b/g, '<CVisionCardBody'],
  [/<\/CardContent>/g, '</CVisionCardBody>'],
  [/<CardTitle\b([^>]*)>/g, '<div style={{ fontSize: 15, fontWeight: 600, color: C.text }}$1>'],
  [/<\/CardTitle>/g, '</div>'],
  [/<CardDescription\b([^>]*)>/g, '<div style={{ fontSize: 12, color: C.textMuted }}$1>'],
  [/<\/CardDescription>/g, '</div>'],
  [/<CardFooter\b/g, '<div style={{ padding: "12px 20px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 8 }}'],
  [/<\/CardFooter>/g, '</div>'],

  // Button → CVisionButton
  [/<Button\b/g, '<CVisionButton C={C} isDark={isDark}'],
  [/<\/Button>/g, '</CVisionButton>'],
  // Fix variants
  [/variant="destructive"/g, 'variant="danger"'],

  // Badge → CVisionBadge
  [/<Badge\b/g, '<CVisionBadge C={C}'],
  [/<\/Badge>/g, '</CVisionBadge>'],

  // Input → CVisionInput
  [/<Input\b/g, '<CVisionInput C={C}'],
  [/<Textarea\b/g, '<CVisionTextarea C={C}'],
  [/<Label\b/g, '<CVisionLabel C={C}'],
  [/<\/Label>/g, '</CVisionLabel>'],

  // Skeleton → CVisionSkeletonCard
  [/<Skeleton\b([^/]*)\/?>/g, '<CVisionSkeletonCard C={C} height={200}$1 />'],

  // Separator
  [/<Separator\b[^/]*\/?>/g, '<div style={{ height: 1, background: C.border, margin: "8px 0" }} />'],

  // ScrollArea
  [/<ScrollArea\b/g, '<div style={{ overflowY: "auto" }}'],
  [/<\/ScrollArea>/g, '</div>'],

  // Tooltip - simplify to title attr (can't easily convert)
  [/<TooltipProvider>/g, '<>'],
  [/<\/TooltipProvider>/g, '</>'],
  [/<Tooltip>/g, ''],
  [/<\/Tooltip>/g, ''],
  [/<TooltipTrigger[^>]*>/g, ''],
  [/<\/TooltipTrigger>/g, ''],
  [/<TooltipContent[^>]*>[^<]*<\/TooltipContent>/g, ''],

  // Alert → div with styles
  [/<Alert\b[^>]*>/g, '<div style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgSubtle }}>'],
  [/<\/Alert>/g, '</div>'],
  [/<AlertDescription\b[^>]*>/g, '<div style={{ fontSize: 13, color: C.textSecondary }}>'],
  [/<\/AlertDescription>/g, '</div>'],
  [/<AlertTitle\b[^>]*>/g, '<div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>'],
  [/<\/AlertTitle>/g, '</div>'],

  // Progress → simple div
  [/<Progress\b[^>]*value=\{([^}]+)\}[^/]*\/?>/g, '<div style={{ height: 6, borderRadius: 3, background: C.bgSubtle, overflow: "hidden" }}><div style={{ height: "100%", width: `${$1}%`, background: C.gold, borderRadius: 3, transition: "width 0.3s" }} /></div>'],

  // Switch → checkbox fallback
  [/<Switch\b/g, '<input type="checkbox"'],
];

// className to inline style conversions
const CLASS_TO_STYLE = [
  // Display
  ['flex', "display: 'flex'"],
  ['inline-flex', "display: 'inline-flex'"],
  ['grid', "display: 'grid'"],
  ['hidden', "display: 'none'"],
  ['block', "display: 'block'"],

  // Flex
  ['flex-col', "flexDirection: 'column'"],
  ['flex-row', "flexDirection: 'row'"],
  ['flex-wrap', "flexWrap: 'wrap'"],
  ['flex-1', "flex: 1"],
  ['flex-shrink-0', "flexShrink: 0"],
  ['items-center', "alignItems: 'center'"],
  ['items-start', "alignItems: 'flex-start'"],
  ['items-end', "alignItems: 'flex-end'"],
  ['justify-center', "justifyContent: 'center'"],
  ['justify-between', "justifyContent: 'space-between'"],
  ['justify-end', "justifyContent: 'flex-end'"],

  // Text
  ['text-center', "textAlign: 'center'"],
  ['text-left', "textAlign: 'left'"],
  ['text-right', "textAlign: 'right'"],
  ['text-xs', "fontSize: 12"],
  ['text-sm', "fontSize: 13"],
  ['text-base', "fontSize: 14"],
  ['text-lg', "fontSize: 16"],
  ['text-xl', "fontSize: 18"],
  ['text-2xl', "fontSize: 24"],
  ['text-3xl', "fontSize: 30"],
  ['font-bold', "fontWeight: 700"],
  ['font-semibold', "fontWeight: 600"],
  ['font-medium', "fontWeight: 500"],
  ['font-mono', "fontFamily: 'monospace'"],
  ['truncate', "overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'"],
  ['whitespace-nowrap', "whiteSpace: 'nowrap'"],
  ['whitespace-pre-line', "whiteSpace: 'pre-line'"],
  ['break-all', "wordBreak: 'break-all'"],
  ['uppercase', "textTransform: 'uppercase'"],
  ['line-clamp-2', "display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'"],

  // Colors
  ['text-muted-foreground', "color: C.textMuted"],
  ['text-primary', "color: C.gold"],
  ['text-primary-foreground', "color: '#fff'"],
  ['bg-primary', "background: C.gold"],
  ['bg-muted', "background: C.bgSubtle"],
  ['bg-background', "background: C.bgCard"],

  // Spacing
  ['gap-1', "gap: 4"],
  ['gap-1.5', "gap: 6"],
  ['gap-2', "gap: 8"],
  ['gap-3', "gap: 12"],
  ['gap-4', "gap: 16"],
  ['gap-5', "gap: 20"],
  ['gap-6', "gap: 24"],

  // Overflow
  ['overflow-hidden', "overflow: 'hidden'"],
  ['overflow-x-auto', "overflowX: 'auto'"],
  ['overflow-y-auto', "overflowY: 'auto'"],

  // Border
  ['rounded', "borderRadius: 6"],
  ['rounded-md', "borderRadius: 8"],
  ['rounded-lg', "borderRadius: 12"],
  ['rounded-xl', "borderRadius: 16"],
  ['rounded-full', "borderRadius: '50%'"],
  ['border', `border: \`1px solid \${C.border}\``],
  ['border-t', `borderTop: \`1px solid \${C.border}\``],
  ['border-b', `borderBottom: \`1px solid \${C.border}\``],

  // Min/max
  ['min-w-0', "minWidth: 0"],
  ['w-full', "width: '100%'"],

  // Position
  ['relative', "position: 'relative'"],
  ['absolute', "position: 'absolute'"],
  ['sticky', "position: 'sticky'"],

  // Cursor
  ['cursor-pointer', "cursor: 'pointer'"],
  ['select-none', "userSelect: 'none'"],

  // Animation
  ['animate-spin', "animation: 'spin 1s linear infinite'"],
  ['transition-colors', "transition: 'color 0.2s, background 0.2s'"],
  ['transition-all', "transition: 'all 0.2s'"],
];

function convertClassName(classStr) {
  const classes = classStr.trim().split(/\s+/);
  const styles = [];
  const unconverted = [];

  for (const cls of classes) {
    // Handle padding
    const pMatch = cls.match(/^p-(\d+(?:\.\d+)?)$/);
    if (pMatch) { styles.push(`padding: ${parseFloat(pMatch[1]) * 4}`); continue; }
    const pxMatch = cls.match(/^px-(\d+(?:\.\d+)?)$/);
    if (pxMatch) { styles.push(`paddingLeft: ${parseFloat(pxMatch[1]) * 4}, paddingRight: ${parseFloat(pxMatch[1]) * 4}`); continue; }
    const pyMatch = cls.match(/^py-(\d+(?:\.\d+)?)$/);
    if (pyMatch) { styles.push(`paddingTop: ${parseFloat(pyMatch[1]) * 4}, paddingBottom: ${parseFloat(pyMatch[1]) * 4}`); continue; }
    const ptMatch = cls.match(/^pt-(\d+(?:\.\d+)?)$/);
    if (ptMatch) { styles.push(`paddingTop: ${parseFloat(ptMatch[1]) * 4}`); continue; }
    const pbMatch = cls.match(/^pb-(\d+(?:\.\d+)?)$/);
    if (pbMatch) { styles.push(`paddingBottom: ${parseFloat(pbMatch[1]) * 4}`); continue; }
    const plMatch = cls.match(/^pl-(\d+(?:\.\d+)?)$/);
    if (plMatch) { styles.push(`paddingLeft: ${parseFloat(plMatch[1]) * 4}`); continue; }
    const prMatch = cls.match(/^pr-(\d+(?:\.\d+)?)$/);
    if (prMatch) { styles.push(`paddingRight: ${parseFloat(prMatch[1]) * 4}`); continue; }

    // Handle margin
    const mMatch = cls.match(/^m-(\d+(?:\.\d+)?)$/);
    if (mMatch) { styles.push(`margin: ${parseFloat(mMatch[1]) * 4}`); continue; }
    const mbMatch = cls.match(/^mb-(\d+(?:\.\d+)?)$/);
    if (mbMatch) { styles.push(`marginBottom: ${parseFloat(mbMatch[1]) * 4}`); continue; }
    const mtMatch = cls.match(/^mt-(\d+(?:\.\d+)?)$/);
    if (mtMatch) { styles.push(`marginTop: ${parseFloat(mtMatch[1]) * 4}`); continue; }
    const mlMatch = cls.match(/^ml-(\d+(?:\.\d+)?)$/);
    if (mlMatch) { styles.push(`marginLeft: ${parseFloat(mlMatch[1]) * 4}`); continue; }
    const mrMatch = cls.match(/^mr-(\d+(?:\.\d+)?)$/);
    if (mrMatch) { styles.push(`marginRight: ${parseFloat(mrMatch[1]) * 4}`); continue; }
    const mxMatch = cls.match(/^mx-(\d+(?:\.\d+)?)$/);
    if (mxMatch) { styles.push(`marginLeft: ${parseFloat(mxMatch[1]) * 4}, marginRight: ${parseFloat(mxMatch[1]) * 4}`); continue; }
    const myMatch = cls.match(/^my-(\d+(?:\.\d+)?)$/);
    if (myMatch) { styles.push(`marginTop: ${parseFloat(myMatch[1]) * 4}, marginBottom: ${parseFloat(myMatch[1]) * 4}`); continue; }

    // Handle space-y (use gap)
    const spaceYMatch = cls.match(/^space-y-(\d+(?:\.\d+)?)$/);
    if (spaceYMatch) { styles.push(`display: 'flex', flexDirection: 'column', gap: ${parseFloat(spaceYMatch[1]) * 4}`); continue; }
    const spaceXMatch = cls.match(/^space-x-(\d+(?:\.\d+)?)$/);
    if (spaceXMatch) { styles.push(`display: 'flex', gap: ${parseFloat(spaceXMatch[1]) * 4}`); continue; }

    // Handle h-X, w-X
    const hMatch = cls.match(/^h-(\d+(?:\.\d+)?)$/);
    if (hMatch) { styles.push(`height: ${parseFloat(hMatch[1]) * 4}`); continue; }
    const wMatch = cls.match(/^w-(\d+(?:\.\d+)?)$/);
    if (wMatch) { styles.push(`width: ${parseFloat(wMatch[1]) * 4}`); continue; }
    const minHMatch = cls.match(/^min-h-\[(.+)\]$/);
    if (minHMatch) { styles.push(`minHeight: '${minHMatch[1]}'`); continue; }
    const maxWMatch = cls.match(/^max-w-(\w+)$/);
    if (maxWMatch) {
      const map = { xs: 320, sm: 384, md: 448, lg: 512, xl: 576, '2xl': 672, full: "'100%'" };
      if (map[maxWMatch[1]]) { styles.push(`maxWidth: ${map[maxWMatch[1]]}`); continue; }
    }

    // Handle grid-cols
    const gridColsMatch = cls.match(/^grid-cols-(\d+)$/);
    if (gridColsMatch) { styles.push(`gridTemplateColumns: 'repeat(${gridColsMatch[1]}, 1fr)'`); continue; }
    const smGridMatch = cls.match(/^sm:grid-cols-(\d+)$/);
    if (smGridMatch) { continue; } // Skip responsive - too complex
    const lgGridMatch = cls.match(/^lg:grid-cols-(\d+)$/);
    if (lgGridMatch) { continue; }

    // Handle opacity
    const opacityMatch = cls.match(/^opacity-(\d+)$/);
    if (opacityMatch) { styles.push(`opacity: ${parseInt(opacityMatch[1]) / 100}`); continue; }

    // Handle z-index
    const zMatch = cls.match(/^z-(\d+)$/);
    if (zMatch) { styles.push(`zIndex: ${zMatch[1]}`); continue; }

    // Handle specific colors
    if (cls.match(/^text-(red|green|blue|amber|purple|orange|yellow)/)) {
      const colorMap = { red: 'C.red', green: 'C.green', blue: 'C.blue', amber: 'C.orange', purple: 'C.purple', orange: 'C.orange', yellow: 'C.orange' };
      const match = cls.match(/^text-(\w+)/);
      if (match && colorMap[match[1]]) { styles.push(`color: ${colorMap[match[1]]}`); continue; }
    }
    if (cls.match(/^bg-(red|green|blue|amber|purple|orange|yellow)/)) {
      const colorMap = { red: 'C.redDim', green: 'C.greenDim', blue: 'C.blueDim', amber: 'C.orangeDim', purple: 'C.purpleDim', orange: 'C.orangeDim', yellow: 'C.orangeDim' };
      const match = cls.match(/^bg-(\w+)/);
      if (match && colorMap[match[1]]) { styles.push(`background: ${colorMap[match[1]]}`); continue; }
    }

    // Known classes
    const found = CLASS_TO_STYLE.find(([c]) => c === cls);
    if (found) { styles.push(found[1]); continue; }

    // Skip responsive prefixes, hover states, etc - too complex
    if (cls.match(/^(sm:|md:|lg:|xl:|hover:|focus:|dark:|divide-)/)) continue;
    if (cls.match(/^(tracking-|leading-)/)) continue;

    unconverted.push(cls);
  }

  return { styles: styles.join(', '), unconverted };
}

function migrateFile(filePath) {
  let content = readFileSync(filePath, 'utf8');
  const relPath = relative(ROOT, filePath);

  // Skip if already migrated
  if (content.includes('useCVisionTheme') || content.includes("from '@/lib/cvision/theme'")) {
    return { path: relPath, status: 'skipped', reason: 'already migrated' };
  }

  // Skip if no shadcn imports
  if (!content.includes("from '@/components/ui/")) {
    return { path: relPath, status: 'skipped', reason: 'no shadcn imports' };
  }

  let changes = 0;
  const neededCVisionImports = new Set();

  // Step 1: Remove old imports, track what's needed
  const usedOldComponents = new Set();
  for (const [importKey, info] of Object.entries(IMPORT_MAP)) {
    if (content.includes(importKey)) {
      // Find the full import line(s)
      const importRegex = new RegExp(`import\\s*\\{[^}]*\\}\\s*${importKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*;?`, 'g');
      const matches = content.match(importRegex);
      if (matches) {
        for (const match of matches) {
          // Extract component names
          const namesMatch = match.match(/\{([^}]+)\}/);
          if (namesMatch) {
            namesMatch[1].split(',').map(s => s.trim().replace(/\s+as\s+\w+/, '')).filter(Boolean).forEach(name => {
              if (name.startsWith('type ')) return;
              usedOldComponents.add(name);
            });
          }
          content = content.replace(match, '');
          changes++;
        }
      }
    }
  }

  // Map old components to CVision imports
  const componentMapping = {
    'Card': 'CVisionCard', 'CardContent': 'CVisionCardBody', 'CardHeader': 'CVisionCardHeader',
    'CardTitle': null, 'CardDescription': null, 'CardFooter': null,
    'Button': 'CVisionButton', 'Badge': 'CVisionBadge',
    'Input': 'CVisionInput', 'Textarea': 'CVisionTextarea', 'Label': 'CVisionLabel',
    'Skeleton': 'CVisionSkeletonCard',
    'Dialog': 'CVisionDialog', 'DialogContent': null, 'DialogHeader': null,
    'DialogTitle': null, 'DialogDescription': null, 'DialogFooter': 'CVisionDialogFooter',
    'DialogTrigger': null, 'DialogClose': null,
    'Tabs': 'CVisionTabs', 'TabsList': null, 'TabsTrigger': null, 'TabsContent': 'CVisionTabContent',
    'Table': 'CVisionTable', 'TableHeader': 'CVisionTableHead', 'TableBody': 'CVisionTableBody',
    'TableRow': 'CVisionTr', 'TableHead': 'CVisionTh', 'TableCell': 'CVisionTd',
  };

  for (const comp of usedOldComponents) {
    if (componentMapping[comp]) {
      neededCVisionImports.add(componentMapping[comp]);
    }
  }

  // Always need SkeletonStyles if using SkeletonCard
  if (neededCVisionImports.has('CVisionSkeletonCard')) {
    neededCVisionImports.add('CVisionSkeletonStyles');
  }

  // Step 2: Add CVision imports after 'use client'
  const cvImports = [...neededCVisionImports].sort().join(', ');
  const themeImport = "import { useCVisionTheme } from '@/lib/cvision/theme';";
  const langImport = "import { useLang } from '@/hooks/use-lang';";
  const uiImport = cvImports ? `import { ${cvImports} } from '@/components/cvision/ui';` : '';

  // Insert after 'use client' or at top
  const useClientIdx = content.indexOf("'use client'");
  if (useClientIdx !== -1) {
    const endOfLine = content.indexOf('\n', useClientIdx);
    const afterUseClient = endOfLine + 1;
    const insertBlock = `\n${themeImport}\n${langImport}\n${uiImport ? uiImport + '\n' : ''}`;
    content = content.slice(0, afterUseClient) + insertBlock + content.slice(afterUseClient);
    changes++;
  }

  // Step 3: Add hooks at top of component function
  // Find the main component function
  const funcMatch = content.match(/export\s+(?:default\s+)?function\s+\w+\s*\([^)]*\)\s*\{/);
  if (funcMatch) {
    const funcEnd = content.indexOf(funcMatch[0]) + funcMatch[0].length;
    const hookBlock = `\n  const { C, isDark } = useCVisionTheme();\n  const { language } = useLang();\n  const isRTL = language === 'ar';\n  const tr = (ar: string, en: string) => (isRTL ? ar : en);\n`;
    content = content.slice(0, funcEnd) + hookBlock + content.slice(funcEnd);
    changes++;
  }

  // Step 4: Apply JSX replacements
  for (const [pattern, replacement] of JSX_REPLACEMENTS) {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      changes++;
    }
  }

  // Step 5: Convert className to style (basic cases)
  // Match className="..." and convert
  content = content.replace(/className="([^"]+)"/g, (match, classes) => {
    const { styles, unconverted } = convertClassName(classes);
    if (styles && unconverted.length === 0) {
      return `style={{ ${styles} }}`;
    } else if (styles && unconverted.length > 0) {
      // Keep className for unconverted, add style for converted
      return `style={{ ${styles} }} /* className="${unconverted.join(' ')}" */`;
    }
    return match; // Keep original if nothing converted
  });

  // Step 6: Clean up empty lines from removed imports
  content = content.replace(/\n{3,}/g, '\n\n');

  writeFileSync(filePath, content, 'utf8');
  return { path: relPath, status: 'migrated', changes };
}

// Main
console.log('CVision UI Migration Script');
console.log('==========================\n');

const appFiles = collectFiles(CVISION_DIR);
// Don't re-migrate shared components already done manually
// const compFiles = collectFiles(COMPONENTS_DIR);

let migrated = 0, skipped = 0, errors = 0;

for (const file of appFiles) {
  try {
    const result = migrateFile(file);
    if (result.status === 'migrated') {
      console.log(`✅ ${result.path} (${result.changes} changes)`);
      migrated++;
    } else {
      // console.log(`⏭️  ${result.path} (${result.reason})`);
      skipped++;
    }
  } catch (err) {
    console.error(`❌ ${relative(ROOT, file)}: ${err.message}`);
    errors++;
  }
}

console.log(`\n=== Summary ===`);
console.log(`Migrated: ${migrated}`);
console.log(`Skipped: ${skipped}`);
console.log(`Errors: ${errors}`);
console.log(`Total: ${appFiles.length}`);
