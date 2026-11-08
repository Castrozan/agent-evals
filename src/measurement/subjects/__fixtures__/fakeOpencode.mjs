#!/usr/bin/env node
const port = process.argv[process.argv.indexOf("--port") + 1];
console.log(`server listening on http://127.0.0.1:${port}`);
setInterval(() => {}, 1000);
