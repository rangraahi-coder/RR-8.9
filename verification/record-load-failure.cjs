const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('node:assert/strict');
let fail=true,deleted=[];
const client={from(){return {select(){return this},order(){return Promise.resolve({data:[],error:fail?{message:'network/session failed'}:null})},delete(){return {eq(){return this},in(){return this},select:async()=>({data:deleted,error:null})}}}}};
function load(file){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:out,require:()=>({createClient:()=>client,isSchemaError:()=>false}),console});return out;}
(async()=>{const j=load('src/lib/services/jobCardService.ts').jobCardService,s=load('src/lib/services/salesOrderService.ts').salesOrderService;
await assert.rejects(()=>j.getAll(),/network\/session failed/);await assert.rejects(()=>s.getAll(),/network\/session failed/);
fail=false;assert.equal((await j.getAll()).length,0);assert.equal((await s.getAll()).length,0);
assert.equal(await j.delete('a'),false);assert.equal(await j.deleteMany(['a','b']),false);deleted=[{id:'a'}];assert.equal(await j.delete('a'),true);assert.equal(await j.deleteMany(['a','b']),false);deleted.push({id:'b'});assert.equal(await j.deleteMany(['a','b']),true);
console.log('PASS: failed loads reject instead of false empty lists; genuine empty response supported; deletion success requires affected rows');})();
