const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
let response, abortRequest=false, timeoutCallback, clears=0, writes=[];
const ex={};
vm.runInNewContext(compile(fs.readFileSync('src/lib/services/embroideryVoucherService.ts','utf8')),{
 exports:ex,AbortController,console,setTimeout(cb){timeoutCallback=cb;return 1},clearTimeout(){clears++},
 require(name) {
   if (!name.includes('supabase/client')) return {};
   return {createClient() { return {from(table) {
     writes.push(table);
     const query = {
       delete(options) { assert.equal(options.count, 'exact'); return query; },
       eq(k, id) { assert.equal(k, 'id'); return query; },
       abortSignal(signal) {
         if (abortRequest) { timeoutCallback(); return Promise.resolve({error:{message:'aborted'}, count:null}); }
         return Promise.resolve(response);
       }
     };
     return query;
   } }; } };
 },
});
const modal=fs.readFileSync('src/app/embroidery-accessory/components/EmbroideryContent.tsx','utf8');
const ast=ts.createSourceFile('form.tsx',modal,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const functions={};function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text.startsWith('handleDelete'))functions[n.name.text]=n.getText(ast);ts.forEachChild(n,visit)}visit(ast);
(async()=>{
 for(const kind of ['Issue','Receive']){
  const call=()=>ex.embroideryVoucherService[`delete${kind}Voucher`]('voucher-id');
  response={error:null,count:1};assert.equal(await call(),true);
  response={error:{code:'42501',message:'permission denied'},count:null};await assert.rejects(call(),e=>e.code==='42501');
  response={error:{code:'P0001',message:'Protected linked voucher'},count:null};await assert.rejects(call(),e=>e.message==='Protected linked voucher');
  response={error:null,count:0};await assert.rejects(call(),/not confirmed/);
  response={error:null,count:null};await assert.rejects(call(),/not confirmed/);
  abortRequest=true;await assert.rejects(call(),/timed out/);abortRequest=false;
  let busy=false,error='',closed=false,success='',refreshes=0;
  const ctx={console,setTimeout(){},erpErrorMessage:e=>e.message,embroideryVoucherService:{[`delete${kind}Voucher`]:async()=>{throw new Error('Protected linked voucher')}},[`delete${kind}Target`]:{id:'id'},[`deleting${kind}`]:false,[`setDeleting${kind}`]:v=>busy=v,[`setDelete${kind}Error`]:v=>error=v,[`setDelete${kind}Target`]:v=>closed=v===null,setSuccessMsg:v=>success=v,loadVouchers:async()=>{refreshes++},loadFabricsAndAccounts:async()=>{refreshes++}};
  vm.createContext(ctx);vm.runInContext(compile(functions[`handleDelete${kind}Voucher`]),ctx);
  await ctx[`handleDelete${kind}Voucher`]();assert.equal(busy,false);assert.equal(error,'Protected linked voucher');assert.equal(closed,false);assert.equal(success,'');
  ctx.embroideryVoucherService[`delete${kind}Voucher`]=async()=>true;
  await ctx[`handleDelete${kind}Voucher`]();assert.equal(busy,false);assert.equal(error,'');assert.equal(closed,true);assert.equal(refreshes,2);assert(success.includes('deleted successfully'));
 }
 assert.equal(clears,12);
 assert(writes.every(t=>['emb_issue_vouchers','emb_receive_vouchers'].includes(t)));
 console.log('PASS: issue/receive errors retain database reason; zero/null counts never succeed; timeout requires reconciliation; busy always clears; success refreshes vouchers and fabric; no protection changes.');
})().catch(e=>{console.error(e);process.exit(1)});
