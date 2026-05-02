function renderNode(node, ctx) {
    switch (node.type) {
        case 'TEXT':
            return node.value;

        case 'EXPRESSION':
            return String(stEvalExpr(node.expr, ctx));

        case 'LINK': 
            const label = stEvalExpr(node.value, ctx) ?? node.value;
            return `<a href="javascript:void(0)" passage-next="${node.nextPassage}">
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
    constructor (passages) {
        this.passages = passages;
        this.currentPassage = null;
    }

    runScript(script, ctx, engine, scope) {
        return new Function("State", "engine", "scope", `
            with (scope) {
                ${script}
            }
            `)(ctx, engine, scope);
    }

    createAPI(ctx) {
        return {
            clearTemp: () => {
                Object.keys(ctx.variables.__temp).forEach(k => delete ctx.variables.__temp[k]);
            }
        }
    }

    createScope(ctx, engine) {
        return new Proxy({}, {
            has() { return true; },
            get(_, key) {
                if (typeof key ==='symbol') return undefined;
                if (key === 'api') return engine.api;
                if (key === 'engine') return engine;
                if (key.startsWith('_')) return ctx.variables.__temp[key.slice(1)];
                if (key.startsWith('$')) return ctx.variables[key.slice(1)];
                return globalThis[key];
            },
            set(_, key, value) {
                if (key.startsWith('_')) ctx.variables.__temp[key.slice(1)] = value;
                else if (key.startsWith('$')) ctx.variables[key.slice(1)] = value;
                else globalThis[key] = value;
                return true;
            }
        });
    }

    bindLinks(root) {
        root.querySelectorAll('[passage-next]').forEach(el => {
            el.onclick = () => {
                const next = el.getAttribute('passage-next');
                this.goTo(next);
            };
        });
    }

    runPassage(passageId) {
        const passage = this.passages[passageId];
        if (!passage) throw new Error(`Passage "${passageId}" not found.`);

        const ctx = State;
        const engine = { api: this.createAPI(ctx)};
        const scope = this.createScope(ctx, engine);

        this.currentPassage = passage;
        if (passage.onEnter) this.runScript(passage.onEnter, ctx, engine, scope);;

        this.render(passage, ctx);
    }

    goTo(passageId, action) {
        const ctx = State;
        const engine = { api: this.createAPI(ctx)};
        const scope = this.createScope(ctx, engine);

        if (action) {
            const actionScope = this.createScope(ctx, engine);
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
    }

    startGame() {
        this.runPassage(State.nextPassage);
    }
}