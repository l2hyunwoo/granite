// Copyright 2021 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
/*
 * Copyright (C) 2013 Google Inc. All rights reserved.
 * Copyright (C) 2012 Intel Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
import * as Common from '../../core/common/common.js';
import * as i18n from '../../core/i18n/i18n.js';
import * as Platform from '../../core/platform/platform.js';
import * as SDK from '../../core/sdk/sdk.js';
import * as Bindings from '../../models/bindings/bindings.js';
import * as TimelineModel from '../../models/timeline_model/timeline_model.js';
import * as TraceEngine from '../../models/trace/trace.js';
import * as TraceBounds from '../../services/trace_bounds/trace_bounds.js';
import * as PerfUI from '../../ui/legacy/components/perf_ui/perf_ui.js';
// eslint-disable-next-line rulesdir/es_modules_import
import imagePreviewStyles from '../../ui/legacy/components/utils/imagePreview.css.js';
import * as LegacyComponents from '../../ui/legacy/components/utils/utils.js';
import * as UI from '../../ui/legacy/legacy.js';
import * as ThemeSupport from '../../ui/legacy/theme_support/theme_support.js';
import { CLSRect } from './CLSLinkifier.js';
import * as TimelineComponents from './components/components.js';
import { getCategoryStyles, getEventStyle, TimelineCategory, TimelineRecordStyle } from './EventUICategory.js';
import { titleForInteractionEvent } from './InteractionsTrackAppender.js';
import { SourceMapsResolver } from './SourceMapsResolver.js';
import { TimelinePanel } from './TimelinePanel.js';
import { TimelineSelection } from './TimelineSelection.js';
const UIStrings = {
    /**
     *@description Text that only contain a placeholder
     *@example {100ms (at 200ms)} PH1
     */
    emptyPlaceholder: '{PH1}',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    task: 'Task',
    /**
     *@description Text for other types of items
     */
    other: 'Other',
    /**
     *@description Text that refers to the animation of the web page
     */
    animation: 'Animation',
    /**
     *@description Text that refers to some events
     */
    event: 'Event',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    requestMainThreadFrame: 'Request Main Thread Frame',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    frameStart: 'Frame Start',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    frameStartMainThread: 'Frame Start (main thread)',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    drawFrame: 'Draw Frame',
    /**
     *@description Noun for an event in the Performance panel. This marks time
     spent in an operation that only happens when the profiler is active.
     */
    profilingOverhead: 'Profiling Overhead',
    /**
     *@description The process the browser uses to determine a target element for a
     *pointer event. Typically, this is determined by considering the pointer's
     *location and also the visual layout of elements on the screen.
     */
    hitTest: 'Hit Test',
    /**
     *@description Noun for an event in the Performance panel. The browser has decided
     *that the styles for some elements need to be recalculated and scheduled that
     *recalculation process at some time in the future.
     */
    scheduleStyleRecalculation: 'Schedule Style Recalculation',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    recalculateStyle: 'Recalculate Style',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    invalidateLayout: 'Invalidate Layout',
    /**
     *@description Noun for an event in the Performance panel. Layerize is a step
     *where we calculate which layers to create.
     */
    layerize: 'Layerize',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    layout: 'Layout',
    /**
     *@description Noun for an event in the Performance panel. Paint setup is a
     *step before the 'Paint' event. A paint event is when the browser draws pixels
     *to the screen. This step is the setup beforehand.
     */
    paintSetup: 'Paint Setup',
    /**
     *@description Noun for a paint event in the Performance panel, where an image
     *was being painted. A paint event is when the browser draws pixels to the
     *screen, in this case specifically for an image in a website.
     */
    paintImage: 'Paint Image',
    /**
     *@description Noun for an event in the Performance panel. Pre-paint is a
     *step before the 'Paint' event. A paint event is when the browser records the
     *instructions for drawing the page. This step is the setup beforehand.
     */
    prePaint: 'Pre-Paint',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    updateLayer: 'Update Layer',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    updateLayerTree: 'Update Layer Tree',
    /**
     *@description Text that refers to updated priority of network request
     */
    initialPriority: 'Initial Priority',
    /**
     *@description Noun for a paint event in the Performance panel. A paint event is when the browser draws pixels to the screen.
     */
    paint: 'Paint',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    rasterizePaint: 'Rasterize Paint',
    /**
     *@description The action to scroll
     */
    scroll: 'Scroll',
    /**
     *@description Noun for an event in the Performance panel. Commit is a step
     *where we send (also known as "commit") layers to the compositor thread. This
     *step follows the "Layerize" step which is what calculates which layers to
     *create.
     */
    commit: 'Commit',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    compositeLayers: 'Composite Layers',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    computeIntersections: 'Compute Intersections',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    parseHtml: 'Parse HTML',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    parseStylesheet: 'Parse Stylesheet',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    installTimer: 'Install Timer',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    removeTimer: 'Remove Timer',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    timerFired: 'Timer Fired',
    /**
     *@description Text for an event. Shown in the timeline in the Performance panel.
     * XHR refers to XmlHttpRequest, a Web API. This particular Web API has a property
     * named 'readyState' (https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/readyState). When
     * the 'readyState' property changes the text is shown.
     */
    xhrReadyStateChange: '`XHR` Ready State Change',
    /**
     * @description Text for an event. Shown in the timeline in the Perforamnce panel.
     * XHR refers to XmlHttpRequest, a Web API. (see https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest)
     * The text is shown when a XmlHttpRequest load event happens on the inspected page.
     */
    xhrLoad: '`XHR` Load',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    compileScript: 'Compile Script',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    cacheScript: 'Cache Script Code',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    compileCode: 'Compile Code',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    optimizeCode: 'Optimize Code',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    evaluateScript: 'Evaluate Script',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    compileModule: 'Compile Module',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    cacheModule: 'Cache Module Code',
    /**
     * @description Text for an event. Shown in the timeline in the Perforamnce panel.
     * "Module" refers to JavaScript modules: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules
     * JavaScript modules are a way to organize JavaScript code.
     * "Evaluate" is the phase when the JavaScript code of a module is executed.
     */
    evaluateModule: 'Evaluate Module',
    /**
     *@description Noun indicating that a compile task (type: streaming) happened.
     */
    streamingCompileTask: 'Streaming Compile Task',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    waitingForNetwork: 'Waiting for Network',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    parseAndCompile: 'Parse and Compile',
    /**
     * @description Text in Timeline UIUtils of the Performance panel.
     * "Code Cache" refers to JavaScript bytecode cache: https://v8.dev/blog/code-caching-for-devs
     * "Deserialize" refers to the process of reading the code cache.
     */
    deserializeCodeCache: 'Deserialize Code Cache',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    streamingWasmResponse: 'Streaming Wasm Response',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    compiledWasmModule: 'Compiled Wasm Module',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    cachedWasmModule: 'Cached Wasm Module',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    wasmModuleCacheHit: 'Wasm Module Cache Hit',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    wasmModuleCacheInvalid: 'Wasm Module Cache Invalid',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    frameStartedLoading: 'Frame Started Loading',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    onloadEvent: 'Onload Event',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    domcontentloadedEvent: 'DOMContentLoaded Event',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    firstPaint: 'First Paint',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    firstContentfulPaint: 'First Contentful Paint',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    largestContentfulPaint: 'Largest Contentful Paint',
    /**
     *@description Text for timestamps of items
     */
    timestamp: 'Timestamp',
    /**
     *@description Noun for a 'time' event that happens in the Console (a tool in
     * DevTools). The user can trigger console time events from their code, and
     * they will show up in the Performance panel. Time events are used to measure
     * the duration of something, e.g. the user will emit two time events at the
     * start and end of some interesting task.
     */
    consoleTime: 'Console Time',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    userTiming: 'User Timing',
    /**
     * @description Name for an event shown in the Performance panel. When a network
     * request is about to be sent by the browser, the time is recorded and DevTools
     * is notified that a network request will be sent momentarily.
     */
    willSendRequest: 'Will Send Request',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    sendRequest: 'Send Request',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    receiveResponse: 'Receive Response',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    finishLoading: 'Finish Loading',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    receiveData: 'Receive Data',
    /**
     *@description Event category in the Performance panel for time spent to execute microtasks in JavaScript
     */
    runMicrotasks: 'Run Microtasks',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    functionCall: 'Function Call',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    gcEvent: 'GC Event',
    /**
     *@description Event category in the Performance panel for time spent to perform a full Garbage Collection pass
     */
    majorGc: 'Major GC',
    /**
     *@description Event category in the Performance panel for time spent to perform a quick Garbage Collection pass
     */
    minorGc: 'Minor GC',
    /**
     *@description Event category in the Performance panel for root node in CPUProfile
     */
    jsRoot: 'JS Root',
    /**
     *@description Event category in the Performance panel for JavaScript nodes in CPUProfile
     */
    jsFrame: 'JS Frame',
    /**
     *@description Event category in the Performance panel for idle nodes in CPUProfile
     */
    jsIdleFrame: 'JS Idle Frame',
    /**
     *@description Event category in the Performance panel for system nodes in CPUProfile
     */
    jsSystemFrame: 'JS System Frame',
    /**
     *@description Text for the request animation frame event
     */
    requestAnimationFrame: 'Request Animation Frame',
    /**
     *@description Text shown next to the interaction event's ID in the detail view.
     */
    interactionID: 'ID',
    /**
     *@description Text shown next to the interaction event's input delay time in the detail view.
     */
    inputDelay: 'Input delay',
    /**
     *@description Text shown next to the interaction event's thread processing time in the detail view.
     */
    processingTime: 'Processing time',
    /**
     *@description Text shown next to the interaction event's presentation delay time in the detail view.
     */
    presentationDelay: 'Presentation delay',
    /**
     *@description Text to cancel the animation frame
     */
    cancelAnimationFrame: 'Cancel Animation Frame',
    /**
     *@description Text for the event that an animation frame is fired
     */
    animationFrameFired: 'Animation Frame Fired',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    requestIdleCallback: 'Request Idle Callback',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    cancelIdleCallback: 'Cancel Idle Callback',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    fireIdleCallback: 'Fire Idle Callback',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    createWebsocket: 'Create WebSocket',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    sendWebsocketHandshake: 'Send WebSocket Handshake',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    receiveWebsocketHandshake: 'Receive WebSocket Handshake',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    destroyWebsocket: 'Destroy WebSocket',
    /**
     *@description Event category in the Performance panel for time spent in the embedder of the WebView
     */
    embedderCallback: 'Embedder Callback',
    /**
     *@description Event category in the Performance panel for time spent decoding an image
     */
    imageDecode: 'Image Decode',
    /**
     *@description Event category in the Performance panel for time spent to resize an image
     */
    imageResize: 'Image Resize',
    /**
     *@description Event category in the Performance panel for time spent in the GPU
     */
    gpu: 'GPU',
    /**
     *@description Event category in the Performance panel for time spent to perform Garbage Collection for the Document Object Model
     */
    domGc: 'DOM GC',
    /**
     *@description Event category in the Performance panel for time spent to perform encryption
     */
    encrypt: 'Encrypt',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    encryptReply: 'Encrypt Reply',
    /**
     *@description Event category in the Performance panel for time spent to perform decryption
     */
    decrypt: 'Decrypt',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    decryptReply: 'Decrypt Reply',
    /**
     * @description Noun phrase meaning 'the browser was preparing the digest'.
     * Digest: https://developer.mozilla.org/en-US/docs/Glossary/Digest
     */
    digest: 'Digest',
    /**
     *@description Noun phrase meaning 'the browser was preparing the digest
     *reply'. Digest: https://developer.mozilla.org/en-US/docs/Glossary/Digest
     */
    digestReply: 'Digest Reply',
    /**
     *@description The 'sign' stage of a web crypto event. Shown when displaying what the website was doing at a particular point in time.
     */
    sign: 'Sign',
    /**
     * @description Noun phrase for an event of the Web Crypto API. The event is recorded when the signing process is concluded.
     * Signature: https://developer.mozilla.org/en-US/docs/Glossary/Signature/Security
     */
    signReply: 'Sign Reply',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    verify: 'Verify',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    verifyReply: 'Verify Reply',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    asyncTask: 'Async Task',
    /**
     *@description Text in Timeline for Layout Shift records
     */
    layoutShift: 'Layout Shift',
    /**
     *@description Text in Timeline for an Event Timing record
     */
    eventTiming: 'Event Timing',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    compile: 'Compile',
    /**
     *@description Text to parse something
     */
    parse: 'Parse',
    /**
     *@description Text with two placeholders separated by a colon
     *@example {Node removed} PH1
     *@example {div#id1} PH2
     */
    sS: '{PH1}: {PH2}',
    /**
     *@description Details text in Timeline UIUtils of the Performance panel
     *@example {30 MB} PH1
     */
    sCollected: '{PH1} collected',
    /**
     *@description Details text in Timeline UIUtils of the Performance panel
     *@example {https://example.com} PH1
     *@example {2} PH2
     *@example {4} PH3
     */
    sSs: '{PH1} [{PH2}…{PH3}]',
    /**
     *@description Details text in Timeline UIUtils of the Performance panel
     *@example {https://example.com} PH1
     *@example {2} PH2
     */
    sSSquareBrackets: '{PH1} [{PH2}…]',
    /**
     *@description Text that is usually a hyperlink to more documentation
     */
    learnMore: 'Learn more',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    compilationCacheStatus: 'Compilation cache status',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    compilationCacheSize: 'Compilation cache size',
    /**
     *@description Text in Timeline UIUtils of the Performance panel. "Compilation
     * cache" refers to the code cache described at
     * https://v8.dev/blog/code-caching-for-devs . This label is followed by the
     * type of code cache data used, either "normal" or "full" as described in the
     * linked article.
     */
    compilationCacheKind: 'Compilation cache kind',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    scriptLoadedFromCache: 'script loaded from cache',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    failedToLoadScriptFromCache: 'failed to load script from cache',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    scriptNotEligible: 'script not eligible',
    /**
     *@description Text for the total time of something
     */
    totalTime: 'Total Time',
    /**
     *@description Time of a single activity, as opposed to the total time
     */
    selfTime: 'Self Time',
    /**
     *@description Label in the summary view in the Performance panel for a number which indicates how much managed memory has been reclaimed by performing Garbage Collection
     */
    collected: 'Collected',
    /**
     *@description Text for a programming function
     */
    function: 'Function',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    timerId: 'Timer ID',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    timeout: 'Timeout',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    repeats: 'Repeats',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    callbackId: 'Callback ID',
    /**
     *@description Text that refers to the network request method
     */
    requestMethod: 'Request Method',
    /**
     *@description Text to show the priority of an item
     */
    priority: 'Priority',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    encodedData: 'Encoded Data',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    decodedBody: 'Decoded Body',
    /**
     *@description Text for a module, the programming concept
     */
    module: 'Module',
    /**
     *@description Label for a group of JavaScript files
     */
    script: 'Script',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    streamed: 'Streamed',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    eagerCompile: 'Compiling all functions eagerly',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    url: 'Url',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    producedCacheSize: 'Produced Cache Size',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    consumedCacheSize: 'Consumed Cache Size',
    /**
     *@description Title for a group of cities
     */
    location: 'Location',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     *@example {2} PH1
     *@example {2} PH2
     */
    sSCurlyBrackets: '({PH1}, {PH2})',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    dimensions: 'Dimensions',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     *@example {2} PH1
     *@example {2} PH2
     */
    sSDimensions: '{PH1} × {PH2}',
    /**
     *@description Related node label in Timeline UIUtils of the Performance panel
     */
    layerRoot: 'Layer Root',
    /**
     *@description Related node label in Timeline UIUtils of the Performance panel
     */
    ownerElement: 'Owner Element',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    imageUrl: 'Image URL',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    stylesheetUrl: 'Stylesheet URL',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    elementsAffected: 'Elements Affected',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    nodesThatNeedLayout: 'Nodes That Need Layout',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     *@example {2} PH1
     *@example {10} PH2
     */
    sOfS: '{PH1} of {PH2}',
    /**
     *@description Related node label in Timeline UIUtils of the Performance panel
     */
    layoutRoot: 'Layout root',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    message: 'Message',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    callbackFunction: 'Callback Function',
    /**
     *@description The current state of an item
     */
    state: 'State',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    range: 'Range',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    allottedTime: 'Allotted Time',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    invokedByTimeout: 'Invoked by Timeout',
    /**
     *@description Text that refers to some types
     */
    type: 'Type',
    /**
     *@description Text for the size of something
     */
    size: 'Size',
    /**
     *@description Text for the details of something
     */
    details: 'Details',
    /**
     *@description Title in Timeline for Cumulative Layout Shifts
     */
    cumulativeLayoutShifts: 'Cumulative Layout Shifts',
    /**
     *@description Text for the link to the evolved CLS website
     */
    evolvedClsLink: 'evolved',
    /**
     *@description Warning in Timeline that CLS can cause a poor user experience. It contains a link to inform developers about the recent changes to how CLS is measured. The new CLS metric is said to have evolved from the previous version.
     *@example {Link to web.dev/metrics} PH1
     *@example {Link to web.dev/evolving-cls which will always have the text 'evolved'} PH2
     */
    sCLSInformation: '{PH1} can result in poor user experiences. It has recently {PH2}.',
    /**
     *@description Text to indicate an item is a warning
     */
    warning: 'Warning',
    /**
     *@description Title for the Timeline CLS Score
     */
    score: 'Score',
    /**
     *@description Text in Timeline for the cumulative CLS score
     */
    cumulativeScore: 'Cumulative Score',
    /**
     *@description Text in Timeline for the current CLS score
     */
    currentClusterScore: 'Current Cluster Score',
    /**
     *@description Text in Timeline for the current CLS cluster
     */
    currentClusterId: 'Current Cluster ID',
    /**
     *@description Text in Timeline for whether input happened recently
     */
    hadRecentInput: 'Had recent input',
    /**
     *@description Text in Timeline indicating that input has happened recently
     */
    yes: 'Yes',
    /**
     *@description Text in Timeline indicating that input has not happened recently
     */
    no: 'No',
    /**
     *@description Label for Cumulative Layout records, indicating where they moved from
     */
    movedFrom: 'Moved from',
    /**
     *@description Label for Cumulative Layout records, indicating where they moved to
     */
    movedTo: 'Moved to',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    relatedNode: 'Related Node',
    /**
     *@description Text for previewing items
     */
    preview: 'Preview',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    aggregatedTime: 'Aggregated Time',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    networkRequest: 'Network request',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    loadFromCache: 'load from cache',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    networkTransfer: 'network transfer',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     *@example {1ms} PH1
     *@example {network transfer} PH2
     *@example {1ms} PH3
     */
    SSSResourceLoading: ' ({PH1} {PH2} + {PH3} resource loading)',
    /**
     *@description Text for the duration of something
     */
    duration: 'Duration',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    mimeType: 'Mime Type',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    FromMemoryCache: ' (from memory cache)',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    FromCache: ' (from cache)',
    /**
     *@description Label for a network request indicating that it was a HTTP2 server push instead of a regular network request, in the Performance panel
     */
    FromPush: ' (from push)',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    FromServiceWorker: ' (from `service worker`)',
    /**
     *@description Text for the stack trace of the initiator of something. The Initiator is the event or factor that directly triggered or precipitated a subsequent action.
     */
    initiatorStackTrace: 'Initiator Stack Trace',
    /**
     *@description Text for the event initiated by another one
     */
    initiatedBy: 'Initiated by',
    /**
     *@description Text for the event that is an initiator for another one
     */
    initiatorFor: 'Initiator for',
    /**
     *@description Call site stack label in Timeline UIUtils of the Performance panel
     */
    timerInstalled: 'Timer Installed',
    /**
     *@description Call site stack label in Timeline UIUtils of the Performance panel
     */
    animationFrameRequested: 'Animation Frame Requested',
    /**
     *@description Call site stack label in Timeline UIUtils of the Performance panel
     */
    idleCallbackRequested: 'Idle Callback Requested',
    /**
     *@description Stack label in Timeline UIUtils of the Performance panel
     */
    recalculationForced: 'Recalculation Forced',
    /**
     *@description Call site stack label in Timeline UIUtils of the Performance panel
     */
    firstLayoutInvalidation: 'First Layout Invalidation',
    /**
     *@description Stack label in Timeline UIUtils of the Performance panel
     */
    layoutForced: 'Layout Forced',
    /**
     *@description Text for the execution stack trace
     */
    stackTrace: 'Stack Trace',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    invalidations: 'Invalidations',
    /**
     * @description Text in Timeline UIUtils of the Performance panel. Phrase is followed by a number of milliseconds.
     * Some events or tasks might have been only started, but have not ended yet. Such events or tasks are considered
     * "pending".
     */
    pendingFor: 'Pending for',
    /**
     *@description Noun label for a stack trace which indicates the first time some condition was invalidated.
     */
    firstInvalidated: 'First Invalidated',
    /**
     *@description Title of the paint profiler, old name of the performance pane
     */
    paintProfiler: 'Paint Profiler',
    /**
     *@description Text in Timeline Flame Chart View of the Performance panel
     *@example {Frame} PH1
     *@example {10ms} PH2
     */
    sAtS: '{PH1} at {PH2}',
    /**
     *@description Category in the Summary view of the Performance panel to indicate time spent to load resources
     */
    loading: 'Loading',
    /**
     *@description Text in Timeline for the Experience title
     */
    experience: 'Experience',
    /**
     *@description Category in the Summary view of the Performance panel to indicate time spent in script execution
     */
    scripting: 'Scripting',
    /**
     *@description Category in the Summary view of the Performance panel to indicate time spent in rendering the web page
     */
    rendering: 'Rendering',
    /**
     *@description Category in the Summary view of the Performance panel to indicate time spent to visually represent the web page
     */
    painting: 'Painting',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    async: 'Async',
    /**
     *@description Category in the Summary view of the Performance panel to indicate time spent in the rest of the system
     */
    system: 'System',
    /**
     *@description Category in the Summary view of the Performance panel to indicate idle time
     */
    idle: 'Idle',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     *@example {blink.console} PH1
     */
    sSelf: '{PH1} (self)',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     *@example {blink.console} PH1
     */
    sChildren: '{PH1} (children)',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     */
    timeSpentInRendering: 'Time spent in rendering',
    /**
     *@description Text for a rendering frame
     */
    frame: 'Frame',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     *@example {10ms} PH1
     *@example {10ms} PH2
     */
    sAtSParentheses: '{PH1} (at {PH2})',
    /**
     *@description Text of a DOM element in Timeline UIUtils of the Performance panel
     */
    UnknownNode: '[ unknown node ]',
    /**
     *@description Text in Timeline UIUtils of the Performance panel
     *@example {node} PH1
     *@example {app.js} PH2
     */
    invalidationWithCallFrame: '{PH1} at {PH2}',
    /**
     *@description Text indicating that something is outside of the Performace Panel Timeline Minimap range
     */
    outsideBreadcrumbRange: '(outside of the breadcrumb range)',
};
const str_ = i18n.i18n.registerUIStrings('panels/timeline/TimelineUIUtils.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);
let eventStylesMap;
let categories;
let eventCategories;
let eventDispatchDesciptors;
let colorGenerator;
const requestPreviewElements = new WeakMap();
export class TimelineUIUtils {
    static initEventStyles() {
        if (eventStylesMap) {
            return eventStylesMap;
        }
        const type = TimelineModel.TimelineModel.RecordType;
        const categories = TimelineUIUtils.categories();
        const rendering = categories['rendering'];
        const scripting = categories['scripting'];
        const loading = categories['loading'];
        const experience = categories['experience'];
        const painting = categories['painting'];
        const other = categories['other'];
        const idle = categories['idle'];
        const eventStyles = {};
        eventStyles[type.Task] = new TimelineRecordStyle(i18nString(UIStrings.task), other);
        eventStyles[type.Program] = new TimelineRecordStyle(i18nString(UIStrings.other), other);
        eventStyles[type.StartProfiling] = new TimelineRecordStyle(UIStrings.profilingOverhead, other);
        eventStyles[type.Animation] = new TimelineRecordStyle(i18nString(UIStrings.animation), rendering);
        eventStyles[type.EventDispatch] = new TimelineRecordStyle(i18nString(UIStrings.event), scripting);
        eventStyles[type.RequestMainThreadFrame] =
            new TimelineRecordStyle(i18nString(UIStrings.requestMainThreadFrame), rendering, true);
        eventStyles[type.BeginFrame] = new TimelineRecordStyle(i18nString(UIStrings.frameStart), rendering, true);
        eventStyles[type.BeginMainThreadFrame] =
            new TimelineRecordStyle(i18nString(UIStrings.frameStartMainThread), rendering, true);
        eventStyles[type.DrawFrame] = new TimelineRecordStyle(i18nString(UIStrings.drawFrame), rendering, true);
        eventStyles[type.HitTest] = new TimelineRecordStyle(i18nString(UIStrings.hitTest), rendering);
        eventStyles[type.ScheduleStyleRecalculation] =
            new TimelineRecordStyle(i18nString(UIStrings.scheduleStyleRecalculation), rendering);
        eventStyles[type.RecalculateStyles] = new TimelineRecordStyle(i18nString(UIStrings.recalculateStyle), rendering);
        eventStyles[type.UpdateLayoutTree] = new TimelineRecordStyle(i18nString(UIStrings.recalculateStyle), rendering);
        eventStyles[type.InvalidateLayout] =
            new TimelineRecordStyle(i18nString(UIStrings.invalidateLayout), rendering, true);
        eventStyles[type.Layerize] = new TimelineRecordStyle(i18nString(UIStrings.layerize), rendering);
        eventStyles[type.Layout] = new TimelineRecordStyle(i18nString(UIStrings.layout), rendering);
        eventStyles[type.PaintSetup] = new TimelineRecordStyle(i18nString(UIStrings.paintSetup), painting);
        eventStyles[type.PaintImage] = new TimelineRecordStyle(i18nString(UIStrings.paintImage), painting, true);
        eventStyles[type.UpdateLayer] = new TimelineRecordStyle(i18nString(UIStrings.updateLayer), painting, true);
        eventStyles[type.UpdateLayerTree] = new TimelineRecordStyle(i18nString(UIStrings.updateLayerTree), rendering);
        eventStyles[type.Paint] = new TimelineRecordStyle(i18nString(UIStrings.paint), painting);
        eventStyles[type.PrePaint] = new TimelineRecordStyle(i18nString(UIStrings.prePaint), rendering);
        eventStyles[type.RasterTask] = new TimelineRecordStyle(i18nString(UIStrings.rasterizePaint), painting);
        eventStyles[type.ScrollLayer] = new TimelineRecordStyle(i18nString(UIStrings.scroll), rendering);
        eventStyles[type.Commit] = new TimelineRecordStyle(i18nString(UIStrings.commit), painting);
        eventStyles[type.CompositeLayers] = new TimelineRecordStyle(i18nString(UIStrings.compositeLayers), painting);
        eventStyles[type.ComputeIntersections] =
            new TimelineRecordStyle(i18nString(UIStrings.computeIntersections), rendering);
        eventStyles[type.ParseHTML] = new TimelineRecordStyle(i18nString(UIStrings.parseHtml), loading);
        eventStyles[type.ParseAuthorStyleSheet] = new TimelineRecordStyle(i18nString(UIStrings.parseStylesheet), loading);
        eventStyles[type.TimerInstall] = new TimelineRecordStyle(i18nString(UIStrings.installTimer), scripting);
        eventStyles[type.TimerRemove] = new TimelineRecordStyle(i18nString(UIStrings.removeTimer), scripting);
        eventStyles[type.TimerFire] = new TimelineRecordStyle(i18nString(UIStrings.timerFired), scripting);
        eventStyles[type.XHRReadyStateChange] =
            new TimelineRecordStyle(i18nString(UIStrings.xhrReadyStateChange), scripting);
        eventStyles[type.XHRLoad] = new TimelineRecordStyle(i18nString(UIStrings.xhrLoad), scripting);
        eventStyles[type.CompileScript] = new TimelineRecordStyle(i18nString(UIStrings.compileScript), scripting);
        eventStyles[type.CacheScript] = new TimelineRecordStyle(i18nString(UIStrings.cacheScript), scripting);
        eventStyles[type.CompileCode] = new TimelineRecordStyle(i18nString(UIStrings.compileCode), scripting);
        eventStyles[type.OptimizeCode] = new TimelineRecordStyle(i18nString(UIStrings.optimizeCode), scripting);
        eventStyles[type.EvaluateScript] = new TimelineRecordStyle(i18nString(UIStrings.evaluateScript), scripting);
        eventStyles[type.CompileModule] = new TimelineRecordStyle(i18nString(UIStrings.compileModule), scripting);
        eventStyles[type.CacheModule] = new TimelineRecordStyle(i18nString(UIStrings.cacheModule), scripting);
        eventStyles[type.EvaluateModule] = new TimelineRecordStyle(i18nString(UIStrings.evaluateModule), scripting);
        eventStyles[type.StreamingCompileScript] =
            new TimelineRecordStyle(i18nString(UIStrings.streamingCompileTask), other);
        eventStyles[type.StreamingCompileScriptWaiting] =
            new TimelineRecordStyle(i18nString(UIStrings.waitingForNetwork), idle);
        eventStyles[type.StreamingCompileScriptParsing] =
            new TimelineRecordStyle(i18nString(UIStrings.parseAndCompile), scripting);
        eventStyles[type.BackgroundDeserialize] =
            new TimelineRecordStyle(i18nString(UIStrings.deserializeCodeCache), scripting);
        eventStyles[type.FinalizeDeserialization] = new TimelineRecordStyle(UIStrings.profilingOverhead, other);
        eventStyles[type.WasmStreamFromResponseCallback] =
            new TimelineRecordStyle(i18nString(UIStrings.streamingWasmResponse), scripting);
        eventStyles[type.WasmCompiledModule] = new TimelineRecordStyle(i18nString(UIStrings.compiledWasmModule), scripting);
        eventStyles[type.WasmCachedModule] = new TimelineRecordStyle(i18nString(UIStrings.cachedWasmModule), scripting);
        eventStyles[type.WasmModuleCacheHit] = new TimelineRecordStyle(i18nString(UIStrings.wasmModuleCacheHit), scripting);
        eventStyles[type.WasmModuleCacheInvalid] =
            new TimelineRecordStyle(i18nString(UIStrings.wasmModuleCacheInvalid), scripting);
        eventStyles[type.FrameStartedLoading] =
            new TimelineRecordStyle(i18nString(UIStrings.frameStartedLoading), loading, true);
        eventStyles[type.MarkLoad] = new TimelineRecordStyle(i18nString(UIStrings.onloadEvent), scripting, true);
        eventStyles[type.MarkDOMContent] =
            new TimelineRecordStyle(i18nString(UIStrings.domcontentloadedEvent), scripting, true);
        eventStyles[type.MarkFirstPaint] = new TimelineRecordStyle(i18nString(UIStrings.firstPaint), painting, true);
        eventStyles[type.MarkFCP] = new TimelineRecordStyle(i18nString(UIStrings.firstContentfulPaint), rendering, true);
        eventStyles[type.MarkLCPCandidate] =
            new TimelineRecordStyle(i18nString(UIStrings.largestContentfulPaint), rendering, true);
        eventStyles[type.TimeStamp] = new TimelineRecordStyle(i18nString(UIStrings.timestamp), scripting);
        eventStyles[type.ConsoleTime] = new TimelineRecordStyle(i18nString(UIStrings.consoleTime), scripting);
        eventStyles[type.UserTiming] = new TimelineRecordStyle(i18nString(UIStrings.userTiming), scripting);
        eventStyles[type.ResourceWillSendRequest] = new TimelineRecordStyle(i18nString(UIStrings.willSendRequest), loading);
        eventStyles[type.ResourceSendRequest] = new TimelineRecordStyle(i18nString(UIStrings.sendRequest), loading);
        eventStyles[type.ResourceReceiveResponse] = new TimelineRecordStyle(i18nString(UIStrings.receiveResponse), loading);
        eventStyles[type.ResourceFinish] = new TimelineRecordStyle(i18nString(UIStrings.finishLoading), loading);
        eventStyles[type.ResourceReceivedData] = new TimelineRecordStyle(i18nString(UIStrings.receiveData), loading);
        eventStyles[type.RunMicrotasks] = new TimelineRecordStyle(i18nString(UIStrings.runMicrotasks), scripting);
        eventStyles[type.FunctionCall] = new TimelineRecordStyle(i18nString(UIStrings.functionCall), scripting);
        eventStyles[type.GCEvent] = new TimelineRecordStyle(i18nString(UIStrings.gcEvent), scripting);
        eventStyles[type.MajorGC] = new TimelineRecordStyle(i18nString(UIStrings.majorGc), scripting);
        eventStyles[type.MinorGC] = new TimelineRecordStyle(i18nString(UIStrings.minorGc), scripting);
        // Event types used to display CPU Profile.
        eventStyles[type.JSRoot] = new TimelineRecordStyle(i18nString(UIStrings.jsRoot), idle, /* hidden*/ true);
        eventStyles[type.JSFrame] = new TimelineRecordStyle(i18nString(UIStrings.jsFrame), scripting);
        eventStyles[type.JSIdleFrame] = new TimelineRecordStyle(i18nString(UIStrings.jsIdleFrame), idle, /* hidden*/ true);
        // System nodes shoulde be other type. See categories() function in this file (TimelineUIUtils.ts).
        eventStyles[type.JSSystemFrame] =
            new TimelineRecordStyle(i18nString(UIStrings.jsSystemFrame), other, /* hidden*/ true);
        eventStyles[type.RequestAnimationFrame] =
            new TimelineRecordStyle(i18nString(UIStrings.requestAnimationFrame), scripting);
        eventStyles[type.CancelAnimationFrame] =
            new TimelineRecordStyle(i18nString(UIStrings.cancelAnimationFrame), scripting);
        eventStyles[type.FireAnimationFrame] =
            new TimelineRecordStyle(i18nString(UIStrings.animationFrameFired), scripting);
        eventStyles[type.RequestIdleCallback] =
            new TimelineRecordStyle(i18nString(UIStrings.requestIdleCallback), scripting);
        eventStyles[type.CancelIdleCallback] = new TimelineRecordStyle(i18nString(UIStrings.cancelIdleCallback), scripting);
        eventStyles[type.FireIdleCallback] = new TimelineRecordStyle(i18nString(UIStrings.fireIdleCallback), scripting);
        eventStyles[type.WebSocketCreate] = new TimelineRecordStyle(i18nString(UIStrings.createWebsocket), scripting);
        eventStyles[type.WebSocketSendHandshakeRequest] =
            new TimelineRecordStyle(i18nString(UIStrings.sendWebsocketHandshake), scripting);
        eventStyles[type.WebSocketReceiveHandshakeResponse] =
            new TimelineRecordStyle(i18nString(UIStrings.receiveWebsocketHandshake), scripting);
        eventStyles[type.WebSocketDestroy] = new TimelineRecordStyle(i18nString(UIStrings.destroyWebsocket), scripting);
        eventStyles[type.EmbedderCallback] = new TimelineRecordStyle(i18nString(UIStrings.embedderCallback), scripting);
        eventStyles[type.DecodeImage] = new TimelineRecordStyle(i18nString(UIStrings.imageDecode), painting);
        eventStyles[type.ResizeImage] = new TimelineRecordStyle(i18nString(UIStrings.imageResize), painting);
        eventStyles[type.GPUTask] = new TimelineRecordStyle(i18nString(UIStrings.gpu), categories['gpu']);
        eventStyles[type.GCCollectGarbage] = new TimelineRecordStyle(i18nString(UIStrings.domGc), scripting);
        eventStyles[type.CryptoDoEncrypt] = new TimelineRecordStyle(i18nString(UIStrings.encrypt), scripting);
        eventStyles[type.CryptoDoEncryptReply] = new TimelineRecordStyle(i18nString(UIStrings.encryptReply), scripting);
        eventStyles[type.CryptoDoDecrypt] = new TimelineRecordStyle(i18nString(UIStrings.decrypt), scripting);
        eventStyles[type.CryptoDoDecryptReply] = new TimelineRecordStyle(i18nString(UIStrings.decryptReply), scripting);
        eventStyles[type.CryptoDoDigest] = new TimelineRecordStyle(i18nString(UIStrings.digest), scripting);
        eventStyles[type.CryptoDoDigestReply] = new TimelineRecordStyle(i18nString(UIStrings.digestReply), scripting);
        eventStyles[type.CryptoDoSign] = new TimelineRecordStyle(i18nString(UIStrings.sign), scripting);
        eventStyles[type.CryptoDoSignReply] = new TimelineRecordStyle(i18nString(UIStrings.signReply), scripting);
        eventStyles[type.CryptoDoVerify] = new TimelineRecordStyle(i18nString(UIStrings.verify), scripting);
        eventStyles[type.CryptoDoVerifyReply] = new TimelineRecordStyle(i18nString(UIStrings.verifyReply), scripting);
        eventStyles[type.AsyncTask] = new TimelineRecordStyle(i18nString(UIStrings.asyncTask), categories['async']);
        eventStyles[type.LayoutShift] = new TimelineRecordStyle(i18nString(UIStrings.layoutShift), experience);
        eventStyles[type.EventTiming] = new TimelineRecordStyle(UIStrings.eventTiming, experience);
        eventStylesMap = eventStyles;
        return eventStyles;
    }
    static setEventStylesMap(eventStyles) {
        eventStylesMap = eventStyles;
    }
    static frameDisplayName(frame) {
        if (!TimelineModel.TimelineJSProfile.TimelineJSProfileProcessor.isNativeRuntimeFrame(frame)) {
            return UI.UIUtils.beautifyFunctionName(frame.functionName);
        }
        const nativeGroup = TimelineModel.TimelineJSProfile.TimelineJSProfileProcessor.nativeGroup(frame.functionName);
        switch (nativeGroup) {
            case "Compile" /* TimelineModel.TimelineJSProfile.TimelineJSProfileProcessor.NativeGroups.Compile */:
                return i18nString(UIStrings.compile);
            case "Parse" /* TimelineModel.TimelineJSProfile.TimelineJSProfileProcessor.NativeGroups.Parse */:
                return i18nString(UIStrings.parse);
        }
        return frame.functionName;
    }
    static testContentMatching(traceEvent, regExp, traceParsedData) {
        const title = TimelineUIUtils.eventStyle(traceEvent).title;
        const tokens = [title];
        if (TraceEngine.Legacy.eventIsFromNewEngine(traceEvent) &&
            TraceEngine.Types.TraceEvents.isProfileCall(traceEvent)) {
            // In the future this case will not be possible - wherever we call this
            // function we will be able to pass in the data from the new engine. But
            // currently this is called in a variety of places including from the
            // legacy model which does not have a reference to the new engine's data.
            // So if we are missing the data, we just fallback to the name from the
            // callFrame.
            if (!traceParsedData || !traceParsedData.Samples) {
                tokens.push(traceEvent.callFrame.functionName);
            }
            else {
                tokens.push(TraceEngine.Handlers.ModelHandlers.Samples.getProfileCallFunctionName(traceParsedData.Samples, traceEvent));
            }
        }
        const url = TimelineModel.TimelineModel.EventOnTimelineData.forEvent(traceEvent).url;
        if (url) {
            tokens.push(url);
        }
        // This works for both legacy and new engine events.
        appendObjectProperties(traceEvent.args, 2);
        const result = tokens.join('|').match(regExp);
        return result ? result.length > 0 : false;
        function appendObjectProperties(object, depth) {
            if (!depth) {
                return;
            }
            for (const key in object) {
                const value = object[key];
                if (typeof value === 'string') {
                    tokens.push(value);
                }
                else if (typeof value === 'number') {
                    tokens.push(String(value));
                }
                else if (typeof value === 'object' && value !== null) {
                    appendObjectProperties(value, depth - 1);
                }
            }
        }
    }
    static eventStyle(event) {
        const eventStyles = TimelineUIUtils.initEventStyles();
        if (TraceEngine.Legacy.eventHasCategory(event, TimelineModel.TimelineModel.TimelineModelImpl.Category.Console) ||
            TraceEngine.Legacy.eventHasCategory(event, TimelineModel.TimelineModel.TimelineModelImpl.Category.UserTiming)) {
            return new TimelineRecordStyle(event.name, TimelineUIUtils.categories()['scripting']);
        }
        if (TraceEngine.Legacy.eventIsFromNewEngine(event)) {
            if (TraceEngine.Types.TraceEvents.isProfileCall(event)) {
                if (event.callFrame.functionName === '(idle)') {
                    return new TimelineRecordStyle(event.name, getCategoryStyles().Idle);
                }
            }
            const defaultStyles = new TimelineRecordStyle(event.name, getCategoryStyles().Other);
            return getEventStyle(event.name) || defaultStyles;
        }
        let result = eventStyles[event.name];
        // If there's no defined RecordStyle for this event, define as other & hidden.
        if (!result) {
            result = new TimelineRecordStyle(event.name, TimelineUIUtils.categories()['other'], true);
            eventStyles[event.name] = result;
        }
        return result;
    }
    static eventColor(event) {
        if (TraceEngine.Legacy.eventIsFromNewEngine(event) && TraceEngine.Types.TraceEvents.isProfileCall(event)) {
            const frame = event.callFrame;
            if (TimelineUIUtils.isUserFrame(frame)) {
                return TimelineUIUtils.colorForId(frame.url);
            }
        }
        let parsedColor = TimelineUIUtils.eventStyle(event).category.getComputedColorValue();
        // This event is considered idle time but still rendered as a scripting event here
        // to connect the StreamingCompileScriptParsing events it belongs to.
        if (event.name === TimelineModel.TimelineModel.RecordType.StreamingCompileScriptWaiting) {
            parsedColor = TimelineUIUtils.categories().scripting.getComputedColorValue();
            if (!parsedColor) {
                throw new Error('Unable to parse color from TimelineUIUtils.categories().scripting.color');
            }
        }
        return parsedColor;
    }
    static eventTitle(event) {
        // Profile call events do not have a args.data property, thus, we
        // need to check for profile calls in the beginning of this
        // function.
        if (TraceEngine.Legacy.eventIsFromNewEngine(event) && TraceEngine.Types.TraceEvents.isProfileCall(event)) {
            const maybeResolvedName = SourceMapsResolver.resolvedNodeNameForEntry(event);
            const displayName = maybeResolvedName || TimelineUIUtils.frameDisplayName(event.callFrame);
            return displayName;
        }
        const recordType = TimelineModel.TimelineModel.RecordType;
        const eventData = event.args['data'];
        if (event.name === 'EventTiming') {
            let payload = null;
            if (event instanceof TraceEngine.Legacy.PayloadEvent) {
                payload = event.rawPayload();
            }
            else if (TraceEngine.Legacy.eventIsFromNewEngine(event)) {
                payload = event;
            }
            if (payload && TraceEngine.Types.TraceEvents.isSyntheticInteractionEvent(payload)) {
                return titleForInteractionEvent(payload);
            }
        }
        const title = TimelineUIUtils.eventStyle(event).title;
        if (TraceEngine.Legacy.eventHasCategory(event, TimelineModel.TimelineModel.TimelineModelImpl.Category.Console)) {
            return title;
        }
        if (event.name === recordType.TimeStamp) {
            return i18nString(UIStrings.sS, { PH1: title, PH2: eventData['message'] });
        }
        if (event.name === recordType.Animation && eventData && eventData['name']) {
            return i18nString(UIStrings.sS, { PH1: title, PH2: eventData['name'] });
        }
        if (event.name === recordType.EventDispatch && eventData && eventData['type']) {
            return i18nString(UIStrings.sS, { PH1: title, PH2: eventData['type'] });
        }
        return title;
    }
    static isUserFrame(frame) {
        return frame.scriptId !== '0' && !(frame.url && frame.url.startsWith('native '));
    }
    static syntheticNetworkRequestCategory(request) {
        switch (request.args.data.mimeType) {
            case 'text/html':
                return "HTML" /* NetworkCategory.HTML */;
            case 'application/javascript':
            case 'application/x-javascript':
            case 'text/javascript':
                return "Script" /* NetworkCategory.Script */;
            case 'text/css':
                return "Style" /* NetworkCategory.Style */;
            case 'audio/ogg':
            case 'image/gif':
            case 'image/jpeg':
            case 'image/png':
            case 'image/svg+xml':
            case 'image/webp':
            case 'image/x-icon':
            case 'font/opentype':
            case 'font/woff2':
            case 'font/ttf':
            case 'application/font-woff':
                return "Media" /* NetworkCategory.Media */;
            default:
                return "Other" /* NetworkCategory.Other */;
        }
    }
    static networkCategoryColor(category) {
        let cssVarName = '--app-color-system';
        switch (category) {
            case "HTML" /* NetworkCategory.HTML */:
                cssVarName = '--app-color-loading';
                break;
            case "Script" /* NetworkCategory.Script */:
                cssVarName = '--app-color-scripting';
                break;
            case "Style" /* NetworkCategory.Style */:
                cssVarName = '--app-color-rendering';
                break;
            case "Media" /* NetworkCategory.Media */:
                cssVarName = '--app-color-painting';
                break;
            default:
                cssVarName = '--app-color-system';
                break;
        }
        return ThemeSupport.ThemeSupport.instance().getComputedValue(cssVarName);
    }
    static async buildDetailsTextForTraceEvent(event) {
        const recordType = TimelineModel.TimelineModel.RecordType;
        let detailsText;
        const eventData = event.args['data'];
        switch (event.name) {
            case recordType.GCEvent:
            case recordType.MajorGC:
            case recordType.MinorGC: {
                const delta = event.args['usedHeapSizeBefore'] - event.args['usedHeapSizeAfter'];
                detailsText = i18nString(UIStrings.sCollected, { PH1: Platform.NumberUtilities.bytesToString(delta) });
                break;
            }
            case recordType.FunctionCall:
                if (eventData && eventData['url'] && eventData['lineNumber'] !== undefined &&
                    eventData['columnNumber'] !== undefined) {
                    detailsText = eventData.url + ':' + (eventData.lineNumber + 1) + ':' + (eventData.columnNumber + 1);
                }
                break;
            case recordType.JSRoot:
            case recordType.JSFrame:
            case recordType.JSIdleFrame:
            case recordType.JSSystemFrame:
                detailsText = TimelineUIUtils.frameDisplayName(eventData);
                break;
            case recordType.EventDispatch:
                detailsText = eventData ? eventData['type'] : null;
                break;
            case recordType.Paint: {
                const width = TimelineUIUtils.quadWidth(eventData.clip);
                const height = TimelineUIUtils.quadHeight(eventData.clip);
                if (width && height) {
                    detailsText = i18nString(UIStrings.sSDimensions, { PH1: width, PH2: height });
                }
                break;
            }
            case recordType.ParseHTML: {
                const startLine = event.args['beginData']['startLine'];
                const endLine = event.args['endData'] && event.args['endData']['endLine'];
                const url = Bindings.ResourceUtils.displayNameForURL(event.args['beginData']['url']);
                if (endLine >= 0) {
                    detailsText = i18nString(UIStrings.sSs, { PH1: url, PH2: startLine + 1, PH3: endLine + 1 });
                }
                else {
                    detailsText = i18nString(UIStrings.sSSquareBrackets, { PH1: url, PH2: startLine + 1 });
                }
                break;
            }
            case recordType.CompileModule:
            case recordType.CacheModule:
                detailsText = Bindings.ResourceUtils.displayNameForURL(event.args['fileName']);
                break;
            case recordType.CompileScript:
            case recordType.CacheScript:
            case recordType.EvaluateScript: {
                const url = eventData && eventData['url'];
                if (url) {
                    detailsText = Bindings.ResourceUtils.displayNameForURL(url) + ':' + (eventData['lineNumber'] + 1);
                }
                break;
            }
            case recordType.WasmCompiledModule:
            case recordType.WasmModuleCacheHit: {
                const url = event.args['url'];
                if (url) {
                    detailsText = Bindings.ResourceUtils.displayNameForURL(url);
                }
                break;
            }
            case recordType.StreamingCompileScript:
            case recordType.BackgroundDeserialize:
            case recordType.XHRReadyStateChange:
            case recordType.XHRLoad: {
                const url = eventData['url'];
                if (url) {
                    detailsText = Bindings.ResourceUtils.displayNameForURL(url);
                }
                break;
            }
            case recordType.TimeStamp:
                detailsText = eventData['message'];
                break;
            case recordType.WebSocketCreate:
            case recordType.WebSocketSendHandshakeRequest:
            case recordType.WebSocketReceiveHandshakeResponse:
            case recordType.WebSocketDestroy:
            case recordType.ResourceWillSendRequest:
            case recordType.ResourceSendRequest:
            case recordType.ResourceReceivedData:
            case recordType.ResourceReceiveResponse:
            case recordType.ResourceFinish:
            case recordType.PaintImage:
            case recordType.DecodeImage:
            case recordType.ResizeImage:
            case recordType.DecodeLazyPixelRef: {
                const url = TimelineModel.TimelineModel.EventOnTimelineData.forEvent(event).url;
                if (url) {
                    detailsText = Bindings.ResourceUtils.displayNameForURL(url);
                }
                break;
            }
            case recordType.EmbedderCallback:
                detailsText = eventData['callbackName'];
                break;
            case recordType.Animation:
                detailsText = eventData && eventData['name'];
                break;
            case recordType.AsyncTask:
                detailsText = eventData ? eventData['name'] : null;
                break;
            default:
                if (TraceEngine.Legacy.eventHasCategory(event, TimelineModel.TimelineModel.TimelineModelImpl.Category.Console)) {
                    detailsText = null;
                }
                else {
                    detailsText = await linkifyTopCallFrameAsText();
                }
                break;
        }
        return detailsText;
        async function linkifyTopCallFrameAsText() {
            const frame = TimelineModel.TimelineModel.EventOnTimelineData.forEvent(event).topFrame();
            if (!frame) {
                return null;
            }
            return frame.url + ':' + (frame.lineNumber + 1) + ':' + (frame.columnNumber + 1);
        }
    }
    static async buildDetailsNodeForTraceEvent(event, target, linkifier, isFreshRecording = false) {
        const recordType = TimelineModel.TimelineModel.RecordType;
        let details = null;
        let detailsText;
        const eventData = event.args['data'];
        switch (event.name) {
            case recordType.GCEvent:
            case recordType.MajorGC:
            case recordType.MinorGC:
            case recordType.EventDispatch:
            case recordType.Paint:
            case recordType.Animation:
            case recordType.EmbedderCallback:
            case recordType.ParseHTML:
            case recordType.WasmStreamFromResponseCallback:
            case recordType.WasmCompiledModule:
            case recordType.WasmModuleCacheHit:
            case recordType.WasmCachedModule:
            case recordType.WasmModuleCacheInvalid:
            case recordType.WebSocketCreate:
            case recordType.WebSocketSendHandshakeRequest:
            case recordType.WebSocketReceiveHandshakeResponse:
            case recordType.WebSocketDestroy: {
                detailsText = await TimelineUIUtils.buildDetailsTextForTraceEvent(event);
                break;
            }
            case recordType.PaintImage:
            case recordType.DecodeImage:
            case recordType.ResizeImage:
            case recordType.DecodeLazyPixelRef:
            case recordType.XHRReadyStateChange:
            case recordType.XHRLoad:
            case recordType.ResourceWillSendRequest:
            case recordType.ResourceSendRequest:
            case recordType.ResourceReceivedData:
            case recordType.ResourceReceiveResponse:
            case recordType.ResourceFinish: {
                const url = TimelineModel.TimelineModel.EventOnTimelineData.forEvent(event).url;
                if (url) {
                    const options = {
                        tabStop: true,
                        showColumnNumber: false,
                        inlineFrameIndex: 0,
                    };
                    details = LegacyComponents.Linkifier.Linkifier.linkifyURL(url, options);
                }
                break;
            }
            case recordType.JSRoot:
            case recordType.FunctionCall:
            case recordType.JSIdleFrame:
            case recordType.JSSystemFrame:
            case recordType.JSFrame: {
                details = document.createElement('span');
                UI.UIUtils.createTextChild(details, TimelineUIUtils.frameDisplayName(eventData));
                const location = this.linkifyLocation({
                    scriptId: eventData['scriptId'],
                    url: eventData['url'],
                    lineNumber: eventData['lineNumber'],
                    columnNumber: eventData['columnNumber'],
                    target,
                    isFreshRecording,
                    linkifier,
                });
                if (location) {
                    UI.UIUtils.createTextChild(details, ' @ ');
                    details.appendChild(location);
                }
                break;
            }
            case recordType.CompileModule:
            case recordType.CacheModule: {
                details = this.linkifyLocation({
                    scriptId: null,
                    url: event.args['fileName'],
                    lineNumber: 0,
                    columnNumber: 0,
                    target,
                    isFreshRecording,
                    linkifier,
                });
                break;
            }
            case recordType.CompileScript:
            case recordType.CacheScript:
            case recordType.EvaluateScript: {
                const url = eventData['url'];
                if (url) {
                    details = this.linkifyLocation({
                        scriptId: null,
                        url,
                        lineNumber: eventData['lineNumber'],
                        columnNumber: 0,
                        target,
                        isFreshRecording,
                        linkifier,
                    });
                }
                break;
            }
            case recordType.BackgroundDeserialize:
            case recordType.StreamingCompileScript: {
                const url = eventData['url'];
                if (url) {
                    details = this.linkifyLocation({ scriptId: null, url, lineNumber: 0, columnNumber: 0, target, isFreshRecording, linkifier });
                }
                break;
            }
            case "ProfileCall" /* TraceEngine.Types.TraceEvents.KnownEventName.ProfileCall */: {
                details = document.createElement('span');
                // This check is only added for convenience with the type checker.
                if (!TraceEngine.Legacy.eventIsFromNewEngine(event) || !TraceEngine.Types.TraceEvents.isProfileCall(event)) {
                    break;
                }
                const maybeResolvedName = SourceMapsResolver.resolvedNodeNameForEntry(event);
                const functionName = maybeResolvedName || TimelineUIUtils.frameDisplayName(event.callFrame);
                UI.UIUtils.createTextChild(details, functionName);
                const location = this.linkifyLocation({
                    scriptId: event.callFrame['scriptId'],
                    url: event.callFrame['url'],
                    lineNumber: event.callFrame['lineNumber'],
                    columnNumber: event.callFrame['columnNumber'],
                    target,
                    isFreshRecording,
                    linkifier,
                });
                if (location) {
                    UI.UIUtils.createTextChild(details, ' @ ');
                    details.appendChild(location);
                }
                break;
            }
            default: {
                if (TraceEngine.Legacy.eventHasCategory(event, TimelineModel.TimelineModel.TimelineModelImpl.Category.Console)) {
                    detailsText = null;
                }
                else {
                    details = TraceEngine.Legacy.eventIsFromNewEngine(event) ?
                        this.linkifyTopCallFrame(event, target, linkifier, isFreshRecording) :
                        null;
                }
                break;
            }
        }
        if (!details && detailsText) {
            details = document.createTextNode(detailsText);
        }
        return details;
    }
    static linkifyLocation(linkifyOptions) {
        const { scriptId, url, lineNumber, columnNumber, isFreshRecording, linkifier, target } = linkifyOptions;
        const options = {
            lineNumber,
            columnNumber,
            showColumnNumber: true,
            inlineFrameIndex: 0,
            className: 'timeline-details',
            tabStop: true,
        };
        if (isFreshRecording) {
            return linkifier.linkifyScriptLocation(target, scriptId, url, lineNumber, options);
        }
        return LegacyComponents.Linkifier.Linkifier.linkifyURL(url, options);
    }
    static linkifyTopCallFrame(event, target, linkifier, isFreshRecording = false) {
        const frame = TimelineModel.TimelineProfileTree.eventStackFrame(event);
        if (!frame) {
            return null;
        }
        const options = {
            className: 'timeline-details',
            tabStop: true,
            inlineFrameIndex: 0,
            showColumnNumber: true,
            columnNumber: frame.columnNumber,
            lineNumber: frame.lineNumber,
        };
        if (isFreshRecording) {
            return linkifier.maybeLinkifyConsoleCallFrame(target, frame, { showColumnNumber: true, inlineFrameIndex: 0 });
        }
        return LegacyComponents.Linkifier.Linkifier.linkifyURL(frame.url, options);
    }
    static buildDetailsNodeForPerformanceEvent(event) {
        let link = 'https://web.dev/user-centric-performance-metrics/';
        let name = 'page performance metrics';
        const recordType = TimelineModel.TimelineModel.RecordType;
        switch (event.name) {
            case recordType.MarkLCPCandidate:
                link = 'https://web.dev/lcp/';
                name = 'largest contentful paint';
                break;
            case recordType.MarkFCP:
                link = 'https://web.dev/first-contentful-paint/';
                name = 'first contentful paint';
                break;
            default:
                break;
        }
        return UI.Fragment.html `<div>${UI.XLink.XLink.create(link, i18nString(UIStrings.learnMore), undefined, undefined, 'learn-more')} about ${name}.</div>`;
    }
    static buildConsumeCacheDetails(eventData, contentHelper) {
        if (typeof eventData.consumedCacheSize === 'number') {
            contentHelper.appendTextRow(i18nString(UIStrings.compilationCacheStatus), i18nString(UIStrings.scriptLoadedFromCache));
            contentHelper.appendTextRow(i18nString(UIStrings.compilationCacheSize), Platform.NumberUtilities.bytesToString(eventData.consumedCacheSize));
            const cacheKind = eventData.cacheKind;
            if (cacheKind) {
                contentHelper.appendTextRow(i18nString(UIStrings.compilationCacheKind), cacheKind);
            }
        }
        else if ('cacheRejected' in eventData && eventData['cacheRejected']) {
            // Version mismatch or similar.
            contentHelper.appendTextRow(i18nString(UIStrings.compilationCacheStatus), i18nString(UIStrings.failedToLoadScriptFromCache));
        }
        else {
            contentHelper.appendTextRow(i18nString(UIStrings.compilationCacheStatus), i18nString(UIStrings.scriptNotEligible));
        }
    }
    static async buildTraceEventDetails(event, model, linkifier, detailed, 
    // TODO(crbug.com/1430809): the order of these arguments is slightly
    // awkward because to change them is to cause a lot of layout tests to be
    // updated. We should rewrite those tests as unit tests in this codebase,
    // and then we can more easily change this method.
    traceParseData = null) {
        const maybeTarget = model.targetByEvent(event);
        const { duration, selfTime } = TraceEngine.Legacy.timesForEventInMilliseconds(event);
        let relatedNodesMap = null;
        if (maybeTarget) {
            const target = maybeTarget;
            // @ts-ignore TODO(crbug.com/1011811): Remove symbol usage.
            if (typeof event[previewElementSymbol] === 'undefined') {
                let previewElement = null;
                const url = TimelineModel.TimelineModel.EventOnTimelineData.forEvent(event).url;
                if (url) {
                    previewElement = await LegacyComponents.ImagePreview.ImagePreview.build(target, url, false, {
                        imageAltText: LegacyComponents.ImagePreview.ImagePreview.defaultAltTextForImageURL(url),
                        precomputedFeatures: undefined,
                    });
                }
                else if (traceParseData && TraceEngine.Legacy.eventIsFromNewEngine(event) &&
                    TraceEngine.Types.TraceEvents.isTraceEventPaint(event)) {
                    previewElement = await TimelineUIUtils.buildPicturePreviewContent(traceParseData, event, target);
                }
                // @ts-ignore TODO(crbug.com/1011811): Remove symbol usage.
                event[previewElementSymbol] = previewElement;
            }
            const nodeIdsToResolve = new Set();
            const timelineData = TimelineModel.TimelineModel.EventOnTimelineData.forEvent(event);
            if (timelineData.backendNodeIds) {
                for (let i = 0; i < timelineData.backendNodeIds.length; ++i) {
                    nodeIdsToResolve.add(timelineData.backendNodeIds[i]);
                }
            }
            if (nodeIdsToResolve.size) {
                const domModel = target.model(SDK.DOMModel.DOMModel);
                if (domModel) {
                    relatedNodesMap = await domModel.pushNodesByBackendIdsToFrontend(nodeIdsToResolve);
                }
            }
            if (traceParseData && TraceEngine.Legacy.eventIsFromNewEngine(event) &&
                TraceEngine.Types.TraceEvents.isSyntheticLayoutShift(event)) {
                relatedNodesMap = await TraceEngine.Extras.FetchNodes.extractRelatedDOMNodesFromEvent(traceParseData, event);
            }
        }
        const recordTypes = TimelineModel.TimelineModel.RecordType;
        if (event.name === recordTypes.LayoutShift) {
            // Ensure that there are no pie charts or extended info for layout shifts.
            detailed = false;
        }
        // This message may vary per event.name;
        let relatedNodeLabel;
        const contentHelper = new TimelineDetailsContentHelper(model.targetByEvent(event), linkifier);
        const defaultColorForEvent = TraceEngine.Legacy.eventIsFromNewEngine(event) ?
            getEventStyle(event.name)?.category.getComputedColorValue() :
            TimelineUIUtils.eventStyle(event).category.getComputedColorValue();
        const color = model.isMarkerEvent(event) ? TimelineUIUtils.markerStyleForEvent(event).color : defaultColorForEvent;
        contentHelper.addSection(TimelineUIUtils.eventTitle(event), color);
        const eventData = event.args['data'];
        const timelineData = TimelineModel.TimelineModel.EventOnTimelineData.forEvent(event);
        const initiator = TraceEngine.Legacy.eventIsFromNewEngine(event) ?
            traceParseData?.Initiators.eventToInitiator.get(event) ?? null :
            null;
        const initiatorFor = TraceEngine.Legacy.eventIsFromNewEngine(event) ?
            traceParseData?.Initiators.initiatorToEvents.get(event) ?? null :
            null;
        let url = null;
        if (TraceEngine.Legacy.eventIsFromNewEngine(event) && traceParseData) {
            const warnings = TimelineComponents.DetailsView.buildWarningElementsForEvent(event, traceParseData);
            for (const warning of warnings) {
                contentHelper.appendElementRow(i18nString(UIStrings.warning), warning, true);
            }
        }
        if (detailed && !Number.isNaN(duration || 0)) {
            contentHelper.appendTextRow(i18nString(UIStrings.totalTime), i18n.TimeUtilities.millisToString(duration || 0, true));
            contentHelper.appendTextRow(i18nString(UIStrings.selfTime), i18n.TimeUtilities.millisToString(selfTime, true));
        }
        if (traceParseData?.Meta.traceIsGeneric) {
            for (const key in event.args) {
                try {
                    contentHelper.appendTextRow(key, JSON.stringify(event.args[key]));
                }
                catch (e) {
                    contentHelper.appendTextRow(key, `<${typeof event.args[key]}>`);
                }
            }
            return contentHelper.fragment;
        }
        if (TraceEngine.Legacy.eventIsFromNewEngine(event) && TraceEngine.Types.TraceEvents.isTraceEventV8Compile(event)) {
            url = event.args.data?.url;
            if (url) {
                const lineNumber = event.args?.data?.lineNumber || 0;
                const columnNumber = event.args?.data?.columnNumber;
                contentHelper.appendLocationRow(i18nString(UIStrings.script), url, lineNumber, columnNumber);
            }
            const isEager = Boolean(event.args.data?.eager);
            if (isEager) {
                contentHelper.appendTextRow(i18nString(UIStrings.eagerCompile), true);
            }
            const isStreamed = Boolean(event.args.data?.streamed);
            contentHelper.appendTextRow(i18nString(UIStrings.streamed), isStreamed + (isStreamed ? '' : `: ${event.args.data?.notStreamedReason || ''}`));
            TimelineUIUtils.buildConsumeCacheDetails(eventData, contentHelper);
        }
        switch (event.name) {
            case recordTypes.GCEvent:
            case recordTypes.MajorGC:
            case recordTypes.MinorGC: {
                const delta = event.args['usedHeapSizeBefore'] - event.args['usedHeapSizeAfter'];
                contentHelper.appendTextRow(i18nString(UIStrings.collected), Platform.NumberUtilities.bytesToString(delta));
                break;
            }
            case recordTypes.JSRoot:
            case recordTypes.JSFrame:
            case "ProfileCall" /* TraceEngine.Types.TraceEvents.KnownEventName.ProfileCall */:
            case recordTypes.JSIdleFrame:
            case recordTypes.JSSystemFrame:
            case recordTypes.FunctionCall: {
                const detailsNode = await TimelineUIUtils.buildDetailsNodeForTraceEvent(event, model.targetByEvent(event), linkifier, model.isFreshRecording());
                if (detailsNode) {
                    contentHelper.appendElementRow(i18nString(UIStrings.function), detailsNode);
                }
                break;
            }
            case recordTypes.TimerFire:
            case recordTypes.TimerInstall:
            case recordTypes.TimerRemove: {
                contentHelper.appendTextRow(i18nString(UIStrings.timerId), eventData['timerId']);
                if (event.name === recordTypes.TimerInstall) {
                    contentHelper.appendTextRow(i18nString(UIStrings.timeout), i18n.TimeUtilities.millisToString(eventData['timeout']));
                    contentHelper.appendTextRow(i18nString(UIStrings.repeats), !eventData['singleShot']);
                }
                break;
            }
            case recordTypes.FireAnimationFrame: {
                contentHelper.appendTextRow(i18nString(UIStrings.callbackId), eventData['id']);
                break;
            }
            case recordTypes.CompileModule: {
                contentHelper.appendLocationRow(i18nString(UIStrings.module), event.args['fileName'], 0);
                break;
            }
            case recordTypes.CompileScript: {
                // This case is handled above
                break;
            }
            case recordTypes.CacheModule: {
                url = eventData && eventData['url'];
                contentHelper.appendTextRow(i18nString(UIStrings.compilationCacheSize), Platform.NumberUtilities.bytesToString(eventData['producedCacheSize']));
                break;
            }
            case recordTypes.CacheScript: {
                url = eventData && eventData['url'];
                if (url) {
                    contentHelper.appendLocationRow(i18nString(UIStrings.script), url, eventData['lineNumber'], eventData['columnNumber']);
                }
                contentHelper.appendTextRow(i18nString(UIStrings.compilationCacheSize), Platform.NumberUtilities.bytesToString(eventData['producedCacheSize']));
                break;
            }
            case recordTypes.EvaluateScript: {
                url = eventData && eventData['url'];
                if (url) {
                    contentHelper.appendLocationRow(i18nString(UIStrings.script), url, eventData['lineNumber'], eventData['columnNumber']);
                }
                break;
            }
            case recordTypes.WasmStreamFromResponseCallback:
            case recordTypes.WasmCompiledModule:
            case recordTypes.WasmCachedModule:
            case recordTypes.WasmModuleCacheHit:
            case recordTypes.WasmModuleCacheInvalid: {
                if (eventData) {
                    url = event.args['url'];
                    if (url) {
                        contentHelper.appendTextRow(i18nString(UIStrings.url), url);
                    }
                    const producedCachedSize = event.args['producedCachedSize'];
                    if (producedCachedSize) {
                        contentHelper.appendTextRow(i18nString(UIStrings.producedCacheSize), producedCachedSize);
                    }
                    const consumedCachedSize = event.args['consumedCachedSize'];
                    if (consumedCachedSize) {
                        contentHelper.appendTextRow(i18nString(UIStrings.consumedCacheSize), consumedCachedSize);
                    }
                }
                break;
            }
            // @ts-ignore Fall-through intended.
            case recordTypes.Paint: {
                const clip = eventData['clip'];
                contentHelper.appendTextRow(i18nString(UIStrings.location), i18nString(UIStrings.sSCurlyBrackets, { PH1: clip[0], PH2: clip[1] }));
                const clipWidth = TimelineUIUtils.quadWidth(clip);
                const clipHeight = TimelineUIUtils.quadHeight(clip);
                contentHelper.appendTextRow(i18nString(UIStrings.dimensions), i18nString(UIStrings.sSDimensions, { PH1: clipWidth, PH2: clipHeight }));
            }
            case recordTypes.PaintSetup:
            case recordTypes.Rasterize:
            case recordTypes.ScrollLayer: {
                relatedNodeLabel = i18nString(UIStrings.layerRoot);
                break;
            }
            case recordTypes.PaintImage:
            case recordTypes.DecodeLazyPixelRef:
            case recordTypes.DecodeImage:
            case recordTypes.ResizeImage:
            case recordTypes.DrawLazyPixelRef: {
                relatedNodeLabel = i18nString(UIStrings.ownerElement);
                url = timelineData.url;
                if (url) {
                    const options = {
                        tabStop: true,
                        showColumnNumber: false,
                        inlineFrameIndex: 0,
                    };
                    contentHelper.appendElementRow(i18nString(UIStrings.imageUrl), LegacyComponents.Linkifier.Linkifier.linkifyURL(url, options));
                }
                break;
            }
            case recordTypes.ParseAuthorStyleSheet: {
                url = eventData['styleSheetUrl'];
                if (url) {
                    const options = {
                        tabStop: true,
                        showColumnNumber: false,
                        inlineFrameIndex: 0,
                    };
                    contentHelper.appendElementRow(i18nString(UIStrings.stylesheetUrl), LegacyComponents.Linkifier.Linkifier.linkifyURL(url, options));
                }
                break;
            }
            case recordTypes.UpdateLayoutTree: // We don't want to see default details.
            case recordTypes.RecalculateStyles: {
                contentHelper.appendTextRow(i18nString(UIStrings.elementsAffected), event.args['elementCount']);
                break;
            }
            case recordTypes.Layout: {
                const beginData = event.args['beginData'];
                contentHelper.appendTextRow(i18nString(UIStrings.nodesThatNeedLayout), i18nString(UIStrings.sOfS, { PH1: beginData['dirtyObjects'], PH2: beginData['totalObjects'] }));
                relatedNodeLabel = i18nString(UIStrings.layoutRoot);
                break;
            }
            case recordTypes.ConsoleTime: {
                contentHelper.appendTextRow(i18nString(UIStrings.message), event.name);
                break;
            }
            case recordTypes.WebSocketCreate:
            case recordTypes.WebSocketSendHandshakeRequest:
            case recordTypes.WebSocketReceiveHandshakeResponse:
            case recordTypes.WebSocketDestroy: {
                // The events will be from tthe new engine; as we remove the old engine we can remove these checks.
                if (TraceEngine.Legacy.eventIsFromNewEngine(event) &&
                    TraceEngine.Types.TraceEvents.isWebSocketTraceEvent(event) && traceParseData) {
                    const rows = TimelineComponents.DetailsView.buildRowsForWebSocketEvent(event, traceParseData);
                    for (const { key, value } of rows) {
                        contentHelper.appendTextRow(key, value);
                    }
                }
                break;
            }
            case recordTypes.EmbedderCallback: {
                contentHelper.appendTextRow(i18nString(UIStrings.callbackFunction), eventData['callbackName']);
                break;
            }
            case recordTypes.Animation: {
                if (TraceEngine.Legacy.phaseForEvent(event) === "n" /* TraceEngine.Types.TraceEvents.Phase.ASYNC_NESTABLE_INSTANT */) {
                    contentHelper.appendTextRow(i18nString(UIStrings.state), eventData['state']);
                }
                break;
            }
            case recordTypes.ParseHTML: {
                const beginData = event.args['beginData'];
                const startLine = beginData['startLine'] - 1;
                const endLine = event.args['endData'] ? event.args['endData']['endLine'] - 1 : undefined;
                url = beginData['url'];
                if (url) {
                    contentHelper.appendLocationRange(i18nString(UIStrings.range), url, startLine, endLine);
                }
                break;
            }
            // @ts-ignore Fall-through intended.
            case recordTypes.FireIdleCallback: {
                contentHelper.appendTextRow(i18nString(UIStrings.allottedTime), i18n.TimeUtilities.millisToString(eventData['allottedMilliseconds']));
                contentHelper.appendTextRow(i18nString(UIStrings.invokedByTimeout), eventData['timedOut']);
            }
            case recordTypes.RequestIdleCallback:
            case recordTypes.CancelIdleCallback: {
                contentHelper.appendTextRow(i18nString(UIStrings.callbackId), eventData['id']);
                break;
            }
            case recordTypes.EventDispatch: {
                contentHelper.appendTextRow(i18nString(UIStrings.type), eventData['type']);
                break;
            }
            // @ts-ignore Fall-through intended.
            case recordTypes.MarkLCPCandidate: {
                contentHelper.appendTextRow(i18nString(UIStrings.type), String(eventData['type']));
                contentHelper.appendTextRow(i18nString(UIStrings.size), String(eventData['size']));
            }
            case recordTypes.MarkFirstPaint:
            case recordTypes.MarkFCP:
            case recordTypes.MarkLoad:
            case recordTypes.MarkDOMContent: {
                // Because the TimingsTrack has been migrated to the new engine, we
                // know that this conditonal will be true, but it is here to satisfy
                // TypeScript. That is also why there is no else branch for this -
                // there is no way in which timings here can be the legacy
                // SDKTraceEvent class.
                if (traceParseData && TraceEngine.Legacy.eventIsFromNewEngine(event)) {
                    const adjustedEventTimeStamp = timeStampForEventAdjustedForClosestNavigationIfPossible(event, traceParseData);
                    contentHelper.appendTextRow(i18nString(UIStrings.timestamp), i18n.TimeUtilities.preciseMillisToString(adjustedEventTimeStamp, 1));
                    contentHelper.appendElementRow(i18nString(UIStrings.details), TimelineUIUtils.buildDetailsNodeForPerformanceEvent(event));
                }
                break;
            }
            case recordTypes.EventTiming: {
                const detailsNode = await TimelineUIUtils.buildDetailsNodeForTraceEvent(event, model.targetByEvent(event), linkifier, model.isFreshRecording());
                if (detailsNode) {
                    contentHelper.appendElementRow(i18nString(UIStrings.details), detailsNode);
                }
                let payload = null;
                if (TraceEngine.Legacy.eventIsFromNewEngine(event)) {
                    payload = event;
                }
                else if (TraceEngine.Legacy.eventHasPayload(event)) {
                    payload = event.rawPayload();
                }
                if (payload && TraceEngine.Types.TraceEvents.isSyntheticInteractionEvent(payload)) {
                    const inputDelay = TraceEngine.Helpers.Timing.formatMicrosecondsTime(payload.inputDelay);
                    const mainThreadTime = TraceEngine.Helpers.Timing.formatMicrosecondsTime(payload.mainThreadHandling);
                    const presentationDelay = TraceEngine.Helpers.Timing.formatMicrosecondsTime(payload.presentationDelay);
                    contentHelper.appendTextRow(i18nString(UIStrings.interactionID), payload.interactionId);
                    contentHelper.appendTextRow(i18nString(UIStrings.inputDelay), inputDelay);
                    contentHelper.appendTextRow(i18nString(UIStrings.processingTime), mainThreadTime);
                    contentHelper.appendTextRow(i18nString(UIStrings.presentationDelay), presentationDelay);
                }
                break;
            }
            case recordTypes.LayoutShift: {
                if (!TraceEngine.Legacy.eventIsFromNewEngine(event) ||
                    !TraceEngine.Types.TraceEvents.isSyntheticLayoutShift(event)) {
                    console.error('Unexpected type for LayoutShift event');
                    break;
                }
                const layoutShift = event;
                const layoutShiftEventData = layoutShift.args.data;
                const warning = document.createElement('span');
                const clsLink = UI.XLink.XLink.create('https://web.dev/cls/', i18nString(UIStrings.cumulativeLayoutShifts), undefined, undefined, 'cumulative-layout-shifts');
                const evolvedClsLink = UI.XLink.XLink.create('https://web.dev/evolving-cls/', i18nString(UIStrings.evolvedClsLink), undefined, undefined, 'evolved-cls');
                warning.appendChild(i18n.i18n.getFormatLocalizedString(str_, UIStrings.sCLSInformation, { PH1: clsLink, PH2: evolvedClsLink }));
                contentHelper.appendElementRow(i18nString(UIStrings.warning), warning, true);
                if (!layoutShiftEventData) {
                    break;
                }
                contentHelper.appendTextRow(i18nString(UIStrings.score), layoutShiftEventData['score'].toPrecision(4));
                contentHelper.appendTextRow(i18nString(UIStrings.cumulativeScore), layoutShiftEventData['cumulative_score'].toPrecision(4));
                contentHelper.appendTextRow(i18nString(UIStrings.currentClusterId), layoutShift.parsedData.sessionWindowData.id);
                contentHelper.appendTextRow(i18nString(UIStrings.currentClusterScore), layoutShift.parsedData.sessionWindowData.cumulativeWindowScore.toPrecision(4));
                contentHelper.appendTextRow(i18nString(UIStrings.hadRecentInput), eventData['had_recent_input'] ? i18nString(UIStrings.yes) : i18nString(UIStrings.no));
                for (const impactedNode of eventData['impacted_nodes']) {
                    const oldRect = new CLSRect(impactedNode['old_rect']);
                    const newRect = new CLSRect(impactedNode['new_rect']);
                    const linkedOldRect = await Common.Linkifier.Linkifier.linkify(oldRect);
                    const linkedNewRect = await Common.Linkifier.Linkifier.linkify(newRect);
                    contentHelper.appendElementRow(i18nString(UIStrings.movedFrom), linkedOldRect);
                    contentHelper.appendElementRow(i18nString(UIStrings.movedTo), linkedNewRect);
                }
                break;
            }
            default: {
                const detailsNode = await TimelineUIUtils.buildDetailsNodeForTraceEvent(event, model.targetByEvent(event), linkifier, model.isFreshRecording());
                if (detailsNode) {
                    contentHelper.appendElementRow(i18nString(UIStrings.details), detailsNode);
                }
                break;
            }
        }
        const relatedNodes = relatedNodesMap?.values() || [];
        for (const relatedNode of relatedNodes) {
            if (relatedNode) {
                const nodeSpan = await Common.Linkifier.Linkifier.linkify(relatedNode);
                contentHelper.appendElementRow(relatedNodeLabel || i18nString(UIStrings.relatedNode), nodeSpan);
            }
        }
        // @ts-ignore TODO(crbug.com/1011811): Remove symbol usage.
        if (event[previewElementSymbol]) {
            contentHelper.addSection(i18nString(UIStrings.preview));
            // @ts-ignore TODO(crbug.com/1011811): Remove symbol usage.
            contentHelper.appendElementRow('', event[previewElementSymbol]);
        }
        if (TraceEngine.Legacy.eventIsFromNewEngine(event) && traceParseData) {
            const stackTrace = TraceEngine.Helpers.Trace.stackTraceForEvent(event);
            if (initiator || initiatorFor || stackTrace || traceParseData?.Invalidations.invalidationsForEvent.get(event)) {
                await TimelineUIUtils.generateCauses(event, contentHelper, traceParseData);
            }
        }
        const stats = {};
        const showPieChart = detailed && traceParseData && TimelineUIUtils.aggregatedStatsForTraceEvent(stats, traceParseData, event);
        if (showPieChart) {
            contentHelper.addSection(i18nString(UIStrings.aggregatedTime));
            const pieChart = TimelineUIUtils.generatePieChart(stats, TimelineUIUtils.eventStyle(event).category, selfTime);
            contentHelper.appendElementRow('', pieChart);
        }
        return contentHelper.fragment;
    }
    static statsForTimeRange(events, startTime, endTime) {
        if (!events.length) {
            return { 'idle': endTime - startTime };
        }
        buildRangeStatsCacheIfNeeded(events);
        const aggregatedStats = subtractStats(aggregatedStatsAtTime(endTime), aggregatedStatsAtTime(startTime));
        const aggregatedTotal = Object.values(aggregatedStats).reduce((a, b) => a + b, 0);
        aggregatedStats['idle'] = Math.max(0, endTime - startTime - aggregatedTotal);
        return aggregatedStats;
        function aggregatedStatsAtTime(time) {
            const stats = {};
            // @ts-ignore TODO(crbug.com/1011811): Remove symbol usage.
            const cache = events[categoryBreakdownCacheSymbol];
            for (const category in cache) {
                const categoryCache = cache[category];
                const index = Platform.ArrayUtilities.upperBound(categoryCache.time, time, Platform.ArrayUtilities.DEFAULT_COMPARATOR);
                let value;
                if (index === 0) {
                    value = 0;
                }
                else if (index === categoryCache.time.length) {
                    value = categoryCache.value[categoryCache.value.length - 1];
                }
                else {
                    const t0 = categoryCache.time[index - 1];
                    const t1 = categoryCache.time[index];
                    const v0 = categoryCache.value[index - 1];
                    const v1 = categoryCache.value[index];
                    value = v0 + (v1 - v0) * (time - t0) / (t1 - t0);
                }
                stats[category] = value;
            }
            return stats;
        }
        function subtractStats(a, b) {
            const result = Object.assign({}, a);
            for (const key in b) {
                result[key] -= b[key];
            }
            return result;
        }
        function buildRangeStatsCacheIfNeeded(events) {
            // @ts-ignore TODO(crbug.com/1011811): Remove symbol usage.
            if (events[categoryBreakdownCacheSymbol]) {
                return;
            }
            // aggeregatedStats is a map by categories. For each category there's an array
            // containing sorted time points which records accumulated value of the category.
            const aggregatedStats = {};
            const categoryStack = [];
            let lastTime = 0;
            TimelineModel.TimelineModel.TimelineModelImpl.forEachEvent(events, onStartEvent, onEndEvent);
            function updateCategory(category, time) {
                let statsArrays = aggregatedStats[category];
                if (!statsArrays) {
                    statsArrays = { time: [], value: [] };
                    aggregatedStats[category] = statsArrays;
                }
                if (statsArrays.time.length && statsArrays.time[statsArrays.time.length - 1] === time || lastTime > time) {
                    return;
                }
                const lastValue = statsArrays.value.length > 0 ? statsArrays.value[statsArrays.value.length - 1] : 0;
                statsArrays.value.push(lastValue + time - lastTime);
                statsArrays.time.push(time);
            }
            function categoryChange(from, to, time) {
                if (from) {
                    updateCategory(from, time);
                }
                lastTime = time;
                if (to) {
                    updateCategory(to, time);
                }
            }
            function onStartEvent(e) {
                const { startTime } = TraceEngine.Legacy.timesForEventInMilliseconds(e);
                const category = getEventStyle(e.name)?.category.name ||
                    getCategoryStyles().Other.name;
                const parentCategory = categoryStack.length ? categoryStack[categoryStack.length - 1] : null;
                if (category !== parentCategory) {
                    categoryChange(parentCategory || null, category, startTime);
                }
                categoryStack.push(category);
            }
            function onEndEvent(e) {
                const { endTime } = TraceEngine.Legacy.timesForEventInMilliseconds(e);
                const category = categoryStack.pop();
                const parentCategory = categoryStack.length ? categoryStack[categoryStack.length - 1] : null;
                if (category !== parentCategory) {
                    categoryChange(category || null, parentCategory || null, endTime || 0);
                }
            }
            const obj = events;
            // @ts-ignore TODO(crbug.com/1011811): Remove symbol usage.
            obj[categoryBreakdownCacheSymbol] = aggregatedStats;
        }
    }
    static async buildSyntheticNetworkRequestDetails(event, model, linkifier) {
        const maybeTarget = model.targetByEvent(event);
        const contentHelper = new TimelineDetailsContentHelper(maybeTarget, linkifier);
        const category = TimelineUIUtils.syntheticNetworkRequestCategory(event);
        const color = TimelineUIUtils.networkCategoryColor(category);
        contentHelper.addSection(i18nString(UIStrings.networkRequest), color);
        const options = {
            tabStop: true,
            showColumnNumber: false,
            inlineFrameIndex: 0,
        };
        contentHelper.appendElementRow(i18n.i18n.lockedString('URL'), LegacyComponents.Linkifier.Linkifier.linkifyURL(event.args.data.url, options));
        // The time from queueing the request until resource processing is finished.
        const fullDuration = event.dur;
        if (isFinite(fullDuration)) {
            let textRow = TraceEngine.Helpers.Timing.formatMicrosecondsTime(fullDuration);
            // The time from queueing the request until the download is finished. This
            // corresponds to the total time reported for the request in the network tab.
            const networkDuration = event.args.data.syntheticData.finishTime - event.ts;
            // The time it takes to make the resource available to the renderer process.
            const processingDuration = event.ts + event.dur - event.args.data.syntheticData.finishTime;
            if (isFinite(networkDuration) && isFinite(processingDuration)) {
                const networkDurationStr = TraceEngine.Helpers.Timing.formatMicrosecondsTime(networkDuration);
                const processingDurationStr = TraceEngine.Helpers.Timing.formatMicrosecondsTime(processingDuration);
                const cached = event.args.data.syntheticData.isMemoryCached || event.args.data.syntheticData.isDiskCached;
                const cacheOrNetworkLabel = cached ? i18nString(UIStrings.loadFromCache) : i18nString(UIStrings.networkTransfer);
                textRow += i18nString(UIStrings.SSSResourceLoading, { PH1: networkDurationStr, PH2: cacheOrNetworkLabel, PH3: processingDurationStr });
            }
            contentHelper.appendTextRow(i18nString(UIStrings.duration), textRow);
        }
        if (event.args.data.requestMethod) {
            contentHelper.appendTextRow(i18nString(UIStrings.requestMethod), event.args.data.requestMethod);
        }
        if (event.args.data.initialPriority) {
            const initialPriority = PerfUI.NetworkPriorities.uiLabelForNetworkPriority(event.args.data.initialPriority);
            contentHelper.appendTextRow(i18nString(UIStrings.initialPriority), initialPriority);
        }
        const priority = PerfUI.NetworkPriorities.uiLabelForNetworkPriority(event.args.data.priority);
        contentHelper.appendTextRow(i18nString(UIStrings.priority), priority);
        if (event.args.data.mimeType) {
            contentHelper.appendTextRow(i18nString(UIStrings.mimeType), event.args.data.mimeType);
        }
        let lengthText = '';
        if (event.args.data.syntheticData.isMemoryCached) {
            lengthText += i18nString(UIStrings.FromMemoryCache);
        }
        else if (event.args.data.syntheticData.isDiskCached) {
            lengthText += i18nString(UIStrings.FromCache);
        }
        else if (event.args.data.timing?.pushStart) {
            lengthText += i18nString(UIStrings.FromPush);
        }
        if (event.args.data.fromServiceWorker) {
            lengthText += i18nString(UIStrings.FromServiceWorker);
        }
        if (event.args.data.encodedDataLength || !lengthText) {
            lengthText = `${Platform.NumberUtilities.bytesToString(event.args.data.encodedDataLength)}${lengthText}`;
        }
        contentHelper.appendTextRow(i18nString(UIStrings.encodedData), lengthText);
        if (event.args.data.decodedBodyLength) {
            contentHelper.appendTextRow(i18nString(UIStrings.decodedBody), Platform.NumberUtilities.bytesToString(event.args.data.decodedBodyLength));
        }
        const title = i18nString(UIStrings.initiatedBy);
        const topFrame = TimelineModel.TimelineModel.EventOnTimelineData.forEvent(event).topFrame();
        if (topFrame) {
            const link = linkifier.maybeLinkifyConsoleCallFrame(maybeTarget, topFrame, { tabStop: true, inlineFrameIndex: 0, showColumnNumber: true });
            if (link) {
                contentHelper.appendElementRow(title, link);
            }
        }
        if (!requestPreviewElements.get(event) && event.args.data.url && maybeTarget) {
            const previewElement = await LegacyComponents.ImagePreview.ImagePreview.build(maybeTarget, event.args.data.url, false, {
                imageAltText: LegacyComponents.ImagePreview.ImagePreview.defaultAltTextForImageURL(event.args.data.url),
                precomputedFeatures: undefined,
            });
            requestPreviewElements.set(event, previewElement);
        }
        const requestPreviewElement = requestPreviewElements.get(event);
        if (requestPreviewElement) {
            contentHelper.appendElementRow(i18nString(UIStrings.preview), requestPreviewElement);
        }
        return contentHelper.fragment;
    }
    static stackTraceFromCallFrames(callFrames) {
        return { callFrames: callFrames };
    }
    static async generateCauses(event, contentHelper, traceParseData) {
        const { startTime } = TraceEngine.Legacy.timesForEventInMilliseconds(event);
        let initiatorStackLabel = i18nString(UIStrings.initiatorStackTrace);
        let stackLabel = i18nString(UIStrings.stackTrace);
        switch (event.name) {
            case "TimerFire" /* TraceEngine.Types.TraceEvents.KnownEventName.TimerFire */:
                initiatorStackLabel = i18nString(UIStrings.timerInstalled);
                break;
            case "FireAnimationFrame" /* TraceEngine.Types.TraceEvents.KnownEventName.FireAnimationFrame */:
                initiatorStackLabel = i18nString(UIStrings.animationFrameRequested);
                break;
            case "FireIdleCallback" /* TraceEngine.Types.TraceEvents.KnownEventName.FireIdleCallback */:
                initiatorStackLabel = i18nString(UIStrings.idleCallbackRequested);
                break;
            case "UpdateLayoutTree" /* TraceEngine.Types.TraceEvents.KnownEventName.UpdateLayoutTree */:
            case "RecalculateStyles" /* TraceEngine.Types.TraceEvents.KnownEventName.RecalculateStyles */:
                initiatorStackLabel = i18nString(UIStrings.firstInvalidated);
                stackLabel = i18nString(UIStrings.recalculationForced);
                break;
            case "Layout" /* TraceEngine.Types.TraceEvents.KnownEventName.Layout */:
                initiatorStackLabel = i18nString(UIStrings.firstLayoutInvalidation);
                stackLabel = i18nString(UIStrings.layoutForced);
                break;
        }
        const stackTrace = TraceEngine.Helpers.Trace.stackTraceForEvent(event);
        if (stackTrace && stackTrace.length) {
            contentHelper.addSection(stackLabel);
            contentHelper.createChildStackTraceElement(TimelineUIUtils.stackTraceFromCallFrames(stackTrace));
        }
        const initiator = traceParseData.Initiators.eventToInitiator.get(event);
        const initiatorFor = traceParseData.Initiators.initiatorToEvents.get(event);
        const invalidations = traceParseData.Invalidations.invalidationsForEvent.get(event);
        if (initiator) {
            // If we have an initiator for the event, we can show its stack trace, a link to reveal the initiator,
            // and the time since the initiator (Pending For).
            const stackTrace = TraceEngine.Helpers.Trace.stackTraceForEvent(initiator);
            if (stackTrace) {
                contentHelper.addSection(initiatorStackLabel);
                contentHelper.createChildStackTraceElement(TimelineUIUtils.stackTraceFromCallFrames(stackTrace.map(frame => {
                    return {
                        ...frame,
                        scriptId: String(frame.scriptId),
                    };
                })));
            }
            const link = this.createEntryLink(initiator);
            contentHelper.appendElementRow(i18nString(UIStrings.initiatedBy), link);
            const { startTime: initiatorStartTime } = TraceEngine.Legacy.timesForEventInMilliseconds(initiator);
            const delay = startTime - initiatorStartTime;
            contentHelper.appendTextRow(i18nString(UIStrings.pendingFor), i18n.TimeUtilities.preciseMillisToString(delay, 1));
        }
        if (initiatorFor) {
            // If the event is an initiator for some entries, add links to reveal them.
            const links = document.createElement('div');
            initiatorFor.map((initiator, i) => {
                links.appendChild(this.createEntryLink(initiator));
                // Add space between each link if it's not last
                if (i < initiatorFor.length - 1) {
                    links.append(' ');
                }
            });
            contentHelper.appendElementRow(UIStrings.initiatorFor, links);
        }
        if (invalidations && invalidations.length) {
            contentHelper.addSection(i18nString(UIStrings.invalidations));
            await TimelineUIUtils.generateInvalidationsList(invalidations, contentHelper);
        }
    }
    static createEntryLink(entry) {
        const link = document.createElement('span');
        const traceBoundsState = TraceBounds.TraceBounds.BoundsManager.instance().state();
        if (!traceBoundsState) {
            return link;
        }
        // Check is the entry is outside of the current breadcrumb. If it is, don't create a link to navigate to it because there is no way to navigate outside breadcrumb without removing it. Instead, just display the name and "outside breadcrumb" text
        // Consider entry outside breadcrumb only if it is fully outside. If a part of it is visible, we can still select it.
        const isEntryOutsideBreadcrumb = traceBoundsState.micro.minimapTraceBounds.min > entry.ts + (entry.dur || 0) ||
            traceBoundsState.micro.minimapTraceBounds.max < entry.ts;
        if (!isEntryOutsideBreadcrumb) {
            link.classList.add('devtools-link');
            UI.ARIAUtils.markAsLink(link);
            link.tabIndex = 0;
            link.addEventListener('click', () => {
                TimelinePanel.instance().select(TimelineSelection.fromTraceEvent((entry)));
            });
            link.addEventListener('keydown', event => {
                if (event.key === 'Enter') {
                    TimelinePanel.instance().select(TimelineSelection.fromTraceEvent((entry)));
                    event.consume(true);
                }
            });
        }
        link.textContent =
            this.eventTitle(entry) + (isEntryOutsideBreadcrumb ? ' ' + i18nString(UIStrings.outsideBreadcrumbRange) : '');
        return link;
    }
    static async generateInvalidationsList(invalidations, contentHelper) {
        const { groupedByReason, backendNodeIds } = TimelineComponents.DetailsView.generateInvalidationsList(invalidations);
        let relatedNodesMap = null;
        const target = SDK.TargetManager.TargetManager.instance().primaryPageTarget();
        const domModel = target?.model(SDK.DOMModel.DOMModel);
        if (domModel) {
            relatedNodesMap = await domModel.pushNodesByBackendIdsToFrontend(backendNodeIds);
        }
        Object.keys(groupedByReason).forEach(reason => {
            TimelineUIUtils.generateInvalidationsForReason(reason, groupedByReason[reason], relatedNodesMap, contentHelper);
        });
    }
    static generateInvalidationsForReason(reason, invalidations, relatedNodesMap, contentHelper) {
        function createLinkForInvalidationNode(invalidation) {
            const node = (invalidation.nodeId && relatedNodesMap) ? relatedNodesMap.get(invalidation.nodeId) : null;
            if (node) {
                const nodeSpan = document.createElement('span');
                void Common.Linkifier.Linkifier.linkify(node).then(link => nodeSpan.appendChild(link));
                return nodeSpan;
            }
            if (invalidation.nodeName) {
                const nodeSpan = document.createElement('span');
                nodeSpan.textContent = invalidation.nodeName;
                return nodeSpan;
            }
            const nodeSpan = document.createElement('span');
            UI.UIUtils.createTextChild(nodeSpan, i18nString(UIStrings.UnknownNode));
            return nodeSpan;
        }
        const generatedItems = new Set();
        for (const invalidation of invalidations) {
            const stackTrace = TraceEngine.Helpers.Trace.stackTraceForEvent(invalidation);
            let scriptLink = null;
            const callFrame = stackTrace?.at(0);
            if (callFrame) {
                scriptLink = contentHelper.linkifier()?.maybeLinkifyScriptLocation(SDK.TargetManager.TargetManager.instance().rootTarget(), callFrame.scriptId, callFrame.url, callFrame.lineNumber) ||
                    null;
            }
            const niceNodeLink = createLinkForInvalidationNode(invalidation);
            const text = scriptLink ?
                i18n.i18n.getFormatLocalizedString(str_, UIStrings.invalidationWithCallFrame, { PH1: niceNodeLink, PH2: scriptLink }) :
                niceNodeLink;
            // Sometimes we can get different Invalidation events which cause
            // the same text for the same element for the same reason to be
            // generated. Rather than show the user duplicates, if we have
            // generated text that looks identical to this before, we will
            // bail.
            const generatedText = (typeof text === 'string' ? text : text.innerText);
            if (generatedItems.has(generatedText)) {
                continue;
            }
            generatedItems.add(generatedText);
            contentHelper.appendElementRow(reason, text);
        }
    }
    static aggregatedStatsForTraceEvent(total, traceParseData, event) {
        const events = traceParseData.Renderer?.allTraceEntries || [];
        const { startTime, endTime } = TraceEngine.Legacy.timesForEventInMilliseconds(event);
        function eventComparator(startTime, e) {
            const { startTime: eventStartTime } = TraceEngine.Legacy.timesForEventInMilliseconds(e);
            return startTime - eventStartTime;
        }
        const index = Platform.ArrayUtilities.binaryIndexOf(events, startTime, eventComparator);
        // Not a main thread event?
        if (index < 0) {
            return false;
        }
        let hasChildren = false;
        if (endTime) {
            for (let i = index; i < events.length; i++) {
                const nextEvent = events[i];
                const { startTime: nextEventStartTime, selfTime: nextEventSelfTime } = TraceEngine.Legacy.timesForEventInMilliseconds(nextEvent);
                if (nextEventStartTime >= endTime) {
                    break;
                }
                if (!nextEvent.selfTime) {
                    continue;
                }
                if (TraceEngine.Legacy.threadIDForEvent(nextEvent) !== TraceEngine.Legacy.threadIDForEvent(event)) {
                    continue;
                }
                if (i > index) {
                    hasChildren = true;
                }
                const categoryName = TimelineUIUtils.eventStyle(nextEvent).category.name;
                total[categoryName] = (total[categoryName] || 0) + nextEventSelfTime;
            }
        }
        if (TraceEngine.Types.TraceEvents.isAsyncPhase(TraceEngine.Legacy.phaseForEvent(event))) {
            if (endTime) {
                let aggregatedTotal = 0;
                for (const categoryName in total) {
                    aggregatedTotal += total[categoryName];
                }
                total['idle'] = Math.max(0, endTime - startTime - aggregatedTotal);
            }
            return false;
        }
        return hasChildren;
    }
    static async buildPicturePreviewContent(traceData, event, target) {
        const snapshotEvent = traceData.LayerTree.paintsToSnapshots.get(event);
        if (!snapshotEvent) {
            return null;
        }
        const paintProfilerModel = target.model(SDK.PaintProfiler.PaintProfilerModel);
        if (!paintProfilerModel) {
            return null;
        }
        const snapshot = await paintProfilerModel.loadSnapshot(snapshotEvent.args.snapshot.skp64);
        if (!snapshot) {
            return null;
        }
        const snapshotWithRect = {
            snapshot,
            rect: snapshotEvent.args.snapshot.params?.layer_rect,
        };
        if (!snapshotWithRect) {
            return null;
        }
        const imageURLPromise = snapshotWithRect.snapshot.replay();
        snapshotWithRect.snapshot.release();
        const imageURL = await imageURLPromise;
        if (!imageURL) {
            return null;
        }
        const stylesContainer = document.createElement('div');
        const shadowRoot = stylesContainer.attachShadow({ mode: 'open' });
        shadowRoot.adoptedStyleSheets = [imagePreviewStyles];
        const container = shadowRoot.createChild('div');
        container.classList.add('image-preview-container', 'vbox', 'link');
        const img = container.createChild('img');
        img.src = imageURL;
        img.alt = LegacyComponents.ImagePreview.ImagePreview.defaultAltTextForImageURL(imageURL);
        const paintProfilerButton = container.createChild('a');
        paintProfilerButton.textContent = i18nString(UIStrings.paintProfiler);
        UI.ARIAUtils.markAsLink(container);
        container.tabIndex = 0;
        container.addEventListener('click', () => TimelinePanel.instance().select(TimelineSelection.fromTraceEvent(event)), false);
        container.addEventListener('keydown', keyEvent => {
            if (keyEvent.key === 'Enter') {
                TimelinePanel.instance().select(TimelineSelection.fromTraceEvent(event));
                keyEvent.consume(true);
            }
        });
        return stylesContainer;
    }
    static createEventDivider(event, zeroTime) {
        const eventDivider = document.createElement('div');
        eventDivider.classList.add('resources-event-divider');
        const { startTime: eventStartTime } = TraceEngine.Legacy.timesForEventInMilliseconds(event);
        const startTime = i18n.TimeUtilities.millisToString(eventStartTime - zeroTime);
        UI.Tooltip.Tooltip.install(eventDivider, i18nString(UIStrings.sAtS, { PH1: TimelineUIUtils.eventTitle(event), PH2: startTime }));
        const style = TimelineUIUtils.markerStyleForEvent(event);
        if (style.tall) {
            eventDivider.style.backgroundColor = style.color;
        }
        return eventDivider;
    }
    static visibleTypes() {
        const eventStyles = TimelineUIUtils.initEventStyles();
        const result = [];
        for (const name in eventStyles) {
            if (!eventStyles[name].hidden) {
                result.push(name);
            }
        }
        return result;
    }
    static visibleEventsFilter() {
        return new TimelineModel.TimelineModelFilter.TimelineVisibleEventsFilter(TimelineUIUtils.visibleTypes());
    }
    static categories() {
        if (categories) {
            return categories;
        }
        categories = {
            loading: new TimelineCategory('loading', i18nString(UIStrings.loading), true, '--app-color-loading-children', '--app-color-loading'),
            experience: new TimelineCategory('experience', i18nString(UIStrings.experience), false, '--app-color-rendering-children', '--app-color-rendering'),
            scripting: new TimelineCategory('scripting', i18nString(UIStrings.scripting), true, '--app-color-scripting-children', '--app-color-scripting'),
            rendering: new TimelineCategory('rendering', i18nString(UIStrings.rendering), true, '--app-color-rendering-children', '--app-color-rendering'),
            painting: new TimelineCategory('painting', i18nString(UIStrings.painting), true, '--app-color-painting-children', '--app-color-painting'),
            gpu: new TimelineCategory('gpu', i18nString(UIStrings.gpu), false, '--app-color-painting-children', '--app-color-painting'),
            async: new TimelineCategory('async', i18nString(UIStrings.async), false, '--app-color-async-children', '--app-color-async'),
            other: new TimelineCategory('other', i18nString(UIStrings.system), false, '--app-color-system-children', '--app-color-system'),
            idle: new TimelineCategory('idle', i18nString(UIStrings.idle), false, '--app-color-idle-children', '--app-color-idle'),
        };
        return categories;
    }
    static setCategories(cats) {
        categories = cats;
    }
    static getTimelineMainEventCategories() {
        if (eventCategories) {
            return eventCategories;
        }
        eventCategories = ['idle', 'loading', 'painting', 'rendering', 'scripting', 'other'];
        return eventCategories;
    }
    static setTimelineMainEventCategories(categories) {
        eventCategories = categories;
    }
    static generatePieChart(aggregatedStats, selfCategory, selfTime) {
        let total = 0;
        for (const categoryName in aggregatedStats) {
            total += aggregatedStats[categoryName];
        }
        const element = document.createElement('div');
        element.classList.add('timeline-details-view-pie-chart-wrapper');
        element.classList.add('hbox');
        const pieChart = new PerfUI.PieChart.PieChart();
        const slices = [];
        function appendLegendRow(name, title, value, color) {
            if (!value) {
                return;
            }
            slices.push({ value, color, title });
        }
        // In case of self time, first add self, then children of the same category.
        if (selfCategory) {
            if (selfTime) {
                appendLegendRow(selfCategory.name, i18nString(UIStrings.sSelf, { PH1: selfCategory.title }), selfTime, selfCategory.getCSSValue());
            }
            // Children of the same category.
            const categoryTime = aggregatedStats[selfCategory.name];
            const value = categoryTime - (selfTime || 0);
            if (value > 0) {
                appendLegendRow(selfCategory.name, i18nString(UIStrings.sChildren, { PH1: selfCategory.title }), value, selfCategory.getCSSValue());
            }
        }
        // Add other categories.
        for (const categoryName in TimelineUIUtils.categories()) {
            const category = TimelineUIUtils.categories()[categoryName];
            if (categoryName === selfCategory?.name) {
                // Do not add an entry for this event's self category because 2
                // entries for it where added just before this for loop (for
                // self and children times).
                continue;
            }
            appendLegendRow(category.name, category.title, aggregatedStats[category.name], category.getCSSValue());
        }
        pieChart.data = {
            chartName: i18nString(UIStrings.timeSpentInRendering),
            size: 110,
            formatter: (value) => i18n.TimeUtilities.preciseMillisToString(value),
            showLegend: true,
            total,
            slices,
        };
        const pieChartContainer = element.createChild('div', 'vbox');
        pieChartContainer.appendChild(pieChart);
        return element;
    }
    static generateDetailsContentForFrame(frame, filmStrip, filmStripFrame) {
        const contentHelper = new TimelineDetailsContentHelper(null, null);
        contentHelper.addSection(i18nString(UIStrings.frame));
        const duration = TimelineUIUtils.frameDuration(frame);
        contentHelper.appendElementRow(i18nString(UIStrings.duration), duration);
        if (filmStrip && filmStripFrame) {
            const filmStripPreview = document.createElement('div');
            filmStripPreview.classList.add('timeline-filmstrip-preview');
            void UI.UIUtils.loadImage(filmStripFrame.screenshotEvent.args.dataUri)
                .then(image => image && filmStripPreview.appendChild(image));
            contentHelper.appendElementRow('', filmStripPreview);
            filmStripPreview.addEventListener('click', frameClicked.bind(null, filmStrip, filmStripFrame), false);
        }
        function frameClicked(filmStrip, filmStripFrame) {
            PerfUI.FilmStripView.Dialog.fromFilmStrip(filmStrip, filmStripFrame.index);
        }
        return contentHelper.fragment;
    }
    static frameDuration(frame) {
        const offsetMilli = TraceEngine.Helpers.Timing.microSecondsToMilliseconds(frame.startTimeOffset);
        const durationMilli = TraceEngine.Helpers.Timing.microSecondsToMilliseconds(TraceEngine.Types.Timing.MicroSeconds(frame.endTime - frame.startTime));
        const durationText = i18nString(UIStrings.sAtSParentheses, {
            PH1: i18n.TimeUtilities.millisToString(durationMilli, true),
            PH2: i18n.TimeUtilities.millisToString(offsetMilli, true),
        });
        return i18n.i18n.getFormatLocalizedString(str_, UIStrings.emptyPlaceholder, { PH1: durationText });
    }
    static quadWidth(quad) {
        return Math.round(Math.sqrt(Math.pow(quad[0] - quad[2], 2) + Math.pow(quad[1] - quad[3], 2)));
    }
    static quadHeight(quad) {
        return Math.round(Math.sqrt(Math.pow(quad[0] - quad[6], 2) + Math.pow(quad[1] - quad[7], 2)));
    }
    static eventDispatchDesciptors() {
        if (eventDispatchDesciptors) {
            return eventDispatchDesciptors;
        }
        const lightOrange = 'hsl(40,100%,80%)';
        const orange = 'hsl(40,100%,50%)';
        const green = 'hsl(90,100%,40%)';
        const purple = 'hsl(256,100%,75%)';
        eventDispatchDesciptors = [
            new EventDispatchTypeDescriptor(1, lightOrange, ['mousemove', 'mouseenter', 'mouseleave', 'mouseout', 'mouseover']),
            new EventDispatchTypeDescriptor(1, lightOrange, ['pointerover', 'pointerout', 'pointerenter', 'pointerleave', 'pointermove']),
            new EventDispatchTypeDescriptor(2, green, ['wheel']),
            new EventDispatchTypeDescriptor(3, orange, ['click', 'mousedown', 'mouseup']),
            new EventDispatchTypeDescriptor(3, orange, ['touchstart', 'touchend', 'touchmove', 'touchcancel']),
            new EventDispatchTypeDescriptor(3, orange, ['pointerdown', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture']),
            new EventDispatchTypeDescriptor(3, purple, ['keydown', 'keyup', 'keypress']),
        ];
        return eventDispatchDesciptors;
    }
    static markerShortTitle(event) {
        const recordTypes = TimelineModel.TimelineModel.RecordType;
        switch (event.name) {
            case recordTypes.MarkDOMContent:
                return i18n.i18n.lockedString('DCL');
            case recordTypes.MarkLoad:
                return i18n.i18n.lockedString('L');
            case recordTypes.MarkFirstPaint:
                return i18n.i18n.lockedString('FP');
            case recordTypes.MarkFCP:
                return i18n.i18n.lockedString('FCP');
            case recordTypes.MarkLCPCandidate:
                return i18n.i18n.lockedString('LCP');
        }
        return null;
    }
    static markerStyleForEvent(event) {
        const tallMarkerDashStyle = [6, 4];
        const title = TimelineUIUtils.eventTitle(event);
        const recordTypes = TimelineModel.TimelineModel.RecordType;
        if (event.name !== recordTypes.NavigationStart &&
            (TraceEngine.Legacy.eventHasCategory(event, TimelineModel.TimelineModel.TimelineModelImpl.Category.Console) ||
                TraceEngine.Legacy.eventHasCategory(event, TimelineModel.TimelineModel.TimelineModelImpl.Category.UserTiming))) {
            return {
                title: title,
                dashStyle: tallMarkerDashStyle,
                lineWidth: 0.5,
                color: TraceEngine.Legacy.eventHasCategory(event, TimelineModel.TimelineModel.TimelineModelImpl.Category.UserTiming) ?
                    'purple' :
                    'orange',
                tall: false,
                lowPriority: false,
            };
        }
        let tall = false;
        let color = 'grey';
        switch (event.name) {
            case recordTypes.NavigationStart:
                color = '#FF9800';
                tall = true;
                break;
            case recordTypes.FrameStartedLoading:
                color = 'green';
                tall = true;
                break;
            case recordTypes.MarkDOMContent:
                color = '#0867CB';
                tall = true;
                break;
            case recordTypes.MarkLoad:
                color = '#B31412';
                tall = true;
                break;
            case recordTypes.MarkFirstPaint:
                color = '#228847';
                tall = true;
                break;
            case recordTypes.MarkFCP:
                color = '#1A6937';
                tall = true;
                break;
            case recordTypes.MarkLCPCandidate:
                color = '#1A3422';
                tall = true;
                break;
            case recordTypes.TimeStamp:
                color = 'orange';
                break;
        }
        return {
            title: title,
            dashStyle: tallMarkerDashStyle,
            lineWidth: 0.5,
            color: color,
            tall: tall,
            lowPriority: false,
        };
    }
    static colorForId(id) {
        if (!colorGenerator) {
            colorGenerator =
                new Common.Color.Generator({ min: 30, max: 330, count: undefined }, { min: 50, max: 80, count: 3 }, 85);
            colorGenerator.setColorForID('', '#f2ecdc');
        }
        return colorGenerator.colorForID(id);
    }
    static displayNameForFrame(frame, trimAt = 30) {
        const url = frame.url;
        if (!trimAt) {
            trimAt = 30;
        }
        return Common.ParsedURL.schemeIs(url, 'about:') ? `"${Platform.StringUtilities.trimMiddle(frame.name, trimAt)}"` :
            frame.url.trimEnd(trimAt);
    }
}
export const aggregatedStatsKey = Symbol('aggregatedStats');
export const previewElementSymbol = Symbol('previewElement');
export class EventDispatchTypeDescriptor {
    priority;
    color;
    eventTypes;
    constructor(priority, color, eventTypes) {
        this.priority = priority;
        this.color = color;
        this.eventTypes = eventTypes;
    }
}
export class TimelineDetailsContentHelper {
    fragment;
    linkifierInternal;
    target;
    element;
    tableElement;
    constructor(target, linkifier) {
        this.fragment = document.createDocumentFragment();
        this.linkifierInternal = linkifier;
        this.target = target;
        this.element = document.createElement('div');
        this.element.classList.add('timeline-details-view-block');
        this.tableElement = this.element.createChild('div', 'vbox timeline-details-chip-body');
        this.fragment.appendChild(this.element);
    }
    addSection(title, swatchColor) {
        if (!this.tableElement.hasChildNodes()) {
            this.element.removeChildren();
        }
        else {
            this.element = document.createElement('div');
            this.element.classList.add('timeline-details-view-block');
            this.fragment.appendChild(this.element);
        }
        if (title) {
            const titleElement = this.element.createChild('div', 'timeline-details-chip-title');
            if (swatchColor) {
                titleElement.createChild('div').style.backgroundColor = swatchColor;
            }
            UI.UIUtils.createTextChild(titleElement, title);
        }
        this.tableElement = this.element.createChild('div', 'vbox timeline-details-chip-body');
        this.fragment.appendChild(this.element);
    }
    linkifier() {
        return this.linkifierInternal;
    }
    appendTextRow(title, value) {
        const rowElement = this.tableElement.createChild('div', 'timeline-details-view-row');
        rowElement.createChild('div', 'timeline-details-view-row-title').textContent = title;
        rowElement.createChild('div', 'timeline-details-view-row-value').textContent = value.toString();
    }
    appendElementRow(title, content, isWarning, isStacked) {
        const rowElement = this.tableElement.createChild('div', 'timeline-details-view-row');
        rowElement.setAttribute('data-row-title', title);
        if (isWarning) {
            rowElement.classList.add('timeline-details-warning');
        }
        if (isStacked) {
            rowElement.classList.add('timeline-details-stack-values');
        }
        const titleElement = rowElement.createChild('div', 'timeline-details-view-row-title');
        titleElement.textContent = title;
        const valueElement = rowElement.createChild('div', 'timeline-details-view-row-value');
        if (content instanceof Node) {
            valueElement.appendChild(content);
        }
        else {
            UI.UIUtils.createTextChild(valueElement, content || '');
        }
    }
    appendLocationRow(title, url, startLine, startColumn) {
        if (!this.linkifierInternal) {
            return;
        }
        const options = {
            tabStop: true,
            columnNumber: startColumn,
            showColumnNumber: true,
            inlineFrameIndex: 0,
        };
        const link = this.linkifierInternal.maybeLinkifyScriptLocation(this.target, null, url, startLine, options);
        if (!link) {
            return;
        }
        this.appendElementRow(title, link);
    }
    appendLocationRange(title, url, startLine, endLine) {
        if (!this.linkifierInternal || !this.target) {
            return;
        }
        const locationContent = document.createElement('span');
        const link = this.linkifierInternal.maybeLinkifyScriptLocation(this.target, null, url, startLine, { tabStop: true, inlineFrameIndex: 0 });
        if (!link) {
            return;
        }
        locationContent.appendChild(link);
        UI.UIUtils.createTextChild(locationContent, Platform.StringUtilities.sprintf(' [%s…%s]', startLine + 1, (endLine || 0) + 1 || ''));
        this.appendElementRow(title, locationContent);
    }
    createChildStackTraceElement(stackTrace) {
        if (!this.linkifierInternal) {
            return;
        }
        const stackTraceElement = this.tableElement.createChild('div', 'timeline-details-view-row timeline-details-stack-values');
        const callFrameContents = LegacyComponents.JSPresentationUtils.buildStackTracePreviewContents(this.target, this.linkifierInternal, { stackTrace, tabStops: true });
        stackTraceElement.appendChild(callFrameContents.element);
    }
}
export const categoryBreakdownCacheSymbol = Symbol('categoryBreakdownCache');
/**
 * Given a particular event, this method can adjust its timestamp by
 * substracting the timestamp of the previous navigation. This helps in cases
 * where the user has navigated multiple times in the trace, so that we can show
 * the LCP (for example) relative to the last navigation.
 **/
export function timeStampForEventAdjustedForClosestNavigationIfPossible(event, traceParsedData) {
    if (!traceParsedData) {
        const { startTime } = TraceEngine.Legacy.timesForEventInMilliseconds(event);
        return startTime;
    }
    const time = TraceEngine.Helpers.Timing.timeStampForEventAdjustedByClosestNavigation(event, traceParsedData.Meta.traceBounds, traceParsedData.Meta.navigationsByNavigationId, traceParsedData.Meta.navigationsByFrameId);
    return TraceEngine.Helpers.Timing.microSecondsToMilliseconds(time);
}
//# sourceMappingURL=TimelineUIUtils.js.map