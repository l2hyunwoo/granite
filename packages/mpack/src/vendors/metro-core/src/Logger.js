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

// MARK: - GRANITE
const VERSION = '0.0.0';
const { EventEmitter } = require('events');
const os = require('os');
const path = require('path');

const log_session = `${os.hostname()}-${Date.now()}`;
const eventEmitter = new EventEmitter();

function on(event, handler) {
  eventEmitter.on(event, handler);
}

function createEntry(data) {
  const logEntry = typeof data === 'string' ? { log_entry_label: data } : data;

  const entryPoint = logEntry.entry_point;
  if (entryPoint) {
    logEntry.entry_point = path.relative(process.cwd(), entryPoint);
  }

  return {
    ...logEntry,
    log_session,
    metro_bundler_version: VERSION,
  };
}

function createActionStartEntry(data) {
  const logEntry = typeof data === 'string' ? { action_name: data } : data;
  const { action_name } = logEntry;

  return createEntry({
    ...logEntry,
    action_name,
    action_phase: 'start',
    log_entry_label: action_name,
    start_timestamp: process.hrtime(),
  });
}

function createActionEndEntry(logEntry) {
  const { action_name, action_phase, start_timestamp } = logEntry;

  if (action_phase !== 'start' || !Array.isArray(start_timestamp)) {
    throw new Error('Action has not started or has already ended');
  }

  const timeDelta = process.hrtime(start_timestamp);
  const duration_ms = Math.round((timeDelta[0] * 1e9 + timeDelta[1]) / 1e6);

  return createEntry({
    ...logEntry,
    action_name,
    action_phase: 'end',
    duration_ms,
    /* $FlowFixMe(>=0.111.0 site=react_native_fb) This comment suppresses an
     * error found when Flow v0.111 was deployed. To see the error, delete this
     * comment and run Flow. */
    log_entry_label: action_name,
  });
}

function log(logEntry) {
  eventEmitter.emit('log', logEntry);
  return logEntry;
}

module.exports = {
  on,
  createEntry,
  createActionStartEntry,
  createActionEndEntry,
  log,
};
