// AI-generated

export function printStats(passages) {
    const passageKeys = Object.keys(passages);
    const numPassages = passageKeys.length;

    let totalLinks = 0;
    let charCounts = [];

    for (const key of passageKeys) {
        const passage = passages[key];
        let pCharCount = 0;

        function walk(nodes) {
            for (const node of nodes) {
                if (node.type === 'TEXT') {
                    const text = node.value.replace(/\s+/g, '');
                    pCharCount += text.length;
                } else if (node.type === 'LINK') {
                    totalLinks++;
                    let val = node.value;
                    // strip quotes if it's a literal string
                    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                        val = val.slice(1, -1);
                        pCharCount += val.replace(/\s+/g, '').length;
                    }
                } else if (node.type === 'IF') {
                    for (const branch of node.branches) {
                        walk(branch.children);
                    }
                } else if (node.type === 'FOR') {
                    walk(node.children);
                }
            }
        }

        for (const slotName in passage.slots) {
            walk(passage.slots[slotName]);
        }

        charCounts.push(pCharCount);
    }

    const totalChars = charCounts.reduce((a, b) => a + b, 0);

    charCounts.sort((a, b) => a - b);
    const getPercentile = (p) => {
        if (numPassages === 0) return 0;
        const index = Math.ceil((p / 100) * numPassages) - 1;
        return charCounts[Math.max(0, index)];
    };
    const p10 = getPercentile(10);
    const p25 = getPercentile(25);
    const max = charCounts[charCounts.length - 1] || 0;
    const avg = numPassages > 0 ? (totalChars / numPassages).toFixed(2) : 0;
    let median = 0;
    if (numPassages > 0) {
        const mid = Math.floor(numPassages / 2);
        if (numPassages % 2 === 0) {
            median = (charCounts[mid - 1] + charCounts[mid]) / 2;
        } else {
            median = charCounts[mid];
        }
    }

    const reset = "\x1b[0m";
    const bright = "\x1b[1m";
    const fgCyan = "\x1b[36m";
    const fgGreen = "\x1b[32m";
    const fgYellow = "\x1b[33m";

    console.log("");
    console.log(`${bright}${fgCyan}=========================================${reset}`);
    console.log(`${bright}Story Statistics${reset}`);
    console.log(`${bright}${fgCyan}=========================================${reset}`);
    console.log(`${bright}Passages : ${fgGreen}${numPassages}${reset}`);
    console.log(`${bright}Words    : ${fgGreen}${totalChars}${reset} (Displayed Characters)`);
    console.log(`${bright}Links    : ${fgGreen}${totalLinks}${reset}`);
    console.log(`${fgCyan}-----------------------------------------${reset}`);
    console.log(`${bright}Words per Passage:${reset}`);
    console.log(`   10%    : ${fgYellow}${p10}${reset}`);
    console.log(`   25%    : ${fgYellow}${p25}${reset}`);
    console.log(`   Avg    : ${fgYellow}${avg}${reset}`);
    console.log(`   Median : ${fgYellow}${median}${reset}`);
    console.log(`   Max    : ${fgYellow}${max}${reset}`);
    console.log(`${bright}${fgCyan}=========================================${reset}`);
    console.log("");
}
