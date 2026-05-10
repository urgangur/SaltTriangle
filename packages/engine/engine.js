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
            const childCtx = Object.create(ctx);

            childCtx[node.k] = index;
            childCtx[node.v] = value;

            out += node.children
                .map(n => renderNode(n, childCtx))
                .join('');
        });

        return out;
    }

    // Object / Map case
    if (typeof data === 'object') {
        for (const key in data) {
            const childCtx = Object.create(ctx);

            childCtx[node.k] = key;
            childCtx[node.v] = data[key];

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
    }

    runScript(script, ctx, engine, scope) {
        return new Function('State', 'engine', 'scope', 'api', script)(ctx, engine, scope, engine.api);
    }

    createAPI(ctx) {
        return {
            clearTemp: () => {
                Object.keys(ctx.variables.__temp).forEach(k => delete ctx.variables.__temp[k]);
            },
            save: (slot = 'default') => this.save(slot),
            load: (slot = 'default') => this.load(slot),
            export: (filename) => this.export(filename),
            import: () => this.import()
        }
    }

    save(slot = 'default') {
        try {
            const dataToSave = this.currentSnapshot;
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
            Object.keys(State).forEach(key => delete State[key]);
            const parsedData = JSON.parse(data);
            Object.assign(State, parsedData);
            this.runPassage(parsedData.currPassage);
            return true;
        } catch (e) {
            console.error("Load failed:", e);
            return false;
        }
    }

    export(filename = 'save.json') {
        try {
            const data = this.currentSnapshot;
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
                        const parsedData = JSON.parse(event.target.result);
                        Object.keys(State).forEach(key => delete State[key]);
                        Object.assign(State, parsedData);
                        this.runPassage(parsedData.currPassage);
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

    runPassage(passageId) {
        const passage = this.passages[passageId];
        if (!passage) throw new Error(`Passage "${passageId}" not found.`);

        const ctx = State;
        const engine = { api: this.createAPI(ctx) };
        const scope = this.createScope(ctx);

        this.currentPassage = passage;
        ctx.currPassage = passageId;

        this.currentSnapshot = JSON.stringify(ctx);
        this.save('auto');

        if (passage.onEnter) this.runScript(passage.onEnter, ctx, engine, scope);

        this.render(passage, ctx);
        if (passage.afterRendered) {
            requestAnimationFrame(() => {
                this.runScript(passage.afterRendered, ctx, engine, scope);
            });
        }
    }

    goTo(passageId, actionId) {
        const ctx = State;
        const engine = { api: this.createAPI(ctx) };
        const scope = this.createScope(ctx);

        if (actionId && ActionRegistry.get(actionId)) {
            const action = ActionRegistry.get(actionId);
            const actionScope = this.createScope(ctx);
            this.runScript(action, ctx, engine, actionScope);
        }

        if (this.currentPassage.id === passageId) {
            this.render(this.currentPassage, ctx);
            return;
        }

        if (this.currentPassage.onExit) this.runScript(this.currentPassage.onExit, ctx, engine, scope);
        else engine.api.clearTemp();

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