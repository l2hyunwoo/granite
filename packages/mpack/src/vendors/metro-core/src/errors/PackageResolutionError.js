/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *       strict-local
 * @format
 */

'use strict';

const { formatFileCandidates } = require('metro-resolver');

class PackageResolutionError extends Error {
  originModulePath;
  packageError;
  targetModuleName;

  constructor(opts) {
    const perr = opts.packageError;
    super(
      `While trying to resolve module \`${opts.targetModuleName}\` from file ` +
        `\`${opts.originModulePath}\`, the package ` +
        `\`${perr.packageJsonPath}\` was successfully found. However, ` +
        'this package itself specifies ' +
        'a `main` module field that could not be resolved (' +
        `\`${perr.mainPrefixPath}\`. Indeed, none of these files exist:\n\n` +
        `  * ${formatFileCandidates(perr.fileCandidates)}\n` +
        `  * ${formatFileCandidates(perr.indexCandidates)}`
    );
    Object.assign(this, opts);
  }
}

module.exports = PackageResolutionError;
