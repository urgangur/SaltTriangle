export const templateHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>{{TITLE}}</title>
  {{ICON}}
  {{CSS}}
</head>
<body>
  <div id="st-main"></div>
  {{ENGINE}}
  {{EVALEXPR}}
  {{STATE}}
  {{LAYOUTS}}
  {{PASSAGES}}
  {{SCRIPTS}}
  <script defer>
    (function () {
      function wait() {
          if (!(window.__EvalexprReady && window.__EngineReady)) {
            return setTimeout(wait, 0);
          }

          const engine = new STEngine(passages);
          engine.startGame();
        }

      wait();
      })();
  </script>
</body>
</html>
`