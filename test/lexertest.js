import fs from "fs"
import { tokenize } from "../packages/compiler/lexer.js"

const input = fs.readFileSync("test/lexer_testcase/allinone.st", "utf8")

console.log(tokenize(input))