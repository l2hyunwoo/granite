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

class GraphNotFoundError extends Error {
  graphId;

  constructor(graphId) {
    super(`The graph \`${graphId}\` was not found.`);
    this.graphId = graphId;
  }
}

module.exports = GraphNotFoundError;
