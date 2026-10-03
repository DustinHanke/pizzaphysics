import {build} from 'esbuild';
import {mkdirSync,rmSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const directory=resolve('node_modules/.cache/physics-tests');mkdirSync(directory,{recursive:true});
const names=process.argv.slice(2),tests=names.length?names:readdirSync('tests').filter(n=>n.endsWith('.ts')).map(n=>n.slice(0,-3)).sort();
let failed=0;
for(const name of tests){
 if(!/^[a-z0-9-]+$/.test(name))throw new Error(`Invalid test name: ${name}`);
 const output=resolve(directory,`${name}.mjs`);
 try{
  await build({entryPoints:[`tests/${name}.ts`],outfile:output,bundle:true,platform:'node',format:'esm',packages:'external'});
  const result=spawnSync(process.execPath,[output],{encoding:'utf8',timeout:180000});
  process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');
  if(result.status!==0){failed++;console.error(`FAIL ${name}: ${result.error?.message??result.signal??result.status}`);}else console.log(`PASS ${name}`);
 }catch(error){failed++;console.error(`FAIL ${name}: ${error.message}`);}finally{rmSync(output,{force:true});}
}
console.log(`${tests.length-failed}/${tests.length} test files passed`);process.exitCode=failed?1:0;
