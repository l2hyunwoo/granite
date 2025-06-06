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

import crypto from 'crypto';

const getTransformCacheKey = require('./getTransformCacheKey');
const WorkerFarm = require('./WorkerFarm');
const assert = require('assert');
const fs = require('fs');
const { Cache, stableHash } = require('metro-cache');
const path = require('path');

class Transformer {
  _config;
  _cache;
  _baseHash;
  _getSha1;
  _workerFarm;

  constructor(config, getSha1Fn) {
    this._config = config;

    this._config.watchFolders.forEach(verifyRootExists);
    this._cache = new Cache(config.cacheStores);
    this._getSha1 = getSha1Fn;

    // Remove the transformer config params that we don't want to pass to the
    // transformer. We should change the config object and move them away so we
    // can treat the transformer config params as opaque.
    const {
      getTransformOptions: _getTransformOptions,
      transformVariants: _transformVariants,
      workerPath: _workerPath,
      ...transformerConfig
    } = this._config.transformer;

    const transformerOptions = {
      transformerPath: this._config.transformerPath,
      transformerConfig,
    };

    this._workerFarm = new WorkerFarm(config, transformerOptions);

    const globalCacheKey = this._cache.isDisabled
      ? ''
      : getTransformCacheKey({
          cacheVersion: this._config.cacheVersion,
          projectRoot: this._config.projectRoot,
          transformerConfig: transformerOptions,
        });

    this._baseHash = stableHash([globalCacheKey]).toString('binary');
  }

  async transformFile(filePath, transformerOptions, fileBuffer) {
    const cache = this._cache;

    const {
      customTransformOptions,
      dev,
      experimentalImportSupport,
      hot,
      inlinePlatform,
      inlineRequires,
      minify,
      nonInlinedRequires,
      platform,
      runtimeBytecodeVersion,
      type,
      unstable_disableES6Transforms,
      unstable_transformProfile,
      ...extra
    } = transformerOptions;

    for (const key in extra) {
      // $FlowFixMe[cannot-resolve-name]
      if (hasOwnProperty.call(extra, key)) {
        throw new Error('Extra keys detected: ' + Object.keys(extra).join(', '));
      }
    }

    const localPath = path.relative(this._config.projectRoot, filePath);

    const partialKey = stableHash([
      // This is the hash related to the global Bundler config.
      this._baseHash,

      // Path.
      localPath,

      customTransformOptions,
      dev,
      experimentalImportSupport,
      hot,
      inlinePlatform,
      inlineRequires,
      minify,
      nonInlinedRequires,
      platform,
      runtimeBytecodeVersion,
      type,
      unstable_disableES6Transforms,
      unstable_transformProfile,
    ]);

    let sha1;
    if (fileBuffer) {
      // Shortcut for virtual modules which provide the contents with the filename.
      sha1 = crypto.createHash('sha1').update(fileBuffer).digest('hex');
    } else {
      sha1 = this._getSha1(filePath);
    }

    let fullKey = Buffer.concat([partialKey, Buffer.from(sha1, 'hex')]);
    const result = await cache.get(fullKey);

    // A valid result from the cache is used directly; otherwise we call into
    // the transformer to computed the corresponding result.
    const data = result
      ? { result, sha1 }
      : await this._workerFarm.transform(localPath, transformerOptions, fileBuffer);

    // Only re-compute the full key if the SHA-1 changed. This is because
    // references are used by the cache implementation in a weak map to keep
    // track of the cache that returned the result.
    if (sha1 !== data.sha1) {
      fullKey = Buffer.concat([partialKey, Buffer.from(data.sha1, 'hex')]);
    }

    cache.set(fullKey, data.result);

    return {
      ...data.result,
      getSource() {
        if (fileBuffer) {
          return fileBuffer;
        }
        return fs.readFileSync(filePath);
      },
    };
  }

  end() {
    this._workerFarm.kill();
  }
}

function verifyRootExists(root) {
  // Verify that the root exists.
  assert(fs.statSync(root).isDirectory(), 'Root has to be a valid directory');
}

module.exports = Transformer;
