/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *       strict
 * @format
 */

'use strict';

const fs = require('fs');
const path = require('path');

class Package {
  path;

  _root;
  _content;

  constructor({ file }) {
    this.path = path.resolve(file);
    this._root = path.dirname(this.path);
    this._content = null;
  }

  /**
   * The `browser` field and replacement behavior is specified in
   * https://github.com/defunctzombie/package-browser-field-spec.
   */
  getMain(mainFields) {
    const json = this.read();

    let main;

    for (const name of mainFields) {
      if (typeof json[name] === 'string') {
        main = json[name];
        break;
      }
    }

    // flowlint-next-line sketchy-null-string:off
    if (!main) {
      main = 'index';
    }

    const replacements = getReplacements(json, mainFields);
    if (replacements) {
      const variants = [main];
      if (main.slice(0, 2) === './') {
        variants.push(main.slice(2));
      } else {
        variants.push('./' + main);
      }

      for (const variant of variants) {
        const winner =
          replacements[variant] ||
          replacements[variant + '.js'] ||
          replacements[variant + '.json'] ||
          replacements[variant.replace(/(\.js|\.json)$/, '')];

        if (winner) {
          main = winner;
          break;
        }
      }
    }

    return path.join(this._root, main);
  }

  invalidate() {
    this._content = null;
  }

  redirectRequire(name, mainFields) {
    const json = this.read();
    const replacements = getReplacements(json, mainFields);

    if (!replacements) {
      return name;
    }

    if (!name.startsWith('.') && !path.isAbsolute(name)) {
      const replacement = replacements[name];
      // support exclude with "someDependency": false
      return replacement === false ? false : replacement || name;
    }

    let relPath = './' + path.relative(this._root, path.resolve(this._root, name));

    if (path.sep !== '/') {
      relPath = relPath.replace(new RegExp('\\' + path.sep, 'g'), '/');
    }

    let redirect = replacements[relPath];

    // false is a valid value
    if (redirect == null) {
      redirect = replacements[relPath + '.js'];
      if (redirect == null) {
        redirect = replacements[relPath + '.json'];
      }
    }

    // support exclude with "./someFile": false
    if (redirect === false) {
      return false;
    }

    if (redirect) {
      return path.join(this._root, redirect);
    }

    return name;
  }

  read() {
    if (this._content == null) {
      this._content = JSON.parse(fs.readFileSync(this.path, 'utf8'));
    }
    return this._content;
  }
}

function getReplacements(pkg, mainFields) {
  const replacements = mainFields
    .map((name) => {
      // If the field is a string, that doesn't mean we want to redirect the
      //  `main` file itself to anything else. See the spec.
      if (!pkg[name] || typeof pkg[name] === 'string') {
        return null;
      }

      return pkg[name];
    })
    .filter(Boolean);

  if (!replacements.length) {
    return null;
  }

  return Object.assign({}, ...replacements.reverse());
}

module.exports = Package;
