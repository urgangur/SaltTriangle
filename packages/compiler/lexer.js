function isEscaped(input, index) {
    let backslashCount = 0;
    while (index > 0 && input[index - 1] === "\\") {
        backslashCount++;
        index--;
    }
    return backslashCount % 2 === 1;
}

export function tokenize(input) {
    const tokens = [];
    const patterns = [
        // passage header
        { type: "PASSAGE_HEADER", reg: /^::\s*([\w-+.]+)(?:\s+\[([\w.+-]+)\])?(?:\s+\[(.*?)\])?/ },
        // @{...}
        { type: "BLOCK_END", reg: /^@\{end\}/ },
        { type: "BLOCK_START", reg: /^@\{[\w-+.]+\}/ },
        // control flow
        { type: "IF", reg: /^\$\{\s*if\s+(.*?)\}/ },
        { type: "ELIF", reg: /^\$\{\s*elif\s+(.*?)\}/ },
        { type: "ELSE", reg: /^\$\{\s*else\}/ },
        { type: "IF_END", reg: /^\$\{\s*\/if\}/ },

        { type: "FOR", reg: /^\$\{\s*for\s+(_\w+)\s*,\s*(_\w+)\s+in\s+(.*?)\}/ },
        { type: "FOR_END", reg: /^\$\{\s*\/for\}/ },
        // expression
        { type: "EXPRESSION", reg: /^\$\{\s*=(.*?)\}/ },
        // link #{text|passageId(optional)}{codeBlock}
        { type: "LINK", reg: /^\#\{("[^"]+"|'[^']+'|\$[\w.\[\]\$"']+|\_[\w.\[\]\$"']+)(?:\|("[^"]+"|'[^']+'|\$[\w.\[\]\$"']+|\_[\w.\[\]\$"']+))?\}/ },
        // comments /**/ and //
        { type: "COMMENT", reg: /^(\/\/.*|\/\*[\s\S]*?\*\/)/ }
    ];

    let cursor = 0;
    while (cursor < input.length) {
        let match = null;
        let substring = input.slice(cursor);
        for (const pattern of patterns) {
            match = substring.match(pattern.reg);
            if (match) {
                if (pattern.type === "LINK") {
                    cursor += match[0].length;
                    substring = input.slice(cursor);
                    if (!substring.startsWith("{")) throw new Error("Invalid link syntax");
                    let depth = 1;
                    let i = 1;
                    let inString = null;
                    while (i < substring.length) {
                        const ch = substring[i];
                        if (ch === "'"|| ch === '"') {
                            if (!inString) inString = ch;
                            else if (inString === ch && !isEscaped(substring, i)) inString = null;
                        }
                        if (!inString) {
                            if (ch === "{") depth++;
                            else if (ch === "}") depth--;
                        }
                        if (depth === 0) break;
                        i++;
                    };
                    if (depth!== 0) throw new Error("Unclosed link code block");
                    tokens.push({
                        type: "LINK",
                        raw: match[0],
                        content: substring.slice(1, i),
                    });
                    cursor += i;
                    break;
                }
                else if (pattern.type !== "COMMENT") {
                    tokens.push({
                        type: pattern.type,
                        raw: match[0],
                    });
                    cursor += match[0].length;
                }
                break;
            };
        }
        if (!match) {
            const nextSpecialChar = substring.slice(1).search(/::|@\{|\$\{|\#\{|\/\/|\/\*/);
            const textLen = (nextSpecialChar === -1) ? substring.length : nextSpecialChar;
            tokens.push({
                type: "TEXT",
                raw: substring.slice(0, textLen)
            });
            cursor += textLen;
        }
    }
    return tokens;
}