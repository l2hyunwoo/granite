// Copyright 2016 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
import * as Common from '../../core/common/common.js';
import * as Host from '../../core/host/host.js';
import * as i18n from '../../core/i18n/i18n.js';
import * as Platform from '../../core/platform/platform.js';
import * as Root from '../../core/root/root.js';
import * as SDK from '../../core/sdk/sdk.js';
import * as CPUProfile from '../../models/cpu_profile/cpu_profile.js';
import * as PerfUI from '../../ui/legacy/components/perf_ui/perf_ui.js';
import * as Components from '../../ui/legacy/components/utils/utils.js';
import * as UI from '../../ui/legacy/legacy.js';
import { ProfileFlameChartDataProvider } from './CPUProfileFlameChart.js';
import { HeapTimelineOverview } from './HeapTimelineOverview.js';
import { ProfileType } from './ProfileHeader.js';
import { ProfileView, WritableProfileHeader } from './ProfileView.js';
const UIStrings = {
    /**
     *@description The reported total size used in the selected time frame of the allocation sampling profile
     *@example {3 MB} PH1
     */
    selectedSizeS: 'Selected size: {PH1}',
    /**
     *@description Name of column header that reports the size (in terms of bytes) used for a particular part of the heap, excluding the size of the children nodes of this part of the heap
     */
    selfSizeBytes: 'Self Size (bytes)',
    /**
     *@description Name of column header that reports the total size (in terms of bytes) used for a particular part of the heap
     */
    totalSizeBytes: 'Total Size (bytes)',
    /**
     *@description Button text to stop profiling the heap
     */
    stopHeapProfiling: 'Stop heap profiling',
    /**
     *@description Button text to start profiling the heap
     */
    startHeapProfiling: 'Start heap profiling',
    /**
     *@description Progress update that the profiler is recording the contents of the heap
     */
    recording: 'Recording…',
    /**
     *@description Icon title in Heap Profile View of a profiler tool
     */
    heapProfilerIsRecording: 'Heap profiler is recording',
    /**
     *@description Progress update that the profiler is in the process of stopping its recording of the heap
     */
    stopping: 'Stopping…',
    /**
     *@description Sampling category to only profile allocations happening on the heap
     */
    allocationSampling: 'Allocation sampling',
    /**
     *@description The title for the collection of profiles that are gathered from various snapshots of the heap, using a sampling (e.g. every 1/100) technique.
     */
    samplingProfiles: 'SAMPLING PROFILES',
    /**
     *@description Description (part 1) in Heap Profile View of a profiler tool
     */
    recordMemoryAllocations: 'Record memory allocations using sampling method.',
    /**
     *@description Description (part 2) in Heap Profile View of a profiler tool
     */
    thisProfileTypeHasMinimal: 'This profile type has minimal performance overhead and can be used for long running operations.',
    /**
     *@description Description (part 3) in Heap Profile View of a profiler tool
     */
    itProvidesGoodApproximation: 'It provides good approximation of allocations broken down by `JavaScript` execution stack.',
    /**
     *@description Name of a profile
     *@example {2} PH1
     */
    profileD: 'Profile {PH1}',
    /**
     *@description Accessible text for the value in bytes in memory allocation or coverage view.
     *@example {12345} PH1
     */
    sBytes: '{PH1} bytes',
    /**
     *@description Text in CPUProfile View of a profiler tool
     *@example {21.33} PH1
     */
    formatPercent: '{PH1} %',
    /**
     *@description The formatted size in kilobytes, abbreviated to kB
     *@example {1,021} PH1
     */
    skb: '{PH1} kB',
    /**
     *@description Text for the name of something
     */
    name: 'Name',
    /**
     *@description Tooltip of a cell that reports the size used for a particular part of the heap, excluding the size of the children nodes of this part of the heap
     */
    selfSize: 'Self size',
    /**
     *@description Tooltip of a cell that reports the total size used for a particular part of the heap
     */
    totalSize: 'Total size',
    /**
     *@description Text for web URLs
     */
    url: 'URL',
};
const str_ = i18n.i18n.registerUIStrings('panels/profiler/HeapProfileView.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);
function convertToSamplingHeapProfile(profileHeader) {
    return (profileHeader.profile || profileHeader.protocolProfile());
}
export class HeapProfileView extends ProfileView {
    profileHeader;
    profileType;
    adjustedTotal;
    selectedSizeText;
    timestamps;
    sizes;
    max;
    ordinals;
    totalTime;
    lastOrdinal;
    timelineOverview;
    constructor(profileHeader) {
        super();
        this.profileHeader = profileHeader;
        this.profileType = profileHeader.profileType();
        this.initialize(new NodeFormatter(this));
        const profile = new SamplingHeapProfileModel(convertToSamplingHeapProfile(profileHeader));
        this.adjustedTotal = profile.total;
        this.setProfile(profile);
        this.selectedSizeText = new UI.Toolbar.ToolbarText();
        this.timestamps = [];
        this.sizes = [];
        this.max = [];
        this.ordinals = [];
        this.totalTime = 0;
        this.lastOrdinal = 0;
        this.timelineOverview = new HeapTimelineOverview();
        if (Root.Runtime.experiments.isEnabled('sampling-heap-profiler-timeline')) {
            this.timelineOverview.addEventListener("IdsRangeChanged" /* Events.IdsRangeChanged */, this.onIdsRangeChanged.bind(this));
            this.timelineOverview.show(this.element, this.element.firstChild);
            this.timelineOverview.start();
            this.profileType.addEventListener("StatsUpdate" /* SamplingHeapProfileType.Events.StatsUpdate */, this.onStatsUpdate, this);
            void this.profileType.once("profile-complete" /* ProfileEvents.ProfileComplete */).then(() => {
                this.profileType.removeEventListener("StatsUpdate" /* SamplingHeapProfileType.Events.StatsUpdate */, this.onStatsUpdate, this);
                this.timelineOverview.stop();
                this.timelineOverview.updateGrid();
            });
        }
    }
    async toolbarItems() {
        return [...await super.toolbarItems(), this.selectedSizeText];
    }
    onIdsRangeChanged(event) {
        const { minId, maxId } = event.data;
        this.selectedSizeText.setText(i18nString(UIStrings.selectedSizeS, { PH1: Platform.NumberUtilities.bytesToString(event.data.size) }));
        this.setSelectionRange(minId, maxId);
    }
    setSelectionRange(minId, maxId) {
        const profileData = convertToSamplingHeapProfile(this.profileHeader);
        const profile = new SamplingHeapProfileModel(profileData, minId, maxId);
        this.adjustedTotal = profile.total;
        this.setProfile(profile);
    }
    onStatsUpdate(event) {
        const profile = event.data;
        if (!this.totalTime) {
            this.timestamps = [];
            this.sizes = [];
            this.max = [];
            this.ordinals = [];
            this.totalTime = 30000;
            this.lastOrdinal = 0;
        }
        this.sizes.fill(0);
        this.sizes.push(0);
        this.timestamps.push(Date.now());
        this.ordinals.push(this.lastOrdinal + 1);
        for (const sample of profile?.samples ?? []) {
            this.lastOrdinal = Math.max(this.lastOrdinal, sample.ordinal);
            const bucket = Platform.ArrayUtilities.upperBound(this.ordinals, sample.ordinal, Platform.ArrayUtilities.DEFAULT_COMPARATOR) -
                1;
            this.sizes[bucket] += sample.size;
        }
        this.max.push(this.sizes[this.sizes.length - 1]);
        const lastTimestamp = this.timestamps[this.timestamps.length - 1];
        if (lastTimestamp - this.timestamps[0] > this.totalTime) {
            this.totalTime *= 2;
        }
        const samples = {
            sizes: this.sizes,
            max: this.max,
            ids: this.ordinals,
            timestamps: this.timestamps,
            totalTime: this.totalTime,
        };
        this.timelineOverview.setSamples(samples);
    }
    columnHeader(columnId) {
        switch (columnId) {
            case 'self':
                return i18nString(UIStrings.selfSizeBytes);
            case 'total':
                return i18nString(UIStrings.totalSizeBytes);
        }
        return Common.UIString.LocalizedEmptyString;
    }
    createFlameChartDataProvider() {
        return new HeapFlameChartDataProvider(this.profile(), this.profileHeader.heapProfilerModel());
    }
}
export class SamplingHeapProfileTypeBase extends Common.ObjectWrapper.eventMixin(ProfileType) {
    recording;
    clearedDuringRecording;
    constructor(typeId, description) {
        super(typeId, description);
        this.recording = false;
        this.clearedDuringRecording = false;
    }
    profileBeingRecorded() {
        return super.profileBeingRecorded();
    }
    typeName() {
        return 'Heap';
    }
    fileExtension() {
        return '.heapprofile';
    }
    get buttonTooltip() {
        return this.recording ? i18nString(UIStrings.stopHeapProfiling) : i18nString(UIStrings.startHeapProfiling);
    }
    buttonClicked() {
        if (this.recording) {
            void this.stopRecordingProfile();
        }
        else {
            this.startRecordingProfile();
        }
        return this.recording;
    }
    startRecordingProfile() {
        const heapProfilerModel = UI.Context.Context.instance().flavor(SDK.HeapProfilerModel.HeapProfilerModel);
        if (this.profileBeingRecorded() || !heapProfilerModel) {
            return;
        }
        const profileHeader = new SamplingHeapProfileHeader(heapProfilerModel, this);
        this.setProfileBeingRecorded(profileHeader);
        this.addProfile(profileHeader);
        profileHeader.updateStatus(i18nString(UIStrings.recording));
        const warnings = [i18nString(UIStrings.heapProfilerIsRecording)];
        UI.InspectorView.InspectorView.instance().setPanelWarnings('heap-profiler', warnings);
        this.recording = true;
        this.startSampling();
    }
    async stopRecordingProfile() {
        this.recording = false;
        const recordedProfile = this.profileBeingRecorded();
        if (!recordedProfile || !recordedProfile.heapProfilerModel()) {
            return;
        }
        recordedProfile.updateStatus(i18nString(UIStrings.stopping));
        const profile = await this.stopSampling();
        if (recordedProfile) {
            console.assert(profile !== undefined);
            // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            recordedProfile.setProtocolProfile(profile);
            recordedProfile.updateStatus('');
            this.setProfileBeingRecorded(null);
        }
        UI.InspectorView.InspectorView.instance().setPanelWarnings('heap-profiler', []);
        // If the data was cleared during the middle of the recording we no
        // longer treat the profile as being completed. This means we avoid
        // a change of view to the profile list.
        const wasClearedDuringRecording = this.clearedDuringRecording;
        this.clearedDuringRecording = false;
        if (wasClearedDuringRecording) {
            return;
        }
        this.dispatchEventToListeners("profile-complete" /* ProfileEvents.ProfileComplete */, recordedProfile);
    }
    createProfileLoadedFromFile(title) {
        return new SamplingHeapProfileHeader(null, this, title);
    }
    profileBeingRecordedRemoved() {
        this.clearedDuringRecording = true;
        void this.stopRecordingProfile();
    }
    startSampling() {
        throw 'Not implemented';
    }
    stopSampling() {
        throw 'Not implemented';
    }
}
let samplingHeapProfileTypeInstance;
export class SamplingHeapProfileType extends SamplingHeapProfileTypeBase {
    updateTimer;
    updateIntervalMs;
    constructor() {
        super(SamplingHeapProfileType.TypeId, i18nString(UIStrings.allocationSampling));
        if (!samplingHeapProfileTypeInstance) {
            samplingHeapProfileTypeInstance = this;
        }
        this.updateTimer = 0;
        this.updateIntervalMs = 200;
    }
    static get instance() {
        return samplingHeapProfileTypeInstance;
    }
    get treeItemTitle() {
        return i18nString(UIStrings.samplingProfiles);
    }
    get description() {
        // TODO(l10n): Do not concatenate localized strings.
        const formattedDescription = [
            i18nString(UIStrings.recordMemoryAllocations),
            i18nString(UIStrings.thisProfileTypeHasMinimal),
            i18nString(UIStrings.itProvidesGoodApproximation),
        ];
        return formattedDescription.join('\n');
    }
    hasTemporaryView() {
        return Root.Runtime.experiments.isEnabled('sampling-heap-profiler-timeline');
    }
    startSampling() {
        Host.rnPerfMetrics.heapSamplingStarted();
        const heapProfilerModel = this.obtainRecordingProfile();
        if (!heapProfilerModel) {
            Host.rnPerfMetrics.heapSamplingFinished(false);
            return;
        }
        void heapProfilerModel.startSampling().then(failed => {
            if (failed) {
                Host.rnPerfMetrics.heapSamplingFinished(false);
            }
        });
        if (Root.Runtime.experiments.isEnabled('sampling-heap-profiler-timeline')) {
            this.updateTimer = window.setTimeout(() => {
                void this.updateStats();
            }, this.updateIntervalMs);
        }
    }
    obtainRecordingProfile() {
        const recordingProfile = this.profileBeingRecorded();
        if (recordingProfile) {
            const heapProfilerModel = recordingProfile.heapProfilerModel();
            return heapProfilerModel;
        }
        return null;
    }
    async stopSampling() {
        window.clearTimeout(this.updateTimer);
        this.updateTimer = 0;
        this.dispatchEventToListeners("RecordingStopped" /* SamplingHeapProfileType.Events.RecordingStopped */);
        const heapProfilerModel = this.obtainRecordingProfile();
        if (!heapProfilerModel) {
            Host.rnPerfMetrics.heapSamplingFinished(false);
            throw new Error('No heap profiler model');
        }
        const samplingProfile = await heapProfilerModel.stopSampling();
        if (!samplingProfile) {
            Host.rnPerfMetrics.heapSamplingFinished(false);
            throw new Error('No sampling profile found');
        }
        Host.rnPerfMetrics.heapSamplingFinished(true);
        return samplingProfile;
    }
    async updateStats() {
        const heapProfilerModel = this.obtainRecordingProfile();
        if (!heapProfilerModel) {
            return;
        }
        const profile = await heapProfilerModel.getSamplingProfile();
        if (!this.updateTimer) {
            return;
        }
        this.dispatchEventToListeners("StatsUpdate" /* SamplingHeapProfileType.Events.StatsUpdate */, profile);
        this.updateTimer = window.setTimeout(() => {
            void this.updateStats();
        }, this.updateIntervalMs);
    }
    // eslint-disable-next-line @typescript-eslint/naming-convention
    static TypeId = 'SamplingHeap';
}
export class SamplingHeapProfileHeader extends WritableProfileHeader {
    heapProfilerModelInternal;
    protocolProfileInternal;
    constructor(heapProfilerModel, type, title) {
        super(heapProfilerModel && heapProfilerModel.debuggerModel(), type, title || i18nString(UIStrings.profileD, { PH1: type.nextProfileUid() }));
        this.heapProfilerModelInternal = heapProfilerModel;
        this.protocolProfileInternal = {
            head: {
                callFrame: {
                    functionName: '',
                    scriptId: '',
                    url: '',
                    lineNumber: 0,
                    columnNumber: 0,
                },
                children: [],
                selfSize: 0,
                id: 0,
            },
            samples: [],
            startTime: 0,
            endTime: 0,
            nodes: [],
        };
    }
    createView() {
        return new HeapProfileView(this);
    }
    protocolProfile() {
        return this.protocolProfileInternal;
    }
    heapProfilerModel() {
        return this.heapProfilerModelInternal;
    }
    profileType() {
        return super.profileType();
    }
}
export class SamplingHeapProfileNode extends CPUProfile.ProfileTreeModel.ProfileNode {
    self;
    constructor(node) {
        const callFrame = node.callFrame || {
            // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
            // @ts-expect-error
            functionName: node['functionName'],
            // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
            // @ts-expect-error
            scriptId: node['scriptId'],
            // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
            // @ts-expect-error
            url: node['url'],
            // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
            // @ts-expect-error
            lineNumber: node['lineNumber'] - 1,
            // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
            // @ts-expect-error
            columnNumber: node['columnNumber'] - 1,
        };
        super(callFrame);
        this.self = node.selfSize;
    }
}
export class SamplingHeapProfileModel extends CPUProfile.ProfileTreeModel.ProfileTreeModel {
    // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    modules;
    constructor(profile, minOrdinal, maxOrdinal) {
        super();
        // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.modules = profile.modules || [];
        let nodeIdToSizeMap = null;
        if (minOrdinal || maxOrdinal) {
            nodeIdToSizeMap = new Map();
            minOrdinal = minOrdinal || 0;
            maxOrdinal = maxOrdinal || Infinity;
            for (const sample of profile.samples) {
                if (sample.ordinal < minOrdinal || sample.ordinal > maxOrdinal) {
                    continue;
                }
                const size = nodeIdToSizeMap.get(sample.nodeId) || 0;
                nodeIdToSizeMap.set(sample.nodeId, size + sample.size);
            }
        }
        this.initialize(translateProfileTree(profile.head));
        function translateProfileTree(root) {
            const resultRoot = new SamplingHeapProfileNode(root);
            const sourceNodeStack = [root];
            const targetNodeStack = [resultRoot];
            while (sourceNodeStack.length) {
                const sourceNode = sourceNodeStack.pop();
                const targetNode = targetNodeStack.pop();
                targetNode.children = sourceNode.children.map(child => {
                    const targetChild = new SamplingHeapProfileNode(child);
                    if (nodeIdToSizeMap) {
                        targetChild.self = nodeIdToSizeMap.get(child.id) || 0;
                    }
                    return targetChild;
                });
                sourceNodeStack.push(...sourceNode.children);
                targetNodeStack.push(...targetNode.children);
            }
            pruneEmptyBranches(resultRoot);
            return resultRoot;
        }
        function pruneEmptyBranches(node) {
            node.children = node.children.filter(pruneEmptyBranches);
            return Boolean(node.children.length || node.self);
        }
    }
}
export class NodeFormatter {
    profileView;
    constructor(profileView) {
        this.profileView = profileView;
    }
    formatValue(value) {
        return Platform.NumberUtilities.withThousandsSeparator(value);
    }
    formatValueAccessibleText(value) {
        return i18nString(UIStrings.sBytes, { PH1: value });
    }
    formatPercent(value, _node) {
        return i18nString(UIStrings.formatPercent, { PH1: value.toFixed(2) });
    }
    linkifyNode(node) {
        const heapProfilerModel = this.profileView.profileHeader.heapProfilerModel();
        const target = heapProfilerModel ? heapProfilerModel.target() : null;
        const options = {
            className: 'profile-node-file',
            inlineFrameIndex: 0,
        };
        return this.profileView.linkifier().maybeLinkifyConsoleCallFrame(target, node.profileNode.callFrame, options);
    }
}
export class HeapFlameChartDataProvider extends ProfileFlameChartDataProvider {
    profile;
    heapProfilerModel;
    timelineDataInternal;
    constructor(profile, heapProfilerModel) {
        super();
        this.profile = profile;
        this.heapProfilerModel = heapProfilerModel;
    }
    minimumBoundary() {
        return 0;
    }
    totalTime() {
        return this.profile.root.total;
    }
    entryHasDeoptReason(_entryIndex) {
        return false;
    }
    formatValue(value, _precision) {
        return i18nString(UIStrings.skb, { PH1: Platform.NumberUtilities.withThousandsSeparator(value / 1e3) });
    }
    calculateTimelineData() {
        function nodesCount(node) {
            return node.children.reduce((count, node) => count + nodesCount(node), 1);
        }
        const count = nodesCount(this.profile.root);
        const entryNodes = new Array(count);
        const entryLevels = new Uint16Array(count);
        const entryTotalTimes = new Float32Array(count);
        const entryStartTimes = new Float64Array(count);
        let depth = 0;
        let maxDepth = 0;
        let position = 0;
        let index = 0;
        function addNode(node) {
            const start = position;
            entryNodes[index] = node;
            entryLevels[index] = depth;
            entryTotalTimes[index] = node.total;
            entryStartTimes[index] = position;
            ++index;
            ++depth;
            node.children.forEach(addNode);
            --depth;
            maxDepth = Math.max(maxDepth, depth);
            position = start + node.total;
        }
        addNode(this.profile.root);
        this.maxStackDepthInternal = maxDepth + 1;
        this.entryNodes = entryNodes;
        this.timelineDataInternal =
            PerfUI.FlameChart.FlameChartTimelineData.create({ entryLevels, entryTotalTimes, entryStartTimes, groups: null });
        return this.timelineDataInternal;
    }
    prepareHighlightedEntryInfo(entryIndex) {
        const node = this.entryNodes[entryIndex];
        if (!node) {
            return null;
        }
        const entryInfo = [];
        function pushEntryInfoRow(title, value) {
            entryInfo.push({ title: title, value: value });
        }
        pushEntryInfoRow(i18nString(UIStrings.name), UI.UIUtils.beautifyFunctionName(node.functionName));
        pushEntryInfoRow(i18nString(UIStrings.selfSize), Platform.NumberUtilities.bytesToString(node.self));
        pushEntryInfoRow(i18nString(UIStrings.totalSize), Platform.NumberUtilities.bytesToString(node.total));
        const linkifier = new Components.Linkifier.Linkifier();
        const link = linkifier.maybeLinkifyConsoleCallFrame(this.heapProfilerModel ? this.heapProfilerModel.target() : null, node.callFrame);
        if (link) {
            pushEntryInfoRow(i18nString(UIStrings.url), link.textContent);
        }
        linkifier.dispose();
        return ProfileView.buildPopoverTable(entryInfo);
    }
}
//# sourceMappingURL=HeapProfileView.js.map