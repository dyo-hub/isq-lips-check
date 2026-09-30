const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
function fixture(){
  const elements = Object.fromEntries(['diagnosis_answers','diagnosis_result','company','email'].map(k => [k,{value:''}]));
  const status = {textContent:''};
  let submit;
  const form = {elements:{namedItem:key=>elements[key]},addEventListener:(event,fn)=>{assert.equal(event,'submit');submit=fn;}};
  const document = {querySelectorAll:()=>[],querySelector:()=>form,getElementById:()=>status};
  const context = vm.createContext({document});
  vm.runInContext(source, context);
  return {elements,status,context,submit:()=>{let prevented=false;submit({preventDefault:()=>{prevented=true;}});return prevented;}};
}
test('four answers and final result are actual named form fields',()=>{
  assert.match(html, /name="diagnosis_answers"/);
  assert.match(html, /name="diagnosis_result"/);
  assert.match(html, /method="POST" enctype="text\/plain"/);
});
test('all 16 combinations include four answers and the displayed outcome',()=>{
  for(let mask=0;mask<16;mask++){
    const f=fixture();
    const values=Array.from({length:4},(_,i)=>String((mask>>i)&1));
    vm.runInContext(`Object.assign(ans, ${JSON.stringify(Object.fromEntries(values.map((v,i)=>[i,v])))})`,f.context);
    assert.equal(f.submit(),false);
    assert.equal(f.elements.diagnosis_answers.value.split(' / ').length,4);
    values.forEach((v,i)=>assert.ok(f.elements.diagnosis_answers.value.includes(vm.runInContext(v==='1'?`V[${i}].pass`:`V[${i}].block.h`,f.context))));
    assert.equal(f.elements.diagnosis_result.value,vm.runInContext('FINAL[resultKey()].h',f.context));
  }
});
test('incomplete answers prevent mail composition and clear stale results',()=>{
  const f=fixture(); f.elements.diagnosis_result.value='stale';
  vm.runInContext("Object.assign(ans, {'0':'1','1':'0','2':'1'})",f.context);
  assert.equal(f.submit(),true);
  assert.equal(f.elements.diagnosis_result.value,'');
  assert.match(f.status.textContent,/네 문항/);
});
test('changing an answer replaces the previous diagnosis',()=>{
  const f=fixture();
  vm.runInContext("Object.assign(ans, {'0':'1','1':'1','2':'1','3':'1'})",f.context);
  f.submit(); const before=f.elements.diagnosis_result.value;
  vm.runInContext("ans['0']='0'",f.context); f.submit();
  assert.notEqual(f.elements.diagnosis_result.value,before);
});
