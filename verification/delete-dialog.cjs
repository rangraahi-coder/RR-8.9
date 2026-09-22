const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('node:assert/strict');
const state=[];let cursor=0;
const hooks={useState(initial){const n=cursor++;if(!(n in state))state[n]=initial;return [state[n],v=>state[n]=v]},useRef(initial){const n=cursor++;if(!(n in state))state[n]={current:initial};return state[n]}};
const jsx=(type,props)=>({type,props});const exportsObj={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/ui/RecordDeleteDialog.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,{exports:exportsObj,require:n=>n==='react'?hooks:n==='react/jsx-runtime'?{jsx,jsxs:jsx}:{erpErrorMessage:e=>e.message}});
let calls=0,cancelled=0,resolve;
const props={records:[{id:'row-1',reference:'JC-1',details:'Kurta 100'}],lang:'en',onCancel:()=>cancelled++,onConfirm:()=>{calls++;return new Promise(r=>resolve=r)}};
function render(){cursor=0;return exportsObj.default(props)}
function nodes(t){return [t,...[t?.props?.children].flat(Infinity).filter(v=>v&&typeof v==='object').flatMap(nodes)]}
(async()=>{
 let tree=nodes(render());let input=tree.find(n=>n.type==='input');let button=tree.find(n=>n.type==='button'&&n.props.children==='Delete permanently');
 assert.equal(button.props.disabled,true);button.props.onClick();assert.equal(calls,0);
 input.props.onChange({target:{value:'DELETE'}});tree=nodes(render());button=tree.find(n=>n.type==='button'&&n.props.children==='Delete permanently');button.props.onClick();button.props.onClick();assert.equal(calls,1);
 assert.equal(nodes(render()).find(n=>n.type==='input').props.disabled,true);resolve();await new Promise(r=>setTimeout(r,0));
 props.onConfirm=async()=>{throw Error('Linked voucher prevents deletion')};nodes(render()).find(n=>n.type==='button'&&n.props.children==='Delete permanently').props.onClick();await new Promise(r=>setTimeout(r,0));
 tree=nodes(render());assert.equal(tree.find(n=>n.props?.role==='alert').props.children,'Linked voucher prevents deletion');assert.equal(tree.find(n=>n.type==='input').props.disabled,false);
 tree.find(n=>n.type==='button'&&n.props.children==='Cancel').props.onClick();assert.equal(cancelled,1);
 console.log('PASS: no request without typed confirmation; concurrent clicks send one request; errors keep dialog open and restore controls; cancel is separate');
})();
