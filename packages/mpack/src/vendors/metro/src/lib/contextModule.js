/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *       strict-local
 * @format
 */

import crypto from 'crypto';
import path from 'path';

import nullthrows from 'nullthrows';

function toHash(value) {
  // Use `hex` to ensure filepath safety.
  return crypto.createHash('sha1').update(value).digest('hex');
}

/** Given a fully qualified require context, return a virtual file path that ensures uniqueness between paths with different contexts. */
export function deriveAbsolutePathFromContext(from, context) {
  // Drop the trailing slash, require.context should always be matched against a folder
  // and we want to normalize the folder name as much as possible to prevent duplicates.
  // This also makes the files show up in the correct location when debugging in Chrome.
  const filePath = from.endsWith(path.sep) ? from.slice(0, -1) : from;
  return (
    filePath +
    '?ctx=' +
    toHash(
      [
        context.mode,
        context.recursive ? 'recursive' : '',
        new RegExp(context.filter.pattern, context.filter.flags).toString(),
      ]
        .filter(Boolean)
        .join(' ')
    )
  );
}

/** Match a file against a require context. */
export function fileMatchesContext(testPath, context) {
  // NOTE(EvanBacon): Ensure this logic is synchronized with the similar
  // functionality in `metro-file-map/src/HasteFS.js` (`matchFilesWithContext()`)

  const filePath = path.relative(nullthrows(context.from), testPath);
  const filter = context.filter;
  if (
    // Ignore everything outside of the provided `root`.
    !(filePath && !filePath.startsWith('..')) ||
    // Prevent searching in child directories during a non-recursive search.
    (!context.recursive && filePath.includes(path.sep)) ||
    // Test against the filter.
    !filter.test(
      // NOTE(EvanBacon): Ensure files start with `./` for matching purposes
      // this ensures packages work across Metro and Webpack (ex: Storybook for React DOM / React Native).
      // `a/b.js` -> `./a/b.js`
      './' + filePath.replace(/\\/g, '/')
    )
  ) {
    return false;
  }

  return true;
}
