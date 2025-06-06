// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
import * as Common from '../../core/common/common.js';
import * as Host from '../../core/host/host.js';
import * as i18n from '../../core/i18n/i18n.js';
import * as Platform from '../../core/platform/platform.js';
import * as Root from '../../core/root/root.js';
import * as SDK from '../../core/sdk/sdk.js';
import * as Bindings from '../../models/bindings/bindings.js';
import * as Persistence from '../../models/persistence/persistence.js';
import * as Workspace from '../../models/workspace/workspace.js';
import * as QuickOpen from '../../ui/legacy/components/quick_open/quick_open.js';
import * as SourceFrame from '../../ui/legacy/components/source_frame/source_frame.js';
import * as UI from '../../ui/legacy/legacy.js';
import * as VisualLogging from '../../ui/visual_logging/visual_logging.js';
import * as Components from './components/components.js';
import { EditingLocationHistoryManager } from './EditingLocationHistoryManager.js';
import sourcesViewStyles from './sourcesView.css.js';
import { TabbedEditorContainer, } from './TabbedEditorContainer.js';
import { UISourceCodeFrame } from './UISourceCodeFrame.js';
const UIStrings = {
    /**
     *@description Text to open a file
     */
    openFile: 'Open file',
    /**
     *@description Text to run commands
     */
    runCommand: 'Run command',
    /**
     *@description Text in Sources View of the Sources panel. This sentence follows by a list of actions.
     */
    workspaceDropInAFolderToSyncSources: 'To sync edits to the workspace, drop a folder with your sources here or',
    /**
     *@description Text in Sources View of the Sources panel.
     */
    selectFolder: 'Select folder',
    /**
     *@description Accessible label for Sources placeholder view actions list
     */
    sourceViewActions: 'Source View Actions',
};
const str_ = i18n.i18n.registerUIStrings('panels/sources/SourcesView.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);
export class SourcesView extends Common.ObjectWrapper.eventMixin(UI.Widget.VBox) {
    selectedIndex;
    searchableViewInternal;
    sourceViewByUISourceCode;
    editorContainer;
    historyManager;
    toolbarContainerElementInternal;
    scriptViewToolbar;
    bottomToolbarInternal;
    toolbarChangedListener;
    focusedPlaceholderElement;
    searchView;
    searchConfig;
    constructor() {
        super();
        this.element.id = 'sources-panel-sources-view';
        this.element.setAttribute('jslog', `${VisualLogging.pane('editor')}`);
        this.setMinimumAndPreferredSizes(88, 52, 150, 100);
        this.selectedIndex = 0;
        const workspace = Workspace.Workspace.WorkspaceImpl.instance();
        this.searchableViewInternal = new UI.SearchableView.SearchableView(this, this, 'sources-view-search-config');
        this.searchableViewInternal.setMinimalSearchQuerySize(0);
        this.searchableViewInternal.show(this.element);
        this.sourceViewByUISourceCode = new Map();
        this.editorContainer = new TabbedEditorContainer(this, Common.Settings.Settings.instance().createLocalSetting('previously-viewed-files', []), this.placeholderElement(), this.focusedPlaceholderElement);
        this.editorContainer.show(this.searchableViewInternal.element);
        this.editorContainer.addEventListener("EditorSelected" /* TabbedEditorContainerEvents.EditorSelected */, this.editorSelected, this);
        this.editorContainer.addEventListener("EditorClosed" /* TabbedEditorContainerEvents.EditorClosed */, this.editorClosed, this);
        this.historyManager = new EditingLocationHistoryManager(this);
        this.toolbarContainerElementInternal = this.element.createChild('div', 'sources-toolbar');
        this.toolbarContainerElementInternal.setAttribute('jslog', `${VisualLogging.toolbar('bottom')}`);
        this.scriptViewToolbar = new UI.Toolbar.Toolbar('', this.toolbarContainerElementInternal);
        this.scriptViewToolbar.element.style.flex = 'auto';
        this.bottomToolbarInternal = new UI.Toolbar.Toolbar('', this.toolbarContainerElementInternal);
        this.toolbarChangedListener = null;
        UI.UIUtils.startBatchUpdate();
        workspace.uiSourceCodes().forEach(this.addUISourceCode.bind(this));
        UI.UIUtils.endBatchUpdate();
        workspace.addEventListener(Workspace.Workspace.Events.UISourceCodeAdded, this.uiSourceCodeAdded, this);
        workspace.addEventListener(Workspace.Workspace.Events.UISourceCodeRemoved, this.uiSourceCodeRemoved, this);
        workspace.addEventListener(Workspace.Workspace.Events.ProjectRemoved, this.projectRemoved.bind(this), this);
        SDK.TargetManager.TargetManager.instance().addScopeChangeListener(this.#onScopeChange.bind(this));
        function handleBeforeUnload(event) {
            if (event.returnValue) {
                return;
            }
            const unsavedSourceCodes = [];
            const projects = Workspace.Workspace.WorkspaceImpl.instance().projectsForType(Workspace.Workspace.projectTypes.FileSystem);
            for (const project of projects) {
                for (const uiSourceCode of project.uiSourceCodes()) {
                    if (uiSourceCode.isDirty()) {
                        unsavedSourceCodes.push(uiSourceCode);
                    }
                }
            }
            if (!unsavedSourceCodes.length) {
                return;
            }
            event.returnValue = true;
            void UI.ViewManager.ViewManager.instance().showView('sources');
            for (const sourceCode of unsavedSourceCodes) {
                void Common.Revealer.reveal(sourceCode);
            }
        }
        if (!window.opener) {
            window.addEventListener('beforeunload', handleBeforeUnload, true);
        }
    }
    placeholderElement() {
        const shortcuts = [
            { actionId: 'quick-open.show', description: i18nString(UIStrings.openFile) },
            { actionId: 'quick-open.show-command-menu', description: i18nString(UIStrings.runCommand) },
            {
                actionId: 'sources.add-folder-to-workspace',
                condition: Root.Runtime.ConditionName.NOT_SOURCES_HIDE_ADD_FOLDER,
                description: i18nString(UIStrings.workspaceDropInAFolderToSyncSources),
                isWorkspace: true,
            },
        ];
        const list = document.createElement('div');
        UI.ARIAUtils.markAsList(list);
        UI.ARIAUtils.setLabel(list, i18nString(UIStrings.sourceViewActions));
        for (const shortcut of shortcuts) {
            const { condition } = shortcut;
            if (condition !== undefined &&
                !Root.Runtime.Runtime.isDescriptorEnabled({ experiment: undefined, condition: () => Boolean(Root.Runtime.Runtime.queryParam(condition)) })) {
                continue;
            }
            const shortcutKeyText = UI.ShortcutRegistry.ShortcutRegistry.instance().shortcutTitleForAction(shortcut.actionId);
            const listItemElement = list.createChild('div', 'tabbed-pane-placeholder-row');
            UI.ARIAUtils.markAsListitem(listItemElement);
            if (shortcutKeyText) {
                const title = listItemElement.createChild('span');
                title.textContent = shortcutKeyText;
                const button = listItemElement.createChild('button');
                button.textContent = shortcut.description;
                const action = UI.ActionRegistry.ActionRegistry.instance().getAction(shortcut.actionId);
                button.addEventListener('click', () => action.execute());
            }
            if (shortcut.isWorkspace) {
                const workspace = listItemElement.createChild('span', 'workspace');
                workspace.textContent = shortcut.description;
                const browseButton = workspace.createChild('button');
                browseButton.textContent = i18nString(UIStrings.selectFolder);
                browseButton.addEventListener('click', this.addFileSystemClicked.bind(this));
            }
        }
        if (Root.Runtime.Runtime.isDescriptorEnabled({ experiment: undefined, condition: Root.Runtime.conditions.notSourcesHideAddFolder })) {
            list.appendChild(UI.XLink.XLink.create('https://developer.chrome.com/docs/devtools/workspaces/', 'Learn more about Workspaces'));
        }
        return list;
    }
    async addFileSystemClicked() {
        const result = await Persistence.IsolatedFileSystemManager.IsolatedFileSystemManager.instance().addFileSystem();
        if (!result) {
            return;
        }
        Host.userMetrics.actionTaken(Host.UserMetrics.Action.WorkspaceSelectFolder);
        void UI.ViewManager.ViewManager.instance().showView('navigator-files');
    }
    static defaultUISourceCodeScores() {
        const defaultScores = new Map();
        const sourcesView = UI.Context.Context.instance().flavor(SourcesView);
        if (sourcesView) {
            const uiSourceCodes = sourcesView.editorContainer.historyUISourceCodes();
            for (let i = 1; i < uiSourceCodes.length; ++i) // Skip current element
             {
                defaultScores.set(uiSourceCodes[i], uiSourceCodes.length - i);
            }
        }
        return defaultScores;
    }
    leftToolbar() {
        return this.editorContainer.leftToolbar();
    }
    rightToolbar() {
        return this.editorContainer.rightToolbar();
    }
    bottomToolbar() {
        return this.bottomToolbarInternal;
    }
    wasShown() {
        super.wasShown();
        this.registerCSSFiles([sourcesViewStyles]);
        UI.Context.Context.instance().setFlavor(SourcesView, this);
    }
    willHide() {
        UI.Context.Context.instance().setFlavor(SourcesView, null);
        super.willHide();
    }
    toolbarContainerElement() {
        return this.toolbarContainerElementInternal;
    }
    searchableView() {
        return this.searchableViewInternal;
    }
    visibleView() {
        return this.editorContainer.visibleView;
    }
    currentSourceFrame() {
        const view = this.visibleView();
        if (!(view instanceof UISourceCodeFrame)) {
            return null;
        }
        return view;
    }
    currentUISourceCode() {
        return this.editorContainer.currentFile();
    }
    onCloseEditorTab() {
        const uiSourceCode = this.editorContainer.currentFile();
        if (!uiSourceCode) {
            return false;
        }
        this.editorContainer.closeFile(uiSourceCode);
        return true;
    }
    onJumpToPreviousLocation() {
        this.historyManager.rollback();
    }
    onJumpToNextLocation() {
        this.historyManager.rollover();
    }
    #onScopeChange() {
        const workspace = Workspace.Workspace.WorkspaceImpl.instance();
        for (const uiSourceCode of workspace.uiSourceCodes()) {
            if (uiSourceCode.project().type() !== Workspace.Workspace.projectTypes.Network) {
                continue;
            }
            const target = Bindings.NetworkProject.NetworkProject.targetForUISourceCode(uiSourceCode);
            if (SDK.TargetManager.TargetManager.instance().isInScope(target)) {
                this.addUISourceCode(uiSourceCode);
            }
            else {
                this.removeUISourceCodes([uiSourceCode]);
            }
        }
    }
    uiSourceCodeAdded(event) {
        const uiSourceCode = event.data;
        this.addUISourceCode(uiSourceCode);
    }
    addUISourceCode(uiSourceCode) {
        const project = uiSourceCode.project();
        if (project.isServiceProject()) {
            return;
        }
        switch (project.type()) {
            case Workspace.Workspace.projectTypes.FileSystem: {
                if (Persistence.FileSystemWorkspaceBinding.FileSystemWorkspaceBinding.fileSystemType(project) === 'overrides') {
                    return;
                }
                break;
            }
            case Workspace.Workspace.projectTypes.Network: {
                const target = Bindings.NetworkProject.NetworkProject.targetForUISourceCode(uiSourceCode);
                if (!SDK.TargetManager.TargetManager.instance().isInScope(target)) {
                    return;
                }
            }
        }
        this.editorContainer.addUISourceCode(uiSourceCode);
    }
    uiSourceCodeRemoved(event) {
        const uiSourceCode = event.data;
        this.removeUISourceCodes([uiSourceCode]);
    }
    removeUISourceCodes(uiSourceCodes) {
        this.editorContainer.removeUISourceCodes(uiSourceCodes);
        for (let i = 0; i < uiSourceCodes.length; ++i) {
            this.removeSourceFrame(uiSourceCodes[i]);
            this.historyManager.removeHistoryForSourceCode(uiSourceCodes[i]);
        }
    }
    projectRemoved(event) {
        const project = event.data;
        const uiSourceCodes = project.uiSourceCodes();
        this.removeUISourceCodes([...uiSourceCodes]);
    }
    updateScriptViewToolbarItems() {
        const view = this.visibleView();
        if (view instanceof UI.View.SimpleView) {
            void view.toolbarItems().then(items => {
                this.scriptViewToolbar.removeToolbarItems();
                for (const action of getRegisteredEditorActions()) {
                    this.scriptViewToolbar.appendToolbarItem(action.getOrCreateButton(this));
                }
                items.map(item => this.scriptViewToolbar.appendToolbarItem(item));
            });
        }
    }
    showSourceLocation(uiSourceCode, location, omitFocus, omitHighlight) {
        const currentFrame = this.currentSourceFrame();
        if (currentFrame) {
            this.historyManager.updateCurrentState(currentFrame.uiSourceCode(), currentFrame.textEditor.state.selection.main.head);
        }
        this.editorContainer.showFile(uiSourceCode);
        const currentSourceFrame = this.currentSourceFrame();
        if (currentSourceFrame && location) {
            currentSourceFrame.revealPosition(location, !omitHighlight);
        }
        const visibleView = this.visibleView();
        if (!omitFocus && visibleView) {
            visibleView.focus();
        }
    }
    createSourceView(uiSourceCode) {
        let sourceView;
        const contentType = uiSourceCode.contentType();
        if (contentType === Common.ResourceType.resourceTypes.Image) {
            sourceView = new SourceFrame.ImageView.ImageView(uiSourceCode.mimeType(), uiSourceCode);
        }
        else if (contentType === Common.ResourceType.resourceTypes.Font) {
            sourceView = new SourceFrame.FontView.FontView(uiSourceCode.mimeType(), uiSourceCode);
        }
        else if (uiSourceCode.name() === HEADER_OVERRIDES_FILENAME) {
            sourceView = new Components.HeadersView.HeadersView(uiSourceCode);
        }
        else {
            sourceView = new UISourceCodeFrame(uiSourceCode);
            this.historyManager.trackSourceFrameCursorJumps(sourceView);
        }
        uiSourceCode.addEventListener(Workspace.UISourceCode.Events.TitleChanged, this.#uiSourceCodeTitleChanged, this);
        this.sourceViewByUISourceCode.set(uiSourceCode, sourceView);
        return sourceView;
    }
    #sourceViewTypeForWidget(widget) {
        if (widget instanceof SourceFrame.ImageView.ImageView) {
            return "ImageView" /* SourceViewType.ImageView */;
        }
        if (widget instanceof SourceFrame.FontView.FontView) {
            return "FontView" /* SourceViewType.FontView */;
        }
        if (widget instanceof Components.HeadersView.HeadersView) {
            return "HeadersView" /* SourceViewType.HeadersView */;
        }
        return "SourceView" /* SourceViewType.SourceView */;
    }
    #sourceViewTypeForUISourceCode(uiSourceCode) {
        if (uiSourceCode.name() === HEADER_OVERRIDES_FILENAME) {
            return "HeadersView" /* SourceViewType.HeadersView */;
        }
        const contentType = uiSourceCode.contentType();
        switch (contentType) {
            case Common.ResourceType.resourceTypes.Image:
                return "ImageView" /* SourceViewType.ImageView */;
            case Common.ResourceType.resourceTypes.Font:
                return "FontView" /* SourceViewType.FontView */;
            default:
                return "SourceView" /* SourceViewType.SourceView */;
        }
    }
    #uiSourceCodeTitleChanged(event) {
        const uiSourceCode = event.data;
        const widget = this.sourceViewByUISourceCode.get(uiSourceCode);
        if (widget) {
            if (this.#sourceViewTypeForWidget(widget) !== this.#sourceViewTypeForUISourceCode(uiSourceCode)) {
                // Remove the exisiting editor tab and create a new one of the correct type.
                this.removeUISourceCodes([uiSourceCode]);
                this.showSourceLocation(uiSourceCode);
            }
        }
    }
    getSourceView(uiSourceCode) {
        return this.sourceViewByUISourceCode.get(uiSourceCode);
    }
    getOrCreateSourceView(uiSourceCode) {
        return this.sourceViewByUISourceCode.get(uiSourceCode) || this.createSourceView(uiSourceCode);
    }
    recycleUISourceCodeFrame(sourceFrame, uiSourceCode) {
        sourceFrame.uiSourceCode().removeEventListener(Workspace.UISourceCode.Events.TitleChanged, this.#uiSourceCodeTitleChanged, this);
        this.sourceViewByUISourceCode.delete(sourceFrame.uiSourceCode());
        sourceFrame.setUISourceCode(uiSourceCode);
        this.sourceViewByUISourceCode.set(uiSourceCode, sourceFrame);
        uiSourceCode.addEventListener(Workspace.UISourceCode.Events.TitleChanged, this.#uiSourceCodeTitleChanged, this);
    }
    viewForFile(uiSourceCode) {
        return this.getOrCreateSourceView(uiSourceCode);
    }
    removeSourceFrame(uiSourceCode) {
        const sourceView = this.sourceViewByUISourceCode.get(uiSourceCode);
        this.sourceViewByUISourceCode.delete(uiSourceCode);
        if (sourceView && sourceView instanceof UISourceCodeFrame) {
            sourceView.dispose();
        }
        uiSourceCode.removeEventListener(Workspace.UISourceCode.Events.TitleChanged, this.#uiSourceCodeTitleChanged, this);
    }
    editorClosed(event) {
        const uiSourceCode = event.data;
        this.historyManager.removeHistoryForSourceCode(uiSourceCode);
        let wasSelected = false;
        if (!this.editorContainer.currentFile()) {
            wasSelected = true;
        }
        // SourcesNavigator does not need to update on EditorClosed.
        this.removeToolbarChangedListener();
        this.updateScriptViewToolbarItems();
        this.searchableViewInternal.resetSearch();
        const data = {
            uiSourceCode: uiSourceCode,
            wasSelected: wasSelected,
        };
        this.dispatchEventToListeners("EditorClosed" /* Events.EditorClosed */, data);
    }
    editorSelected(event) {
        const previousSourceFrame = event.data.previousView instanceof UISourceCodeFrame ? event.data.previousView : null;
        if (previousSourceFrame) {
            previousSourceFrame.setSearchableView(null);
        }
        const currentSourceFrame = event.data.currentView instanceof UISourceCodeFrame ? event.data.currentView : null;
        if (currentSourceFrame) {
            currentSourceFrame.setSearchableView(this.searchableViewInternal);
        }
        this.searchableViewInternal.setReplaceable(Boolean(currentSourceFrame?.canEditSource()));
        this.searchableViewInternal.refreshSearch();
        this.updateToolbarChangedListener();
        this.updateScriptViewToolbarItems();
        const currentFile = this.editorContainer.currentFile();
        if (currentFile) {
            this.dispatchEventToListeners("EditorSelected" /* Events.EditorSelected */, currentFile);
        }
    }
    removeToolbarChangedListener() {
        if (this.toolbarChangedListener) {
            Common.EventTarget.removeEventListeners([this.toolbarChangedListener]);
        }
        this.toolbarChangedListener = null;
    }
    updateToolbarChangedListener() {
        this.removeToolbarChangedListener();
        const sourceFrame = this.currentSourceFrame();
        if (!sourceFrame) {
            return;
        }
        this.toolbarChangedListener = sourceFrame.addEventListener("ToolbarItemsChanged" /* UISourceCodeFrameEvents.ToolbarItemsChanged */, this.updateScriptViewToolbarItems, this);
    }
    onSearchCanceled() {
        if (this.searchView) {
            this.searchView.onSearchCanceled();
        }
        delete this.searchView;
        delete this.searchConfig;
    }
    performSearch(searchConfig, shouldJump, jumpBackwards) {
        const sourceFrame = this.currentSourceFrame();
        if (!sourceFrame) {
            return;
        }
        this.searchView = sourceFrame;
        this.searchConfig = searchConfig;
        this.searchView.performSearch(this.searchConfig, shouldJump, jumpBackwards);
    }
    jumpToNextSearchResult() {
        if (!this.searchView) {
            return;
        }
        if (this.searchConfig && this.searchView !== this.currentSourceFrame()) {
            this.performSearch(this.searchConfig, true);
            return;
        }
        this.searchView.jumpToNextSearchResult();
    }
    jumpToPreviousSearchResult() {
        if (!this.searchView) {
            return;
        }
        if (this.searchConfig && this.searchView !== this.currentSourceFrame()) {
            this.performSearch(this.searchConfig, true);
            if (this.searchView) {
                this.searchView.jumpToLastSearchResult();
            }
            return;
        }
        this.searchView.jumpToPreviousSearchResult();
    }
    supportsCaseSensitiveSearch() {
        return true;
    }
    supportsRegexSearch() {
        return true;
    }
    replaceSelectionWith(searchConfig, replacement) {
        const sourceFrame = this.currentSourceFrame();
        if (!sourceFrame) {
            console.assert(Boolean(sourceFrame));
            return;
        }
        sourceFrame.replaceSelectionWith(searchConfig, replacement);
    }
    replaceAllWith(searchConfig, replacement) {
        const sourceFrame = this.currentSourceFrame();
        if (!sourceFrame) {
            console.assert(Boolean(sourceFrame));
            return;
        }
        sourceFrame.replaceAllWith(searchConfig, replacement);
    }
    showOutlineQuickOpen() {
        QuickOpen.QuickOpen.QuickOpenImpl.show('@');
    }
    showGoToLineQuickOpen() {
        if (this.editorContainer.currentFile()) {
            QuickOpen.QuickOpen.QuickOpenImpl.show(':');
        }
    }
    save() {
        this.saveSourceFrame(this.currentSourceFrame());
    }
    saveAll() {
        const sourceFrames = this.editorContainer.fileViews();
        sourceFrames.forEach(this.saveSourceFrame.bind(this));
    }
    saveSourceFrame(sourceFrame) {
        if (!(sourceFrame instanceof UISourceCodeFrame)) {
            return;
        }
        const uiSourceCodeFrame = sourceFrame;
        uiSourceCodeFrame.commitEditing();
    }
    toggleBreakpointsActiveState(active) {
        this.editorContainer.view.element.classList.toggle('breakpoints-deactivated', !active);
    }
}
const registeredEditorActions = [];
export function registerEditorAction(editorAction) {
    registeredEditorActions.push(editorAction);
}
export function getRegisteredEditorActions() {
    return registeredEditorActions.map(editorAction => editorAction());
}
export class SwitchFileActionDelegate {
    static nextFile(currentUISourceCode) {
        function fileNamePrefix(name) {
            const lastDotIndex = name.lastIndexOf('.');
            const namePrefix = name.substr(0, lastDotIndex !== -1 ? lastDotIndex : name.length);
            return namePrefix.toLowerCase();
        }
        const candidates = [];
        const url = currentUISourceCode.parentURL();
        const name = currentUISourceCode.name();
        const namePrefix = fileNamePrefix(name);
        for (const uiSourceCode of currentUISourceCode.project().uiSourceCodes()) {
            if (url !== uiSourceCode.parentURL()) {
                continue;
            }
            if (fileNamePrefix(uiSourceCode.name()) === namePrefix) {
                candidates.push(uiSourceCode.name());
            }
        }
        candidates.sort(Platform.StringUtilities.naturalOrderComparator);
        const index = Platform.NumberUtilities.mod(candidates.indexOf(name) + 1, candidates.length);
        const fullURL = Common.ParsedURL.ParsedURL.concatenate((url ? Common.ParsedURL.ParsedURL.concatenate(url, '/') : ''), candidates[index]);
        const nextUISourceCode = currentUISourceCode.project().uiSourceCodeForURL(fullURL);
        return nextUISourceCode !== currentUISourceCode ? nextUISourceCode : null;
    }
    handleAction(context, _actionId) {
        const sourcesView = context.flavor(SourcesView);
        if (!sourcesView) {
            return false;
        }
        const currentUISourceCode = sourcesView.currentUISourceCode();
        if (!currentUISourceCode) {
            return false;
        }
        const nextUISourceCode = SwitchFileActionDelegate.nextFile(currentUISourceCode);
        if (!nextUISourceCode) {
            return false;
        }
        sourcesView.showSourceLocation(nextUISourceCode);
        return true;
    }
}
export class ActionDelegate {
    handleAction(context, actionId) {
        const sourcesView = context.flavor(SourcesView);
        if (!sourcesView) {
            return false;
        }
        switch (actionId) {
            case 'sources.close-all':
                sourcesView.editorContainer.closeAllFiles();
                return true;
            case 'sources.jump-to-previous-location':
                sourcesView.onJumpToPreviousLocation();
                return true;
            case 'sources.jump-to-next-location':
                sourcesView.onJumpToNextLocation();
                return true;
            case 'sources.next-editor-tab':
                sourcesView.editorContainer.selectNextTab();
                return true;
            case 'sources.previous-editor-tab':
                sourcesView.editorContainer.selectPrevTab();
                return true;
            case 'sources.close-editor-tab':
                return sourcesView.onCloseEditorTab();
            case 'sources.go-to-line':
                sourcesView.showGoToLineQuickOpen();
                return true;
            case 'sources.go-to-member':
                sourcesView.showOutlineQuickOpen();
                return true;
            case 'sources.save':
                sourcesView.save();
                return true;
            case 'sources.save-all':
                sourcesView.saveAll();
                return true;
        }
        return false;
    }
}
const HEADER_OVERRIDES_FILENAME = '.headers';
//# sourceMappingURL=SourcesView.js.map