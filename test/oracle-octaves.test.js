import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine,PRESETS,toCodePhiSpec} from '../src/index.js';
test('Oracle Octaves preserves LayaPhi page structure while styling Code Phi handoff',()=>{
 const e=createEngine();
 const source={pageType:'research',components:[{id:'hero',type:'hero',title:'Research'},{id:'article',type:'article',body:'Original content'}]};
 const created=e.createDesign(source,{theme:'oracle-octaves'});
 assert.equal(created.ok,true);
 const design=e.exportDesign();
 assert.equal(design.theme,'oracle-octaves');
 assert.equal(design.tokens.colors.background,'#fbf8f1');
 assert.equal(design.tokens.colors.surface,'#ffffff');
 assert.equal(design.tokens.colors.accent,'#8f202d');
 assert.equal(design.components.hero.layout.title,'Research');
 assert.equal(design.components.article.layout.body,'Original content');
 const codeSpec=toCodePhiSpec(design);
 assert.deepEqual(codeSpec.components.map(x=>x.id),['hero','article']);
 assert.equal(codeSpec.components[0].resolved.mobile.colors.accent,'#8f202d');
});
