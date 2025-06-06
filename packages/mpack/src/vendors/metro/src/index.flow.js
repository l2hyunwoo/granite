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

const makeBuildCommand = require('./commands/build');
const makeDependenciesCommand = require('./commands/dependencies');
const makeServeCommand = require('./commands/serve');
const MetroHmrServer = require('./HmrServer');
const IncrementalBundler = require('./IncrementalBundler');
const createWebsocketServer = require('./lib/createWebsocketServer');
const MetroServer = require('./Server');
const outputBundle = require('./shared/output/bundle');
const chalk = require('chalk');
const fs = require('fs');
const http = require('http');
const https = require('https');
// MARK: - GRANITE
const { getDefaultConfig, loadConfig, mergeConfig } = require('../../metro-config/src');
const { InspectorProxy } = require('../../metro-inspector-proxy/src/index');
const net = require('net');
const { parse } = require('url');
const ws = require('ws');

async function getConfig(config) {
  const defaultConfig = await getDefaultConfig(config.projectRoot);
  return mergeConfig(defaultConfig, config);
}

async function runMetro(config, options) {
  const mergedConfig = await getConfig(config);
  const {
    reporter,
    server: { port },
  } = mergedConfig;

  reporter.update({
    hasReducedPerformance: options ? Boolean(options.hasReducedPerformance) : false,
    port,
    type: 'initialize_started',
  });

  const { waitForBundler = false, ...serverOptions } = options ?? {};
  const server = new MetroServer(mergedConfig, serverOptions);

  const readyPromise = server
    .ready()
    .then(() => {
      reporter.update({
        type: 'initialize_done',
        port,
      });
    })
    .catch((error) => {
      reporter.update({
        type: 'initialize_failed',
        port,
        error,
      });
    });
  if (waitForBundler) {
    await readyPromise;
  }

  return server;
}

exports.runMetro = runMetro;
exports.loadConfig = loadConfig;

const createConnectMiddleware = async function (config, options) {
  const metroServer = await runMetro(config, options);

  let enhancedMiddleware = metroServer.processRequest;

  // Enhance the resulting middleware using the config options
  if (config.server.enhanceMiddleware) {
    enhancedMiddleware = config.server.enhanceMiddleware(enhancedMiddleware, metroServer);
  }

  return {
    attachHmrServer(httpServer) {
      const wss = createWebsocketServer({
        websocketServer: new MetroHmrServer(metroServer.getBundler(), metroServer.getCreateModuleId(), config),
      });
      httpServer.on('upgrade', (request, socket, head) => {
        const { pathname } = parse(request.url);
        if (pathname === '/hot') {
          wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
          });
        } else {
          socket.destroy();
        }
      });
    },
    metroServer,
    middleware: enhancedMiddleware,
    end() {
      metroServer.end();
    },
  };
};
exports.createConnectMiddleware = createConnectMiddleware;

exports.runServer = async (
  config,
  {
    hasReducedPerformance = false,
    host,
    onError,
    onReady,
    secureServerOptions,
    secure, //deprecated
    secureCert, // deprecated
    secureKey, // deprecated
    waitForBundler = false,
    websocketEndpoints = {},
  }
) => {
  await earlyPortCheck(host, config.server.port);

  if (secure != null || secureCert != null || secureKey != null) {
    // eslint-disable-next-line no-console
    console.warn(
      chalk.inverse.yellow.bold(' DEPRECATED '),
      'The `secure`, `secureCert`, and `secureKey` options are now deprecated. ' +
        'Please use the `secureServerOptions` object instead to pass options to ' +
        "Metro's https development server."
    );
  }
  // Lazy require
  const connect = require('connect');

  const serverApp = connect();

  const { middleware, end, metroServer } = await createConnectMiddleware(config, {
    hasReducedPerformance,
    waitForBundler,
  });

  serverApp.use(middleware);

  let inspectorProxy = null;
  if (config.server.runInspectorProxy) {
    inspectorProxy = new InspectorProxy(config.projectRoot);
  }

  let httpServer;

  if (secure || secureServerOptions != null) {
    let options = secureServerOptions;
    if (typeof secureKey === 'string' && typeof secureCert === 'string') {
      options = {
        key: fs.readFileSync(secureKey),
        cert: fs.readFileSync(secureCert),
        ...secureServerOptions,
      };
    }
    httpServer = https.createServer(options, serverApp);
  } else {
    httpServer = http.createServer(serverApp);
  }
  return new Promise((resolve, reject) => {
    httpServer.on('error', (error) => {
      if (onError) {
        onError(error);
      }
      reject(error);
      end();
    });

    httpServer.listen(config.server.port, host, () => {
      if (onReady) {
        onReady(httpServer);
      }

      Object.assign(websocketEndpoints, {
        ...(inspectorProxy ? { ...inspectorProxy.createWebSocketListeners(httpServer) } : {}),
        '/hot': createWebsocketServer({
          websocketServer: new MetroHmrServer(metroServer.getBundler(), metroServer.getCreateModuleId(), config),
        }),
      });

      httpServer.on('upgrade', (request, socket, head) => {
        const { pathname } = parse(request.url);
        if (pathname != null && websocketEndpoints[pathname]) {
          websocketEndpoints[pathname].handleUpgrade(request, socket, head, (ws) => {
            websocketEndpoints[pathname].emit('connection', ws, request);
          });
        } else {
          socket.destroy();
        }
      });

      if (inspectorProxy) {
        // TODO(hypuk): Refactor inspectorProxy.processRequest into separate request handlers
        // so that we could provide routes (/json/list and /json/version) here.
        // Currently this causes Metro to give warning about T31407894.
        // $FlowFixMe[method-unbinding] added when improving typing for this parameters
        serverApp.use(inspectorProxy.processRequest.bind(inspectorProxy));
      }

      resolve(httpServer);
    });

    // Disable any kind of automatic timeout behavior for incoming
    // requests in case it takes the packager more than the default
    // timeout of 120 seconds to respond to a request.
    httpServer.timeout = 0;

    httpServer.on('close', () => {
      end();
    });
  });
};

exports.runBuild = async (
  config,
  {
    dev = false,
    entry,
    onBegin,
    onComplete,
    onProgress,
    minify = true,
    output = outputBundle,
    out,
    platform = 'web',
    sourceMap = false,
    sourceMapUrl,
  }
) => {
  const metroServer = await runMetro(config, {
    watch: false,
  });

  try {
    const requestOptions = {
      dev,
      entryFile: entry,
      inlineSourceMap: sourceMap && !sourceMapUrl,
      minify,
      platform,
      sourceMapUrl: sourceMap === false ? undefined : sourceMapUrl,
      createModuleIdFactory: config.serializer.createModuleIdFactory,
      onProgress,
    };

    if (onBegin) {
      onBegin();
    }

    const metroBundle = await output.build(metroServer, requestOptions);

    if (onComplete) {
      onComplete();
    }

    if (out) {
      const bundleOutput = out.replace(/(\.js)?$/, '.js');
      const sourcemapOutput = sourceMap === false ? undefined : out.replace(/(\.js)?$/, '.map');

      const outputOptions = {
        bundleOutput,
        sourcemapOutput,
        dev,
        platform,
      };

      // eslint-disable-next-line no-console
      await output.save(metroBundle, outputOptions, console.log);
    }

    return metroBundle;
  } finally {
    await metroServer.end();
  }
};

exports.buildGraph = async function (
  config,
  {
    customTransformOptions = Object.create(null),
    dev = false,
    entries,
    minify = false,
    onProgress,
    platform = 'web',
    type = 'module',
  }
) {
  const mergedConfig = await getConfig(config);

  const bundler = new IncrementalBundler(mergedConfig);

  try {
    const { customResolverOptions, ...defaultTransformInputOptions } = MetroServer.DEFAULT_GRAPH_OPTIONS;
    return await bundler.buildGraphForEntries(
      entries,
      {
        ...defaultTransformInputOptions,
        customTransformOptions,
        dev,
        minify,
        platform,
        type,
      },
      { customResolverOptions }
    );
  } finally {
    bundler.end();
  }
};

exports.attachMetroCli = function (
  yargs,
  {
    build = {},
    serve = {},
    dependencies = {},
  }   
                               
                               
                      
       
   
  // prettier-ignore
  // $FlowFixMe[prop-missing]
  = {}
) {
  yargs.strict();

  if (build) {
    yargs.command(makeBuildCommand());
  }
  if (serve) {
    yargs.command(makeServeCommand());
  }
  if (dependencies) {
    yargs.command(makeDependenciesCommand());
  }

  return yargs;
};

async function earlyPortCheck(host, port) {
  const server = net.createServer((c) => c.end());
  try {
    await new Promise((resolve, reject) => {
      server.on('error', (err) => {
        reject(err);
      });
      server.listen(port, host, undefined, () => resolve());
    });
  } finally {
    await new Promise((resolve) => server.close(() => resolve()));
  }
}
