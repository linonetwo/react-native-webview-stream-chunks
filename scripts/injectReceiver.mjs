import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const INPUT_FILE = path.join(ROOT_DIR, 'src', 'webviewReceiver.ts');
const OUTPUT_FILE = path.join(ROOT_DIR, 'dist', 'streamChunksPreloadScript.js');
const TEMP_DIR = path.join(ROOT_DIR, 'dist', 'temp');
const TEMP_JS_FILE = path.join(TEMP_DIR, 'webviewReceiver.js');

// Ensure dist/temp exists
try {
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEMP_DIR, { recursive: true });
} catch (e) {
  // ignore
}

console.log('Compiling webviewReceiver.ts...');

try {
  execSync(`npx tsc "${INPUT_FILE}" --target ES2015 --module CommonJS --outDir "${TEMP_DIR}" --lib dom,es2015 --skipLibCheck`, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });

  if (!fs.existsSync(TEMP_JS_FILE)) {
    throw new Error(`Output file not found at ${TEMP_JS_FILE}`);
  }

  let fileContent = fs.readFileSync(TEMP_JS_FILE, 'utf-8');

  // Find the start of the function
  const functionStart = 'function webViewStreamReceiverIIFE';
  const startIndex = fileContent.indexOf(functionStart);
  
  if (startIndex === -1) {
    throw new Error(`Could not find "${functionStart}" in generated file.`);
  }

  let functionContent = fileContent.substring(startIndex);
  functionContent = functionContent.replace(/\/\/# sourceMappingURL=.+/, '').trim();

  // Escape backticks and backslashes for template literal
  const escapedContent = functionContent
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');

  // Now, inject this into dist/streamChunksPreloadScript.js
  if (!fs.existsSync(OUTPUT_FILE)) {
      throw new Error(`Target file ${OUTPUT_FILE} not found. Make sure valid tsc run happened before this script.`);
  }

  const targetContent = fs.readFileSync(OUTPUT_FILE, 'utf-8');

  const placeholder = '__WEBVIEW_RECEIVER_CODE__';
  const placeholderLiteralPattern = /(["'])__WEBVIEW_RECEIVER_CODE__\1/;

  if (!targetContent.includes(placeholder)) {
    throw new Error(`Placeholder ${placeholder} not found in ${OUTPUT_FILE}. Build output is unexpected.`);
  }

  if (!placeholderLiteralPattern.test(targetContent)) {
    throw new Error(`Could not find a quoted placeholder literal in ${OUTPUT_FILE}.`);
  }

  const newContent = targetContent.replace(placeholderLiteralPattern, `\`${escapedContent}\``);

  if (newContent === targetContent) {
    throw new Error(`Placeholder replacement did not change ${OUTPUT_FILE}.`);
  }

  if (newContent.includes(placeholder)) {
    throw new Error(`Placeholder ${placeholder} still exists in ${OUTPUT_FILE} after injection.`);
  }

  fs.writeFileSync(OUTPUT_FILE, newContent);
  console.log(`Injected webview receiver code into ${OUTPUT_FILE}`);
  
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }

} catch (error) {
  console.error('Failed to build webview receiver script:', error);
  process.exit(1);
}
