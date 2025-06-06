/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *
 * @format
 */

'use strict';

class ResourceNotFoundError extends Error {
  resourcePath;

  constructor(resourcePath) {
    super(`The resource \`${resourcePath}\` was not found.`);
    this.resourcePath = resourcePath;
  }
}

module.exports = ResourceNotFoundError;
