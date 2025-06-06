import * as fs from 'fs/promises';
import * as path from 'path';
import { getSourcemapName } from './getSourcemapName';
import type { BundleData } from '../bundler/types';

export async function writeBundle(outputPath: string, { source, sourcemap }: BundleData) {
  await createDirectories(path.dirname(outputPath));

  const baseDirectory = path.dirname(outputPath);
  const basename = path.basename(outputPath);

  await Promise.all([
    fs.writeFile(outputPath, source.contents, 'utf-8'),
    fs.writeFile(path.join(baseDirectory, getSourcemapName(basename)), sourcemap.contents, 'utf-8'),
  ]);
}

function createDirectories(directoryPath: string) {
  return fs.mkdir(directoryPath, { recursive: true });
}
