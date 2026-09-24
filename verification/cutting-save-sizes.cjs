const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');
const source=fs.readFileSync('src/app/cutting/components/CuttingContent.tsx','utf8'),ast=ts.createSourceFile('cutting.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function definition(name){let found;function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text===name)found=n.getText(ast);if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name)found='const '+name+' = '+n.initializer.getText(ast)+';';ts.forEachChild(n,visit)}visit(ast);assert.ok(found,name);return ts.transpileModule(found,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;}
const defaults=definition('makeDefaultRoll')+definition('makeDefaultSubComponent')+definition('newComponentForJob');
const create=new Function('jobCards','form','subComponents','SIZE_OPTIONS',defaults+'return newComponentForJob;')([{jobCardRef:'J1',sizes:['4XL','5XL','6XL']}],{jobCardRef:'J1'},[{sizes:[{size:'XS'}]}],['XS','M']);
const first=create(),second=create();assert.deepEqual(first.sizes.map(s=>s.size),['4XL','5XL','6XL']);assert.ok(first.sizes.every(s=>s.qty===''));first.sizes[0].qty='50';assert.equal(second.sizes[0].qty,'');assert.notEqual(first.id,second.id);
const fallback=new Function('jobCards','form','subComponents','SIZE_OPTIONS',defaults+'return newComponentForJob;')([],{jobCardRef:'old'},[{sizes:[{size:'CUSTOM'}]}],['XS']);assert.equal(fallback().sizes[0].size,'CUSTOM');
let error='',busy=false,calls=0;const lock={current:false};
const component={component:'Kurta',customComponent:'',cuttingRate:'3',sizes:[{size:'S',qty:'500'}],rolls:[{processReceiptId:'r',processReceiptNo:'ERV-0005',cutParts:[],fabricRollId:'roll',fabricConsumedQty:'18'}]};
const submit=new Function('saveInFlight','setSaveError','subComponents','form','hasValidationErrors','quantityValidationErrors','setSaving','supabase','editingEntry','erpErrorMessage',definition('resolvedCutParts')+definition('handleSubmit')+'return handleSubmit;')(lock,v=>error=v,[component],{date:'2026-09-24',jobCardRef:'J1',styleName:'Item',cuttingMaster:'Master'},false,{},v=>busy=v,{rpc:async()=>{calls++;return {error:Error('Server access failure')}}},null,e=>e.message);
(async()=>{await submit({preventDefault(){}});assert.match(error,/Kurta.*ERV-0005/);assert.match(error,/Add another part/);assert.equal(calls,0);assert.equal(lock.current,false);component.rolls[0].cutParts=[{name:'Border',qty:'500'}];await submit({preventDefault(){}});assert.equal(error,'Server access failure');assert.equal(calls,1);assert.equal(busy,false);assert.equal(lock.current,false);
assert.match(source,/role="alert"[^>]*id="cutting-save-feedback"/);assert.match(source,/onInvalidCapture/);assert.ok(source.indexOf('id="cutting-save-feedback"')>source.indexOf('Cutting table average'));
console.log('PASS Job Card sizes on new components, independent blank quantities, saved-size fallback, missing receipt parts feedback, server error and saving reset');})().catch(e=>{console.error(e);process.exitCode=1});

const resolve=new Function(definition('resolvedCutParts')+'return resolvedCutParts;')();
const partComponent={component:'Border',rolls:[{}],sizes:[{qty:'100'},{qty:'400'}]};const partRoll={processReceiptId:'r'};
assert.deepEqual(resolve(partComponent,partRoll),[{name:'Border',qty:'500'}]);
assert.deepEqual(resolve({...partComponent,rolls:[{},{}]},partRoll),[]);
assert.deepEqual(resolve({...partComponent,component:'Kurta'},partRoll),[]);
assert.deepEqual(resolve(partComponent,{...partRoll,cutParts:[{name:'Yoke',qty:'25'}]}),[{name:'Yoke',qty:'25'}]);
console.log('PASS single-roll Border quantity defined once; multiple-roll allocation and explicit parts retained');
