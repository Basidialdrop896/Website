import { copyFile, cp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const output = 'dist';
const files = ['index.html', 'index2.html', 'styles.css', 'app.js', 'icon.svg'];

await mkdir(output, { recursive: true });
for (const file of files) {
  await copyFile(file, join(output, file));
}
await cp('assets', join(output, 'assets'), { recursive: true });
