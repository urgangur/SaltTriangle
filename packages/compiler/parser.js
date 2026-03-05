export function parse(tokens) {
    const passages = {};
    let currentPassage = null;
    let stack = [];

    for (const token of tokens) {
        switch (token.type) {
            case "PASSAGE_HEADER":
                const headerRegex = /^::\s*([\w-+.]+)(?:\s+\[([\w.+-]+)\])(?:\s+\[(.*?)\])?/
                const match = headerRegex.exec(token.raw);
                const passageId = match[1];
                const layout = match[2];
                if (!layout) throw new Error('Passage "${passageId}" has no layout specified');
                const tags = match[3];
                currentPassage = {
                    id: passageId,
                    layout: layout,
                    tags: tags.split(/\s*,\s*/),
                    onEnter: "",
                    onExit: "engine.clearTemp();",
                    slots: {}
                };
                passages[passageId] = currentPassage;
                break;
            case "BLOCK_START":
                if (!currentPassage) throw new Error("Block starts outside of passage");
                const blockName = token.raw.slice(2, -1);
                if (blockName === "onEnter") {
                    stack.push
                }
                else if (blockName === "onExit") {
                    stack.push
                }
                else {
                    stack.push
                };
                break;
            case "BLOCK_END":
                stack.pop
        }
    }
}