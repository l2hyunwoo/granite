// Copyright 2023 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
import { assertNotNullOrUndefined } from '../../core/platform/platform.js';
import { VisualElements } from './LoggingConfig.js';
import { getLoggingState } from './LoggingState.js';
let veDebuggingEnabled = false;
let debugPopover = null;
const nonDomDebugElements = new WeakMap();
function setVeDebuggingEnabled(enabled) {
    veDebuggingEnabled = enabled;
    if (enabled && !debugPopover) {
        debugPopover = document.createElement('div');
        debugPopover.classList.add('ve-debug');
        debugPopover.style.position = 'absolute';
        debugPopover.style.bottom = '100px';
        debugPopover.style.left = '100px';
        debugPopover.style.background = 'black';
        debugPopover.style.color = 'white';
        debugPopover.style.zIndex = '100000';
        document.body.appendChild(debugPopover);
    }
}
// @ts-ignore
globalThis.setVeDebuggingEnabled = setVeDebuggingEnabled;
export function processForDebugging(loggable) {
    const loggingState = getLoggingState(loggable);
    if (!veDebuggingEnabled || !loggingState || loggingState.processedForDebugging) {
        return;
    }
    if (loggable instanceof Element) {
        processElementForDebugging(loggable, loggingState);
    }
    else {
        processNonDomLoggableForDebugging(loggable, loggingState);
    }
}
function showDebugPopover(content) {
    if (!debugPopover) {
        return;
    }
    debugPopover.style.display = 'block';
    debugPopover.innerHTML = content;
}
function processElementForDebugging(element, loggingState) {
    if (element.tagName === 'OPTION') {
        if (loggingState.parent?.selectOpen && debugPopover) {
            debugPopover.innerHTML += '<br>' + debugString(loggingState.config);
            loggingState.processedForDebugging = true;
        }
    }
    else {
        element.style.outline = 'solid 1px red';
        element.addEventListener('mouseenter', () => {
            assertNotNullOrUndefined(debugPopover);
            const pathToRoot = [loggingState];
            let ancestor = loggingState.parent;
            while (ancestor) {
                pathToRoot.push(ancestor);
                ancestor = ancestor.parent;
            }
            showDebugPopover(pathToRoot.map(s => debugString(s.config)).join('<br>'));
        }, { capture: true });
        element.addEventListener('mouseleave', () => {
            assertNotNullOrUndefined(debugPopover);
            debugPopover.style.display = 'none';
        }, { capture: true });
        loggingState.processedForDebugging = true;
    }
}
export function showDebugPopoverForEvent(name, config, context) {
    if (!veDebuggingEnabled) {
        return;
    }
    showDebugPopover(`${name}: ${config ? debugString(config) : ''}; ${context ? 'context: ' + context : ''}`);
}
function processNonDomLoggableForDebugging(loggable, loggingState) {
    let debugElement = nonDomDebugElements.get(loggable);
    if (!debugElement) {
        debugElement = document.createElement('div');
        debugElement.classList.add('ve-debug');
        debugElement.style.background = 'black';
        debugElement.style.color = 'white';
        debugElement.style.zIndex = '100000';
        debugElement.textContent = debugString(loggingState.config);
        nonDomDebugElements.set(loggable, debugElement);
        setTimeout(() => {
            if (!loggingState.size?.width || !loggingState.size?.height) {
                debugElement?.parentElement?.removeChild(debugElement);
                nonDomDebugElements.delete(loggable);
            }
        }, 10000);
    }
    const parentDebugElement = parent instanceof HTMLElement ? parent : nonDomDebugElements.get(parent) || debugPopover;
    assertNotNullOrUndefined(parentDebugElement);
    if (!parentDebugElement.classList.contains('ve-debug')) {
        debugElement.style.position = 'absolute';
        parentDebugElement.insertBefore(debugElement, parentDebugElement.firstChild);
    }
    else {
        debugElement.style.marginLeft = '10px';
        parentDebugElement.appendChild(debugElement);
    }
}
export function debugString(config) {
    const components = [VisualElements[config.ve]];
    if (config.context) {
        components.push(`context: ${config.context}`);
    }
    if (config.parent) {
        components.push(`parent: ${config.parent}`);
    }
    if (config.track?.size) {
        components.push(`track: ${[...config.track?.entries()].map(([key, value]) => `${key}${value ? `: ${value}` : ''}`).join(', ')}`);
    }
    return components.join('; ');
}
//# sourceMappingURL=Debugging.js.map