const test=require('node:test'),assert=require('node:assert/strict'),h=require('./history-test-helper');let saved,s;
test.before(()=>{saved=h.backup();s=h.scope('branch');h.setup(s)});test.after(()=>h.restore(saved));
function add(columnIndex){return h.history.transact(s,{scope:'STRUCTURE',operation:'hideColumn',target:{columnIndex},before:{active:false},after:{active:true}},()=>h.structure.upsert({...s,logicalTableKey:'tbl:financial-7col',operation:'hideColumn',columnIndex}))}
test('clears redo branch after a new action',()=>{add(1);add(2);add(3);h.history.undo(s);h.history.undo(s);add(4);const state=h.history.get(s);assert.equal(state.cursor,2);assert.equal(state.events.length,2);assert.equal(state.canRedo,false);assert.deepEqual(state.events.map(x=>x.target.columnIndex),[1,4])});
