const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('node:assert/strict');
let response={data:null,error:null},written;
const client={from(){return {insert(row){written=row;return this},update(row){written=row;return this},eq(){return this},select(){return this},single:async()=>response}}};
const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/services/jobCardService.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:out,require:()=>({createClient:()=>client}),console});
(async()=>{const service=out.jobCardService;
assert.equal(await service.create({}),null);assert.equal(await service.update('a',{stage:'stitching'}),null);
response={data:null,error:{message:'Permission denied'}};assert.equal(await service.create({}),null);
response={data:{id:'a',stage:'stitching'},error:null};const saved=await service.update('a',{stage:'stitching'});assert.equal(saved.id,'a');assert.equal(saved.stage,'stitching');assert.equal(Object.keys(written).join(','),'stage');
console.log('PASS: missing/error database responses do not produce saved records; stage update preserves unrelated fields');})();
