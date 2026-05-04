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
  {{STATE}}
  {{LAYOUTS}}
  {{PASSAGES}}
  {{SCRIPTS}}
  <script defer>
    (function () {
      function wait() {
          if (!(window.__EngineReady)) {
            return setTimeout(wait, 0);
          }

          const engine = new STEngine(STPassages);
          engine.startGame();
        }

      wait();
      })();
  </script>
</body>
</html>
`