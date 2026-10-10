import {build} from 'esbuild';
import {mkdirSync,copyFileSync} from 'node:fs';
mkdirSync('dist',{recursive:true});
await build({entryPoints:['client/app.jsx'],bundle:true,outfile:'dist/app.js',minify:true});
copyFileSync('client/index.html','dist/index.html');
copyFileSync('client/style.css','dist/style.css');
