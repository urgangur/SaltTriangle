/**
 * AI-generated code
 * note that:
 *   can't handle regex correctly (i won't fix this, wtf you have to write regex here)
 */
function transformScript(script) {
    // ── States ────────────────────────────────────────────────────
    const S_CODE = 0; // normal code
    const S_LCMT = 1; // line comment   //
    const S_BCMT = 2; // block comment  /* */
    const S_SQ = 3; // single-quoted  '...'
    const S_DQ = 4; // double-quoted  "..."
    const S_TMPL = 5; // template       `...`

    const out = [];
    let state = S_CODE;
    let i = 0;

    // Each entry = brace depth for one active ${...} interpolation.
    // Allows nested braces and nested template literals inside interpolations.
    const interpDepths = [];

    function isIdentChar(ch) { return ch !== undefined && /[a-zA-Z0-9_$]/.test(ch); }

    while (i < script.length) {
        const ch = script[i];
        const next = script[i + 1];

        switch (state) {

            case S_CODE: {
                // Enter comment
                if (ch === '/' && next === '/') { out.push('//'); i += 2; state = S_LCMT; break; }
                if (ch === '/' && next === '*') { out.push('/*'); i += 2; state = S_BCMT; break; }

                // Enter string / template
                if (ch === "'") { out.push("'"); i++; state = S_SQ; break; }
                if (ch === '"') { out.push('"'); i++; state = S_DQ; break; }
                if (ch === '`') { out.push('`'); i++; state = S_TMPL; break; }

                // Track braces inside a template interpolation
                if (interpDepths.length > 0) {
                    if (ch === '{') {
                        interpDepths[interpDepths.length - 1]++;
                        out.push(ch); i++; break;
                    }
                    if (ch === '}') {
                        if (interpDepths[interpDepths.length - 1] > 0) {
                            interpDepths[interpDepths.length - 1]--;
                            out.push(ch); i++;
                        } else {
                            interpDepths.pop();         // close ${ ... }
                            out.push(ch); i++;
                            state = S_TMPL;
                        }
                        break;
                    }
                }

                // Sigil identifier: $xxx or _xxx (not preceded by . or \w)
                const prevCh = i > 0 ? script[i - 1] : '';
                const freeStand = !/[.\w$_]/.test(prevCh);

                if (freeStand && ch === '$' && /[a-zA-Z_$]/.test(next ?? '')) {
                    let j = i;
                    while (j < script.length && isIdentChar(script[j])) j++;
                    out.push('scope.', script.slice(i, j));
                    i = j; break;
                }
                if (freeStand && ch === '_' && /[a-zA-Z_$]/.test(next ?? '')) {
                    let j = i;
                    while (j < script.length && isIdentChar(script[j])) j++;
                    out.push('scope.', script.slice(i, j));
                    i = j; break;
                }

                out.push(ch); i++;
                break;
            }

            case S_LCMT:
                out.push(ch);
                if (ch === '\n') state = S_CODE;
                i++;
                break;

            case S_BCMT:
                if (ch === '*' && next === '/') { out.push('*/'); i += 2; state = S_CODE; }
                else { out.push(ch); i++; }
                break;

            case S_SQ:
                if (ch === '\\') { out.push(ch, next ?? ''); i += 2; }
                else if (ch === "'") { out.push(ch); i++; state = S_CODE; }
                else { out.push(ch); i++; }
                break;

            case S_DQ:
                if (ch === '\\') { out.push(ch, next ?? ''); i += 2; }
                else if (ch === '"') { out.push(ch); i++; state = S_CODE; }
                else { out.push(ch); i++; }
                break;

            case S_TMPL:
                if (ch === '\\') { out.push(ch, next ?? ''); i += 2; }
                else if (ch === '`') { out.push(ch); i++; state = S_CODE; }
                else if (ch === '$' && next === '{') {
                    out.push('${'); i += 2;
                    interpDepths.push(0);  // new interpolation level
                    state = S_CODE;
                }
                else { out.push(ch); i++; }
                break;
        }
    }

    return out.join('');
}


export function parse(tokens) {
    const passages = {};
    let currentPassage = null;
    let currentSlot = null;
    let scriptBuffer = "";

    const nodeStack = [];

    function currentContainer() {
        // return list of nodes
        if (nodeStack.length > 0) return nodeStack[nodeStack.length - 1].children;
        return currentPassage.slots[currentSlot];
    }

    for (const token of tokens) {
        const L = token.line !== undefined ? `[Line ${token.line}] ` : '';
        switch (token.type) {
            case 'PASSAGE_HEADER':
                const headerRegex = /^::\s*([\w-+.]+)(?:\s+\[\s*([\w.+-]+)\s*\])(?:\s+\[(.*?)\])?/
                const pMatch = headerRegex.exec(token.raw);
                const passageId = pMatch[1];
                const layout = pMatch[2];
                if (!layout) throw new Error(`Passage "${passageId}" has no layout specified`);
                const tags = pMatch[3];
                passages[passageId] = {
                    id: passageId,
                    layout: layout,
                    tags: tags ? tags.split(/\s*,\s*/) : [],
                    onEnter: null,
                    afterRendered: null,
                    onExit: null,
                    slots: {}
                };
                currentPassage = passages[passageId];
                break;
            case 'BLOCK_START':
                if (!currentPassage) throw new Error("Block starts outside of passage");
                if (currentSlot) throw new Error("Starting a new block inside another block");
                currentSlot = token.name;

                if (currentSlot === 'onEnter' || currentSlot === 'onExit' || currentSlot === 'afterRendered') {
                    scriptBuffer = "";
                } else {
                    currentPassage.slots[currentSlot] = [];
                };

                break;
            case 'BLOCK_END':
                if (!currentPassage) throw new Error("Block ends outside of passage");
                if (!currentSlot) throw new Error("Ending a block without starting one");

                if (currentSlot === 'onEnter') {
                    currentPassage.onEnter = transformScript(scriptBuffer);
                } else if (currentSlot === 'afterRendered') {
                    currentPassage.afterRendered = transformScript(scriptBuffer);
                } else if (currentSlot === 'onExit') {
                    currentPassage.onExit = transformScript(scriptBuffer);
                }
                currentSlot = null;
                break;

            case 'TEXT':
                if (!currentPassage || !currentSlot) break;

                if (currentSlot === 'onEnter' || currentSlot === 'onExit' || currentSlot === 'afterRendered') {
                    scriptBuffer += token.raw;
                    break;
                }
                const nodes = currentContainer();
                const last = nodes[nodes.length - 1];
                token.raw = token.raw.replace(/(\r\n|\n|\r)/gm, '');
                if (token.raw === '') break;
                if (last && last.type === 'TEXT') {
                    last.value += token.raw;
                } else {
                    currentContainer().push({
                        type: 'TEXT',
                        value: token.raw
                    });
                }
                break;

            case 'IF':
                if (!currentPassage) break;
                if (currentSlot === 'onEnter' || currentSlot === 'onExit' || currentSlot === 'afterRendered') throw new Error(`IF is not allowed in "${currentSlot}`);
                const ifNode = {
                    type: 'IF',
                    branches: [{
                        condition: token.condition,
                        children: []
                    }]
                };

                currentContainer().push(ifNode);
                nodeStack.push(ifNode);
                nodeStack.push(ifNode.branches[0]);
                break;

            case 'ELIF':
                if (!currentPassage) break;
                if (currentSlot === 'onEnter' || currentSlot === 'onExit' || currentSlot === 'afterRendered') throw new Error(`ELIF is not allowed in "${currentSlot}`);
                nodeStack.pop(); // pop previous branch
                const lastIfNodE = nodeStack[nodeStack.length - 1];
                if (!lastIfNodE || lastIfNodE.type !== 'IF') throw new Error(`ELIF without IF`);
                const newBranch = {
                    condition: token.condition,
                    children: []
                };
                lastIfNodE.branches.push(newBranch);
                nodeStack.push(newBranch);
                break;

            case 'ELSE':
                if (!currentPassage) break;
                if (currentSlot === 'onEnter' || currentSlot === 'onExit' || currentSlot === 'afterRendered') throw new Error(`ELSE is not allowed in "${currentSlot}`);
                nodeStack.pop(); // pop previous branch
                const lastIfNode = nodeStack[nodeStack.length - 1];
                if (!lastIfNode || lastIfNode.type !== 'IF') throw new Error(`ELSE without IF`);
                const newBrancH = {
                    condition: null,
                    children: []
                };
                lastIfNode.branches.push(newBrancH);
                nodeStack.push(newBrancH);
                break;

            case 'IF_END':
                if (!currentPassage) break;
                if (currentSlot === 'onEnter' || currentSlot === 'onExit' || currentSlot === 'afterRendered') throw new Error(`IF_END is not allowed in "${currentSlot}`);
                nodeStack.pop();
                const lastIfNoDe = nodeStack.pop();;
                if (!lastIfNoDe || lastIfNoDe.type !== 'IF') throw new Error(`IF_END without IF`);
                break;

            case 'FOR':
                if (!currentPassage) break;
                if (currentSlot === 'onEnter' || currentSlot === 'onExit' || currentSlot === 'afterRendered') throw new Error(`FOR is not allowed in "${currentSlot}`);
                const forNode = {
                    type: 'FOR',
                    k: token.k,
                    v: token.v,
                    iterable: token.iterable,
                    children: []
                };
                currentContainer().push(forNode);
                nodeStack.push(forNode);
                break;

            case 'FOR_END':
                if (!currentPassage) break;
                if (currentSlot === 'onEnter' || currentSlot === 'onExit' || currentSlot === 'afterRendered') throw new Error(`FOR_END is not allowed in "${currentSlot}`);
                const lastForNode = nodeStack.pop();
                if (!lastForNode || lastForNode.type !== 'FOR') throw new Error(`FOR_END without FOR`);
                break;

            case 'EXPRESSION':
                if (!currentPassage) break;
                if (currentSlot === 'onEnter' || currentSlot === 'onExit' || currentSlot === 'afterRendered') throw new Error(`EXPRESSION is not allowed in "${currentSlot}`);
                currentContainer().push({
                    type: 'EXPRESSION',
                    expr: token.expr
                });
                break;

            case 'LINK':
                if (!currentPassage) break;
                if (currentSlot === 'onEnter' || currentSlot === 'onExit' || currentSlot === 'afterRendered') throw new Error(`LINK is not allowed in "${currentSlot}`);

                currentContainer().push({
                    type: 'LINK',
                    value: token.raw,
                    nextPassage: token.nextPassage ? token.nextPassage.replace(/^["']|["']$/g, '') : currentPassage.id,
                    content: transformScript(token.content)
                });
                break;

            default:
                throw new Error(`Unknown token type "${token.type}"`);
        }
    }
    return passages;
}