// AI generated code.

class EvalExprError extends Error {
  constructor(code, message, pos) {
    super(`${code}: ${message} @${pos ?? "?"}`);
    this.code = code;
    this.pos = pos;
  }
}

// =========================
// Tokenizer
// =========================
const KEYWORDS = new Set(["function", "class", "new"]);
const FORBIDDEN = /[{};]/;

function tokenize(input) {
  const tokens = [];
  let i = 0;

  const error = (msg) => {
    throw new EvalExprError("TOKEN_INVALID", msg, i);
  };

  while (i < input.length) {
    let c = input[i];

    if (/\s/.test(c)) {
      i++;
      continue;
    }

    // forbidden
    if (FORBIDDEN.test(c)) error(`Forbidden char '${c}'`);

    // number
    if (/\d/.test(c)) {
      let start = i;
      while (/\d/.test(input[i])) i++;
      if (input[i] === ".") {
        i++;
        while (/\d/.test(input[i])) i++;
      }
      tokens.push({ type: "NUMBER", value: Number(input.slice(start, i)) });
      continue;
    }

    // string
    if (c === '"' || c === "'") {
      let quote = c;
      i++;
      let start = i;
      while (i < input.length && input[i] !== quote) i++;
      if (input[i] !== quote) error("Unclosed string");
      const str = input.slice(start, i);
      i++;
      tokens.push({ type: "STRING", value: str });
      continue;
    }

    // boolean
    if (input.startsWith("true", i)) {
      tokens.push({ type: "BOOLEAN", value: true });
      i += 4;
      continue;
    }
    if (input.startsWith("false", i)) {
      tokens.push({ type: "BOOLEAN", value: false });
      i += 5;
      continue;
    }

    // keyword block
    for (const kw of KEYWORDS) {
      if (input.startsWith(kw, i)) {
        error(`Forbidden keyword '${kw}'`);
      }
    }

    // PATH ($ / _)
    if (c === "$" || c === "_") {
      const { node, next } = parsePath(input, i);
      tokens.push(node);
      i = next;
      continue;
    }

    // operators (multi first)
    const two = input.slice(i, i + 2);
    if (
      ["&&", "||", "==", "!=", ">=", "<="].includes(two)
    ) {
      tokens.push({ type: "OP", value: two });
      i += 2;
      continue;
    }

    // single operators
    if ("+-*/%><!".includes(c)) {
      tokens.push({ type: "OP", value: c });
      i++;
      continue;
    }

    // parentheses
    if (c === "(") {
      tokens.push({ type: "LPAREN" });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ type: "RPAREN" });
      i++;
      continue;
    }

    error(`Unknown char '${c}'`);
  }

  return tokens;
}

// =========================
// PATH PARSER
// =========================

function parsePath(input, start) {
  let i = start;
  const root = input[i]; // $ or _
  i++;

  const segments = [];

  const error = (msg) => {
    throw new EvalExprError("INVALID_PATH", msg, i);
  };

  function readIdentifier() {
    let s = "";
    while (i < input.length && /[a-zA-Z0-9_$]/.test(input[i])) {
      s += input[i++];
    }
    return s;
  }

  // first identifier
  let id = readIdentifier();
  if (!id) error("Expected identifier after $/_");
  segments.push({ type: "prop", key: id });

  while (true) {
    let c = input[i];

    if (c === ".") {
      i++;
      let key = readIdentifier();
      if (!key) error("Invalid property");
      segments.push({ type: "prop", key });
      continue;
    }

    if (c === "[") {
      const { expr, next } = parseBracketExpression(input, i);
      segments.push({ type: "index", expr });
      i = next;
      continue;
    }

    break;
  }

  return {
    node: { type: "PATH", root, segments },
    next: i,
  };
}

// parse [ ... ]
function parseBracketExpression(input, start) {
  let i = start + 1;
  let depth = 1;
  let inner = "";

  while (i < input.length) {
    if (input[i] === "[") depth++;
    else if (input[i] === "]") {
      depth--;
      if (depth === 0) break;
    }
    inner += input[i];
    i++;
  }

  if (depth !== 0) {
    throw new EvalExprError("UNMATCHED_BRACKET", "Missing ]", i);
  }

  const tokens = tokenize(inner);
  const rpn = toRPN(tokens);

  return {
    expr: rpn,
    next: i + 1,
  };
}

// =========================
// Shunting-yard → RPN
// =========================

const PRECEDENCE = {
  "!": 7,
  "*": 6,
  "/": 6,
  "%": 6,
  "+": 5,
  "-": 5,
  ">": 4,
  "<": 4,
  ">=": 4,
  "<=": 4,
  "==": 3,
  "!=": 3,
  "&&": 2,
  "||": 1,
};

function toRPN(tokens) {
  const output = [];
  const stack = [];

  let prev = null;

  for (const token of tokens) {
    if (
      token.type === "NUMBER" ||
      token.type === "STRING" ||
      token.type === "BOOLEAN" ||
      token.type === "PATH"
    ) {
      output.push(token);
      prev = token;
      continue;
    }

    if (token.type === "OP") {
      let op = token.value;

      // unary !
      if (op === "!") {
        if (!prev || prev.type === "OP" || prev.type === "LPAREN") {
          op = "!";
        }
      }

      while (
        stack.length &&
        stack[stack.length - 1].type === "OP" &&
        PRECEDENCE[stack[stack.length - 1].value] >= PRECEDENCE[op]
      ) {
        output.push(stack.pop());
      }

      stack.push({ type: "OP", value: op });
      prev = token;
      continue;
    }

    if (token.type === "LPAREN") {
      stack.push(token);
      prev = token;
      continue;
    }

    if (token.type === "RPAREN") {
      while (stack.length && stack[stack.length - 1].type !== "LPAREN") {
        output.push(stack.pop());
      }
      if (!stack.length) {
        throw new EvalExprError("UNMATCHED_PAREN", ")");
      }
      stack.pop();
      prev = token;
      continue;
    }
  }

  while (stack.length) {
    if (stack[stack.length - 1].type === "LPAREN") {
      throw new EvalExprError("UNMATCHED_PAREN", "(");
    }
    output.push(stack.pop());
  }

  return output;
}

// =========================
// Evaluator
// =========================

function evaluateRPN(rpn, ctx) {
  const stack = [];

  for (const token of rpn) {
    if (token.type === "NUMBER" || token.type === "STRING" || token.type === "BOOLEAN") {
      stack.push(token.value);
      continue;
    }

    if (token.type === "PATH") {
      stack.push(resolvePath(token, ctx));
      continue;
    }

    if (token.type === "OP") {
      if (token.value === "!") {
        const a = stack.pop();
        stack.push(!a);
        continue;
      }

      const b = stack.pop();
      const a = stack.pop();

      stack.push(applyOp(token.value, a, b));
    }
  }

  return stack.pop();
}

// =========================
// Operators
// =========================

function applyOp(op, a, b) {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "*": return a * b;
    case "/": return a / b;
    case "%": return a % b;
    case ">": return a > b;
    case "<": return a < b;
    case ">=": return a >= b;
    case "<=": return a <= b;
    case "==": return a === b;
    case "!=": return a !== b;
    case "&&": return a && b;
    case "||": return a || b;
    default:
      throw new EvalExprError("UNKNOWN_OPERATOR", op);
  }
}

// =========================
// Sandbox resolve
// =========================

function guard(key) {
  if (
    key === "__proto__" ||
    key === "constructor" ||
    key === "prototype"
  ) {
    throw new EvalExprError("ACCESS_DENIED", key);
  }
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function resolvePath(path, ctx) {
  let obj = path.root === "$" ? ctx.variables : ctx.variables.__temp;

  for (const seg of path.segments) {
    if (obj == null) return undefined;

    if (seg.type === "prop") {
      guard(seg.key);
      if (!hasOwn(obj, seg.key)) return undefined;
      obj = obj[seg.key];
    }

    if (seg.type === "index") {
      const key = evaluateRPN(seg.expr, ctx);

      if (typeof key !== "number" && typeof key !== "string") {
        throw new EvalExprError("INVALID_INDEX_TYPE", key);
      }

      guard(key);

      if (!hasOwn(obj, key)) return undefined;
      obj = obj[key];
    }
  }

  return obj;
}

const stEvalExpr = function (input, ctx) {
  const tokens = tokenize(input);
  const rpn = toRPN(tokens);
  return evaluateRPN(rpn, ctx);
}