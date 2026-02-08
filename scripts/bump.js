const fs = require('fs');
const v = process.argv[2];
if (!v) { console.error('Usage: node bump.js <version>'); process.exit(1); }

function bump(file, re, tpl) {
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(re, tpl));
}

bump('CMakeLists.txt', /THIRD_EYE_VERSION "[^"]+"/g, 'THIRD_EYE_VERSION "' + v + '"');
bump('ui/package.json', /"version": "[^"]+"/g, '"version": "' + v + '"');
bump('src/http_server.cpp', /THIRD_EYE_VERSION "[^"]+"/g, 'THIRD_EYE_VERSION "' + v + '"');
console.log('  Bumped to ' + v);
