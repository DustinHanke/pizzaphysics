import {build} from 'esbuild';
import {mkdirSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const directory=resolve('node_modules/.cache/physics-tests');mkdirSync(directory,{recursive:true});
for(const name of process.argv.slice(2)){
 const output=resolve(directory,`${name}.mjs`);
 await build({entryPoints:[`tests/${name}.ts`],outfile:output,bundle:true,platform:'node',format:'esm',packages:'external',banner:{js:"globalThis.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});"}});
 try{process.stdout.write(execFileSync(process.execPath,[output],{encoding:'utf8',timeout:180000}));}finally{rmSync(output,{force:true});}
}
