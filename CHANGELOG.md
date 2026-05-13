# v0.2.1 [2026/5/11]
Added
 - API: add getSaveMeta function
Changed
 - Script Block: would not fetch engine but only api
 - Autosave: would not auto save when passage.tags includes "nosave"
Fixed
 - Core Logics: fix FOR node not being handled correctly
 - Lexer: fix EXPRESSION node not handle correctly at some cases

# v0.2.0 [2026/5/10]
Added
 - API: implement save, load, import, export functions
Changed
 - Core Logics: modify script block implementation
Fixed
 - Engine: fix engine not being registered globally
Style
 - Codebase: update formatting and comments

# v0.1.4 [2026/5/5]
Fixed
 - Core Logics: fix LINK node inside IF node not being handled correctly

# v0.1.3 [2026/5/4]
Added
 - Project: upload package-lock.json
Changed
 - Build: change build process to use SEA
Fixed
 - Core Logics: fix stEvalExpr unable to read variables and while loop unable to break

# v0.1.2 [2026/5/4]
Fixed
 - Core Logics: fix LINK action not working

# v0.1.1 [2026/5/3]
Added
 - Core Logics: add afterRendered hook
 - Docs: add partial documentation
Fixed
 - UI: fix extra `"` being displayed

# v0.1.0 [2026/5/1]
Added
 - Core Logics: implement basic ST language
    - IF、FOR、EXPRESSION nodes
    - LINK node 
    - onEnter、onExit hooks
 - Layout System: support for processing user-defined layouts
 - Module System: support for processing user-defined modules
 - Build System: initial setup