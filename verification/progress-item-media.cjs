const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');
const m={exports:{}};new Function('exports',ts.transpileModule(fs.readFileSync('src/lib/progressItemMedia.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(m.exports);
const resolve=m.exports.progressItemMedia;
const styles=[{id:'s',style_no:'1B26KPTDR200'}], variants=[{id:'red',style_id:'s',colour:'MAROON',variant_image_url:'https://example.com/red.png',measurement_sheet_url:'https://example.com/red.xlsx'},{id:'black',style_id:'s',colour:'BLACK',variant_image_url:'https://example.com/black.png',measurement_sheet_url:'https://example.com/black.xlsx'}];
let r=resolve({style_en:'1B26KPTDR200 – MAROON'},styles,variants);assert.equal(r.image,variants[0].variant_image_url);assert.deepEqual(r.sheets.map(s=>s.id),['red']);
r=resolve({item_style_id:'s',colors:['BLACK']},styles,variants);assert.equal(r.image,variants[1].variant_image_url);assert.equal(r.sheets[0].id,'black');
assert.equal(resolve({item_style_id:'missing',style_en:styles[0].style_no},styles,variants).image,'');
assert.equal(resolve({style_en:styles[0].style_no},[...styles,{...styles[0],id:'other'}],variants).image,'');
assert.equal(resolve({item_style_id:'s'},styles,variants).sheets.length,2);
assert.equal(resolve({id:'j'},styles,[{...variants[0],linked_job_card_id:'j'}]).image,variants[0].variant_image_url);
assert.equal(resolve({item_style_id:'s',colors:['BLUE']},styles,variants).sheets.length,0);
assert.equal(resolve({item_style_id:'s'},styles,[{...variants[0],measurement_sheet_url:'javascript:alert(1)'}]).sheets.length,0);
assert.equal(resolve({item_style_id:'s',colors:['MAROON']},styles,[{...variants[0],measurement_sheet_url:'https://example.com/replaced.xlsx'}]).sheets[0].url,'https://example.com/replaced.xlsx');
console.log('PASS dashboard legacy label, direct links, colour isolation, ambiguous/missing links, sheet replacement, multiple sheets and URL safety');
// Reproduce the supplied diagnostic metadata: PEACH item code, PINK variant colour.
const peachStyles=[{id:'peach',style_no:'7610SKDPC-PEACH'}];
const peachVariant={id:'peach-row',style_id:'peach',style_no:'7610SKDPC-PEACH',colour:'PINK',colour_normalized:'pink',variant_image_url:'https://example.com/peach.png',measurement_sheet_url:'https://example.com/peach.pdf'};
r=resolve({job_card_no:'JC-2026-501213',style_en:'7610SKDPC-PEACH',colors:['Peach']},peachStyles,[peachVariant]);assert.equal(r.image,peachVariant.variant_image_url);assert.equal(r.sheets[0].url,peachVariant.measurement_sheet_url);assert.match(r.problem,/differs/);
// A nearby code is a different item; a duplicated full variant identity is ambiguous.
assert.equal(resolve({style_en:'7610PSKDPC-PEACH',colors:['Peach']},peachStyles,[peachVariant]).image,'');
assert.equal(resolve({style_en:'7610SKDPC-PEACH',colors:['Peach']},peachStyles,[peachVariant,{...peachVariant,id:'duplicate'}]).sheets.length,0);
// Never select a wrong-colour singleton by a base code alone.
assert.equal(resolve({item_style_id:'s',style_en:'1B26KPTDR200',colors:['Blue']},styles,[variants[0]]).image,'');
const exactStyles=[{id:'maroon',style_no:'1B26KPTDR200 - MAROON'},{id:'black',style_no:'1B26KPTDR200'}];
r=resolve({style_en:'1B26KPTDR200 – MAROON',design_code:'1B26KPTDR200',colors:['Maroon']},exactStyles,[{...variants[0],style_id:'maroon'},{...variants[1],style_id:'black'}]);assert.equal(r.style.id,'maroon');
assert.equal(resolve({item_variant_id:'missing',style_en:'7610SKDPC-PEACH'},peachStyles,[peachVariant]).image,'');
assert.equal(resolve({item_style_id:'s',item_variant_id:'peach-row'},[...styles,...peachStyles],[peachVariant]).image,'');
console.log('PASS PEACH/PINK metadata regression, explicit ID integrity, full-name priority, duplicate/nearby-code isolation, no wrong-colour singleton fallback.');
