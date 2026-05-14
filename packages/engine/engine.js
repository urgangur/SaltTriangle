const ActionRegistry = {
    _cache: new Map(),
    _counter: 0,
    register(actionScript) {
        const id = `act_${this._counter++}`;
        this._cache.set(id, actionScript);
        return id;
    },
    get(id) { return this._cache.get(id); },
    clear() {
        this._cache.clear();
        this._counter = 0;
    }
};

function renderNode(node, ctx) {
    switch (node.type) {
        case 'TEXT':
            return node.value;

        case 'EXPRESSION':
            return String(stEvalExpr(node.expr, ctx));

        case 'LINK':
            const label = stEvalExpr(node.value, ctx) ?? node.value;
            const actionId = ActionRegistry.register(node.content)
            return `<a href="javascript:void(0)" passage-next="${node.nextPassage}" data-action-id="${actionId}">
                        ${label}
                    </a>`;

        case 'IF':
            return renderIf(node, ctx);

        case 'FOR':
            return renderFor(node, ctx);

        default:
            return '';
    }
}

function renderIf(node, ctx) {
    for (const branch of node.branches) {
        const cond = branch.condition;

        if (!cond || stEvalExpr(cond, ctx)) {
            return branch.children
                .map(n => renderNode(n, ctx))
                .join('');
        }
    }

    return '';
}

function renderFor(node, ctx) {
    const data = stEvalExpr(node.iterable, ctx);

    if (data == null) return '';

    let out = '';

    // Array case
    if (Array.isArray(data)) {
        data.forEach((value, index) => {
            const childCtx = {
                variables: {
                    ...ctx.variables,
                    __temp: {
                        ...(ctx.variables.__temp || {})
                    }
                }
            };

            if (node.k) childCtx.variables.__temp[node.k] = index;
            if (node.v) childCtx.variables.__temp[node.v] = value;

            out += node.children
                .map(n => renderNode(n, childCtx))
                .join('');
        });

        return out;
    }

    // Object / Map case
    if (typeof data === 'object') {
        for (const key of Object.keys(data)) {
            const childCtx = {
                variables: {
                    ...ctx.variables,
                    __temp: {
                        ...(ctx.variables.__temp || {})
                    }
                }
            };

            childCtx.variables.__temp[node.k] = key;
            childCtx.variables.__temp[node.v] = data[key];

            out += node.children
                .map(n => renderNode(n, childCtx))
                .join('');
        }

        return out;
    }

    return '';
}

window.STEngine = class STEngine {
    constructor(passages) {
        this.passages = passages;
        this.currentPassage = null;
        this.history = [];
        this.redoStack = [];
        this._migrator = this.defaultMigrator.bind(this);
        this._exporter = this.defaultExporter.bind(this);
    }

    setMigrator(fn) {
        if (typeof fn === 'function') {
            this._migrator = fn.bind(this);
        } else {
            console.error("[SaltTriangle] setMigrator requires a function.");
        }
    }

    setExporter(fn) {
        if (typeof fn === 'function') {
            this._exporter = fn.bind(this);
        } else {
            console.error("[SaltTriangle] setExporter requires a function.");
        }
    }

    static compareVersion(v1, v2) {
        const versionRegex = /^(\d+)\.(\d+)\.(\d+)$/;
        const p1 = versionRegex.exec(v1);
        const p2 = versionRegex.exec(v2);
        if (!p1 || !p2) {
            console.error(`[SaltTriangle] Invalid version format: ${v1} or ${v2}`);
            return 0;
        }
        for (let i = 1; i < 4; i++) {
            if (p1[i] > p2[i]) return 1;
            if (p1[i] < p2[i]) return -1;
        }
        return 0;
    }

    compareVersion(v1, v2) {
        return STEngine.compareVersion(v1, v2);
    }

    defaultMigrator(saveData, currentVersion) {
        const saveVersion = saveData.version;
        if (!saveVersion || !currentVersion) return saveData;

        const cmp = this.compareVersion(saveVersion, currentVersion);
        if (cmp > 0) {
            console.warn(`[SaltTriangle] Warning: Loading save from newer version (${saveVersion}) into older game (${currentVersion}).`);
        } else if (cmp < 0) {
            console.log(`[SaltTriangle] Migrating older save (${saveVersion}) to current version (${currentVersion}).`);
            saveData.version = currentVersion;
        }
        return saveData;
    }

    defaultExporter(saveData) {
        return saveData;
    }

    runScript(script, ctx, scope, api) {
        return new Function('State', 'scope', 'api', script)(ctx, scope, api);
    }

    createAPI(ctx) {
        return {
            clearTemp: () => Object.keys(ctx.variables.__temp).forEach(k => delete ctx.variables.__temp[k]),
            save: (slot = 'default') => this.save(slot),
            load: (slot = 'default') => this.load(slot),
            export: (filename) => this.export(filename),
            import: () => this.import(),
            getSaveMeta: () => this.getSaveMeta(),
            undo: () => this.undo(),
            redo: () => this.redo(),
            canUndo: () => this.history.length > 0,
            canRedo: () => this.redoStack.length > 0,
            setMigrator: (fn) => this.setMigrator(fn),
            setExporter: (fn) => this.setExporter(fn),
            compareVersion: (v1, v2) => this.compareVersion(v1, v2)
        }
    }

    undo() {
        if (this.history.length === 0) return false;
        this.redoStack.push(this.currentSnapshot);
        const snapshot = this.history.pop();
        this.applySnapshot(snapshot);
        return true;
    }

    redo() {
        if (this.redoStack.length === 0) return false;
        this.history.push(this.currentSnapshot);
        const snapshot = this.redoStack.pop();
        this.applySnapshot(snapshot);
        return true;
    }

    applySnapshot(snapshot) {
        const parsedData = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
        Object.keys(State).forEach(key => delete State[key]);
        Object.assign(State, parsedData);
        this.runPassage(parsedData.currPassage, true);
    }

    save(slot = 'default') {
        try {
            let parsedData = JSON.parse(this.currentSnapshot);
            if (this._exporter) parsedData = this._exporter(parsedData);
            const dataToSave = JSON.stringify(parsedData);
            localStorage.setItem(`st_save_${slot}`, dataToSave);
            // -- save meta --
            let meta = {};
            try {
                meta = JSON.parse(localStorage.getItem('st_saveMeta')) || {};
            } catch (e) { }

            meta[slot] = { date: Date.now() };

            localStorage.setItem('st_saveMeta', JSON.stringify(meta));
            // -------------
            return true;
        } catch (e) {
            console.error("Save failed:", e);
            return false;
        }
    }

    getSaveMeta() {
        try {
            return JSON.parse(localStorage.getItem('st_saveMeta')) || {};
        } catch (e) {
            return {};
        }
    }

    load(slot = 'default') {
        try {
            const data = localStorage.getItem(`st_save_${slot}`);
            if (!data) return false;
            let parsedData = JSON.parse(data);
            if (this._migrator) {
                parsedData = this._migrator(parsedData, State.version);
            }
            this.history = [];
            this.redoStack = [];


            this.applySnapshot(parsedData);
            return true;
        } catch (e) {
            console.error("Load failed:", e);
            return false;
        }
    }

    export(filename = 'save.json') {
        try {
            let parsedData = JSON.parse(this.currentSnapshot);
            if (this._exporter) parsedData = this._exporter(parsedData);
            const data = JSON.stringify(parsedData, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            return true;
        } catch (e) {
            console.error("Export failed:", e);
            return false;
        }
    }

    import() {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,application/json';
            input.onchange = e => {
                const file = e.target.files?.[0];
                if (!file) {
                    resolve(false);
                    return;
                }
                const reader = new FileReader();
                reader.onload = event => {
                    try {
                        let parsedData = JSON.parse(event.target.result);
                        if (this._migrator) {
                            parsedData = this._migrator(parsedData, State.version);
                        }
                        this.history = [];
                        this.redoStack = [];
                        this.applySnapshot(parsedData);
                        resolve(true);
                    } catch (err) {
                        console.error("Import failed:", err);
                        resolve(false);
                    }
                };
                reader.onerror = () => resolve(false);
                reader.readAsText(file);
            };
            input.click();
        });
    }

    createScope(ctx) {
        return new Proxy({}, {
            get(_, key) {
                if (typeof key === 'symbol') return undefined;
                if (key.startsWith('_')) return ctx.variables.__temp[key.slice(1)];
                if (key.startsWith('$')) return ctx.variables[key.slice(1)];
                return undefined;
            },
            set(_, key, value) {
                if (key.startsWith('_')) ctx.variables.__temp[key.slice(1)] = value;
                else if (key.startsWith('$')) ctx.variables[key.slice(1)] = value;
                return true;
            }
        });
    }

    runPassage(passageId, skipHistory = false) {
        const passage = this.passages[passageId];
        if (!passage) throw new Error(`Passage "${passageId}" not found.`);

        if (!skipHistory || passage.tags.includes('nosave')) {
            if (this.currentSnapshot) {
                this.history.push(this.currentSnapshot);
                const max = State.config.maxHistory || 10;
                if (this.history.length > max) this.history.shift();
            }
            this.redoStack = []; // New action clears redo stack
        }

        const ctx = State;
        const api = this.createAPI(ctx);
        const scope = this.createScope(ctx);

        this.currentPassage = passage;
        ctx.currPassage = passageId;

        this.currentSnapshot = JSON.stringify(ctx);
        if (!passage.tags.includes('nosave')) this.save('auto');

        if (passage.onEnter) this.runScript(passage.onEnter, ctx, scope, api);

        this.render(passage, ctx);
        if (passage.afterRendered) {
            requestAnimationFrame(() => {
                this.runScript(passage.afterRendered, ctx, scope, api);
            });
        }
    }

    goTo(passageId, actionId) {
        const ctx = State;
        const api = this.createAPI(ctx);
        const scope = this.createScope(ctx);

        if (actionId && ActionRegistry.get(actionId)) {
            const action = ActionRegistry.get(actionId);
            const actionScope = this.createScope(ctx);
            this.runScript(action, ctx, actionScope, api);
        }

        if (this.currentPassage.id === passageId) {
            this.render(this.currentPassage, ctx);
            return;
        }

        if (this.currentPassage.onExit) this.runScript(this.currentPassage.onExit, ctx, scope, api);
        else api.clearTemp();

        this.runPassage(passageId);
    }

    render(passage, ctx) {
        const root = document.getElementById('st-main');
        ActionRegistry.clear();
        const renderedSlots = {};
        let layoutHtml = window.STLayouts[passage.layout];

        for (const slotName in passage.slots) {
            const nodes = passage.slots[slotName];
            const html = nodes
                .map(node => renderNode(node, ctx))
                .join('');

            renderedSlots[slotName] = html;
        }

        layoutHtml = layoutHtml.replace(/\$\{\s*=\s*(.*?)\s*\}/g, (_, key) => {
            try {
                return String(stEvalExpr(key, ctx));
            } catch (e) {
                console.error(`Undefined expression: ${key}`);
                return "";
            }
        })
        for (const [name, html] of Object.entries(renderedSlots)) {
            layoutHtml = layoutHtml.split(`{{${name}}}`).join(html);
        }

        root.innerHTML = layoutHtml;

        root.onclick = (e) => {
            const el = e.target.closest('[passage-next]');
            if (!el) return;

            const nextPassage = el.getAttribute('passage-next');
            const actionId = el.getAttribute('data-action-id');
            this.goTo(nextPassage, actionId);
        };
    }

    startGame() {
        this.runPassage(State.currPassage);
    }
}