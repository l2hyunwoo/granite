/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 *
 */

'use strict';

const crypto = require('crypto');
const generate = require('@babel/generator').default;
const template = require('@babel/template').default;
const traverse = require('@babel/traverse').default;
const types = require('@babel/types');
const invariant = require('invariant');
const nullthrows = require('nullthrows');

const { isImport } = types;

// TODO: Convert to a Flow enum

// Registry for the dependency of a module.
// Defines when dependencies should be collapsed.
// E.g. should a module that's once required optionally and once not
// be treated as the same or different dependencies.

/**
 * Transform all the calls to `require()` and `import()` in a file into ID-
 * independent code, and return the list of dependencies. For example, a call
 * like `require('Foo')` could be transformed to `require(_depMap[3], 'Foo')`
 * where `_depMap` is provided by the outer scope. As such, we don't need to
 * know the actual module ID.
 *
 * The second argument is only provided for debugging purposes.
 */
function collectDependencies(ast, options) {
  const visited = new WeakSet();

  const state = {
    asyncRequireModulePathStringLiteral: null,
    dependencyCalls: new Set(),
    dependencyRegistry: options.dependencyRegistry ?? new DefaultModuleDependencyRegistry(),
    dependencyTransformer: options.dependencyTransformer ?? DefaultDependencyTransformer,
    dependencyMapIdentifier: null,
    dynamicRequires: options.dynamicRequires,
    keepRequireNames: options.keepRequireNames,
    allowOptionalDependencies: options.allowOptionalDependencies,
    unstable_allowRequireContext: options.unstable_allowRequireContext,
  };

  const visitor = {
    CallExpression(path, state) {
      if (visited.has(path.node)) {
        return;
      }

      const callee = path.node.callee;
      const name = callee.type === 'Identifier' ? callee.name : null;

      if (isImport(callee)) {
        processImportCall(path, state, {
          asyncType: 'async',
        });
        return;
      }

      if (name === '__prefetchImport' && !path.scope.getBinding(name)) {
        processImportCall(path, state, {
          asyncType: 'prefetch',
        });
        return;
      }

      if (name === '__jsResource' && !path.scope.getBinding(name)) {
        processImportCall(path, state, {
          asyncType: 'async',
          jsResource: true,
        });
        return;
      }

      if (name === '__conditionallySplitJSResource' && !path.scope.getBinding(name)) {
        const args = path.get('arguments');
        invariant(Array.isArray(args), 'Expected arguments to be an array');

        processImportCall(path, state, {
          asyncType: 'async',
          jsResource: true,
          splitCondition: args[1],
        });
        return;
      }

      // Match `require.context`
      if (
        // Feature gate, defaults to `false`.
        state.unstable_allowRequireContext &&
        callee.type === 'MemberExpression' &&
        // `require`
        callee.object.type === 'Identifier' &&
        callee.object.name === 'require' &&
        // `context`
        callee.property.type === 'Identifier' &&
        callee.property.name === 'context' &&
        !callee.computed &&
        // Ensure `require` refers to the global and not something else.
        !path.scope.getBinding('require')
      ) {
        processRequireContextCall(path, state);
        visited.add(path.node);
        return;
      }

      if (name != null && state.dependencyCalls.has(name) && !path.scope.getBinding(name)) {
        processRequireCall(path, state);
        visited.add(path.node);
      }
    },

    ImportDeclaration: collectImports,
    ExportNamedDeclaration: collectImports,
    ExportAllDeclaration: collectImports,

    Program(path, state) {
      state.asyncRequireModulePathStringLiteral = types.stringLiteral(options.asyncRequireModulePath);

      if (options.dependencyMapName != null) {
        state.dependencyMapIdentifier = types.identifier(options.dependencyMapName);
      } else {
        state.dependencyMapIdentifier = path.scope.generateUidIdentifier('dependencyMap');
      }

      state.dependencyCalls = new Set(['require', ...options.inlineableCalls]);
    },
  };

  traverse(ast, visitor, null, state);

  const collectedDependencies = state.dependencyRegistry.getDependencies();
  // Compute the list of dependencies.
  const dependencies = new Array(collectedDependencies.length);

  for (const { index, name, ...dependencyData } of collectedDependencies) {
    dependencies[index] = {
      name,
      data: dependencyData,
    };
  }

  return {
    ast,
    dependencies,
    dependencyMapName: nullthrows(state.dependencyMapIdentifier).name,
  };
}

/** Extract args passed to the `require.context` method. */
function getRequireContextArgs(path) {
  const args = path.get('arguments');

  let directory;
  if (!Array.isArray(args) || args.length < 1) {
    throw new InvalidRequireCallError(path);
  } else {
    const result = args[0].evaluate();
    if (result.confident && typeof result.value === 'string') {
      directory = result.value;
    } else {
      throw new InvalidRequireCallError(
        result.deopt ?? args[0],
        'First argument of `require.context` should be a string denoting the directory to require.'
      );
    }
  }

  // Default to requiring through all directories.
  let recursive = true;
  if (args.length > 1) {
    const result = args[1].evaluate();
    if (result.confident && typeof result.value === 'boolean') {
      recursive = result.value;
    } else if (!(result.confident && typeof result.value === 'undefined')) {
      throw new InvalidRequireCallError(
        result.deopt ?? args[1],
        'Second argument of `require.context` should be an optional boolean indicating if files should be imported recursively or not.'
      );
    }
  }

  // Default to all files.
  let filter = { pattern: '.*', flags: '' };
  if (args.length > 2) {
    // evaluate() to check for undefined (because it's technically a scope lookup)
    // but check the AST for the regex literal, since evaluate() doesn't do regex.
    const result = args[2].evaluate();
    const argNode = args[2].node;
    if (argNode.type === 'RegExpLiteral') {
      // TODO: Handle `new RegExp(...)` -- `argNode.type === 'NewExpression'`
      filter = {
        pattern: argNode.pattern,
        flags: argNode.flags || '',
      };
    } else if (!(result.confident && typeof result.value === 'undefined')) {
      throw new InvalidRequireCallError(
        args[2],
        `Third argument of \`require.context\` should be an optional RegExp pattern matching all of the files to import, instead found node of type: ${argNode.type}.`
      );
    }
  }

  // Default to `sync`.
  let mode = 'sync';
  if (args.length > 3) {
    const result = args[3].evaluate();
    if (result.confident && typeof result.value === 'string') {
      mode = getContextMode(args[3], result.value);
    } else if (!(result.confident && typeof result.value === 'undefined')) {
      throw new InvalidRequireCallError(
        result.deopt ?? args[3],
        'Fourth argument of `require.context` should be an optional string "mode" denoting how the modules will be resolved.'
      );
    }
  }

  if (args.length > 4) {
    throw new InvalidRequireCallError(
      path,
      `Too many arguments provided to \`require.context\` call. Expected 4, got: ${args.length}`
    );
  }

  return [
    directory,
    {
      recursive,
      filter,
      mode,
    },
  ];
}

function getContextMode(path, mode) {
  if (mode === 'sync' || mode === 'eager' || mode === 'lazy' || mode === 'lazy-once') {
    return mode;
  }
  throw new InvalidRequireCallError(
    path,
    `require.context "${mode}" mode is not supported. Expected one of: sync, eager, lazy, lazy-once`
  );
}

function processRequireContextCall(path, state) {
  const [directory, contextParams] = getRequireContextArgs(path);
  const transformer = state.dependencyTransformer;
  const dep = registerDependency(
    state,
    {
      // We basically want to "import" every file in a folder and then filter them out with the given `filter` RegExp.
      name: directory,
      // Capture the matching context
      contextParams,
      asyncType: null,
      optional: isOptionalDependency(directory, path, state),
    },
    path
  );

  // require() the generated module representing this context
  path.get('callee').replaceWith(types.identifier('require'));
  transformer.transformSyncRequire(path, dep, state);
}

function collectImports(path, state) {
  if (path.node.source) {
    registerDependency(
      state,
      {
        name: path.node.source.value,
        asyncType: null,
        optional: false,
      },
      path
    );
  }
}

function processImportCall(path, state, options) {
  const name = getModuleNameFromCallArgs(path);

  if (name == null) {
    throw new InvalidRequireCallError(path);
  }

  const dep = registerDependency(
    state,
    {
      name,
      asyncType: options.asyncType,
      splitCondition: options.splitCondition,
      optional: isOptionalDependency(name, path, state),
    },
    path
  );

  const transformer = state.dependencyTransformer;

  if (options.jsResource) {
    transformer.transformJSResource(path, dep, state);
  } else if (options.asyncType === 'async') {
    transformer.transformImportCall(path, dep, state);
  } else {
    transformer.transformPrefetch(path, dep, state);
  }
}

function processRequireCall(path, state) {
  const name = getModuleNameFromCallArgs(path);

  const transformer = state.dependencyTransformer;

  if (name == null) {
    if (state.dynamicRequires === 'reject') {
      throw new InvalidRequireCallError(path);
    }

    transformer.transformIllegalDynamicRequire(path, state);
    return;
  }

  const dep = registerDependency(
    state,
    {
      name,
      asyncType: null,
      optional: isOptionalDependency(name, path, state),
    },
    path
  );

  transformer.transformSyncRequire(path, dep, state);
}

function getNearestLocFromPath(path) {
  let current = path;
  while (current && !current.node.loc) {
    current = current.parentPath;
  }
  return current?.node.loc;
}

function registerDependency(state, qualifier, path) {
  const dependency = state.dependencyRegistry.registerDependency(qualifier);
  const loc = getNearestLocFromPath(path);
  if (loc != null) {
    dependency.locs.push(loc);
  }

  return dependency;
}

function isOptionalDependency(name, path, state) {
  const { allowOptionalDependencies } = state;

  // The async require module is a 'built-in'. Resolving should never fail -> treat it as non-optional.
  if (name === state.asyncRequireModulePathStringLiteral?.value) {
    return false;
  }

  const isExcluded = () =>
    Array.isArray(allowOptionalDependencies.exclude) && allowOptionalDependencies.exclude.includes(name);

  if (!allowOptionalDependencies || isExcluded()) {
    return false;
  }

  // Valid statement stack for single-level try-block: expressionStatement -> blockStatement -> tryStatement
  let sCount = 0;
  let p = path;
  while (p && sCount < 3) {
    if (p.isStatement()) {
      if (p.node.type === 'BlockStatement') {
        // A single-level should have the tryStatement immediately followed BlockStatement
        // with the key 'block' to distinguish from the finally block, which has key = 'finalizer'
        return p.parentPath != null && p.parentPath.node.type === 'TryStatement' && p.key === 'block';
      }
      sCount += 1;
    }
    p = p.parentPath;
  }

  return false;
}

function getModuleNameFromCallArgs(path) {
  const expectedCount = path.node.callee.name === '__conditionallySplitJSResource' ? 2 : 1;
  const args = path.get('arguments');
  if (!Array.isArray(args) || args.length !== expectedCount) {
    throw new InvalidRequireCallError(path);
  }

  const result = args[0].evaluate();

  if (result.confident && typeof result.value === 'string') {
    return result.value;
  }

  return null;
}

collectDependencies.getModuleNameFromCallArgs = getModuleNameFromCallArgs;

class InvalidRequireCallError extends Error {
  constructor({ node }, message) {
    const line = node.loc && node.loc.start && node.loc.start.line;

    super([`Invalid call at line ${line || '<unknown>'}: ${generate(node).code}`, message].filter(Boolean).join('\n'));
  }
}

collectDependencies.InvalidRequireCallError = InvalidRequireCallError;

/**
 * Produces a Babel template that will throw at runtime when the require call
 * is reached. This makes dynamic require errors catchable by libraries that
 * want to use them.
 */
const dynamicRequireErrorTemplate = template.statement(`
  (function(line) {
    throw new Error(
      'Dynamic require defined at line ' + line + '; not supported by Metro',
    );
  })(LINE)
`);

/**
 * Produces a Babel template that transforms an "import(...)" call into a
 * "require(...)" call to the asyncRequire specified.
 */
const makeAsyncRequireTemplate = template.statement(`
  require(ASYNC_REQUIRE_MODULE_PATH)(MODULE_ID, MODULE_NAME)
`);

const makeAsyncPrefetchTemplate = template.statement(`
  require(ASYNC_REQUIRE_MODULE_PATH).prefetch(MODULE_ID, MODULE_NAME)
`);

const makeJSResourceTemplate = template.statement(`
  require(ASYNC_REQUIRE_MODULE_PATH).resource(MODULE_ID, MODULE_NAME)
`);

const DefaultDependencyTransformer = {
  transformSyncRequire(path, dependency, state) {
    const moduleIDExpression = createModuleIDExpression(dependency, state);
    path.node.arguments = [moduleIDExpression];
    // Always add the debug name argument last
    if (state.keepRequireNames) {
      path.node.arguments.push(types.stringLiteral(dependency.name));
    }
  },

  transformImportCall(path, dependency, state) {
    path.replaceWith(
      makeAsyncRequireTemplate({
        ASYNC_REQUIRE_MODULE_PATH: nullthrows(state.asyncRequireModulePathStringLiteral),
        MODULE_ID: createModuleIDExpression(dependency, state),
        MODULE_NAME: createModuleNameLiteral(dependency),
      })
    );
  },

  transformJSResource(path, dependency, state) {
    path.replaceWith(
      makeJSResourceTemplate({
        ASYNC_REQUIRE_MODULE_PATH: nullthrows(state.asyncRequireModulePathStringLiteral),
        MODULE_ID: createModuleIDExpression(dependency, state),
        MODULE_NAME: createModuleNameLiteral(dependency),
      })
    );
  },

  transformPrefetch(path, dependency, state) {
    path.replaceWith(
      makeAsyncPrefetchTemplate({
        ASYNC_REQUIRE_MODULE_PATH: nullthrows(state.asyncRequireModulePathStringLiteral),
        MODULE_ID: createModuleIDExpression(dependency, state),
        MODULE_NAME: createModuleNameLiteral(dependency),
      })
    );
  },

  transformIllegalDynamicRequire(path, state) {
    path.replaceWith(
      dynamicRequireErrorTemplate({
        LINE: types.numericLiteral(path.node.loc?.start.line ?? 0),
      })
    );
  },
};

function createModuleIDExpression(dependency, state) {
  return types.memberExpression(
    nullthrows(state.dependencyMapIdentifier),
    types.numericLiteral(dependency.index),
    true
  );
}

function createModuleNameLiteral(dependency) {
  return types.stringLiteral(dependency.name);
}

/**
 * Given an import qualifier, return a key used to register the dependency.
 * Generally this return the `ImportQualifier.name` property, but more
 * attributes can be appended to distinguish various combinations that would
 * otherwise conflict.
 *
 * For example, the following case would have collision issues if they all utilized the `name` property:
 * ```
 * require('./foo');
 * require.context('./foo');
 * require.context('./foo', true, /something/);
 * require.context('./foo', false, /something/);
 * require.context('./foo', false, /something/, 'lazy');
 * ```
 *
 * This method should be utilized by `registerDependency`.
 */
function getKeyForDependency(qualifier) {
  let key = qualifier.name;

  const { asyncType } = qualifier;
  if (asyncType) {
    key += ['', asyncType].join('\0');
  }

  const { contextParams } = qualifier;
  // Add extra qualifiers when using `require.context` to prevent collisions.
  if (contextParams) {
    // NOTE(EvanBacon): Keep this synchronized with `RequireContextParams`, if any other properties are added
    // then this key algorithm should be updated to account for those properties.
    // Example: `./directory__true__/foobar/m__lazy`
    key += [
      '',
      'context',
      String(contextParams.recursive),
      String(contextParams.filter.pattern),
      String(contextParams.filter.flags),
      contextParams.mode,
      // Join together and append to the name:
    ].join('\0');
  }
  return key;
}

class DefaultModuleDependencyRegistry {
  _dependencies = new Map();

  registerDependency(qualifier) {
    const key = getKeyForDependency(qualifier);
    let dependency = this._dependencies.get(key);

    if (dependency == null) {
      const newDependency = {
        name: qualifier.name,
        asyncType: qualifier.asyncType,
        locs: [],
        index: this._dependencies.size,
        key: crypto.createHash('sha1').update(key).digest('base64'),
      };

      if (qualifier.optional) {
        newDependency.isOptional = true;
      }
      if (qualifier.contextParams) {
        newDependency.contextParams = qualifier.contextParams;
      }

      dependency = newDependency;
    } else {
      if (dependency.isOptional && !qualifier.optional) {
        // A previously optionally required dependency was required non-optionally.
        // Mark it non optional for the whole module
        dependency = {
          ...dependency,
          isOptional: false,
        };
      }
    }

    this._dependencies.set(key, dependency);

    return dependency;
  }

  getDependencies() {
    return Array.from(this._dependencies.values());
  }
}

module.exports = collectDependencies;
