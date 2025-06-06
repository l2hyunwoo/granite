#!/usr/bin/env node
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

try {
  // $FlowFixMe[untyped-import]
  require('metro-babel-register').unstable_registerForMetroMonorepo();
} catch {}

const { attachMetroCli } = require('./index');
const yargs = require('yargs');

attachMetroCli(yargs.demandCommand(1)).argv;
