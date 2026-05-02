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
  <script>
    const engine = new STEngine(passages);
    engine.startGame();
  </script>
</body>
</html>
`