const test=require('node:test'),assert=require('node:assert/strict'),h=require('./history-test-helper');let saved,s;
test.before(()=>{saved=h.backup();s=h.scope('tx');h.setup(s)});test.after(()=>h.restore(saved));
test('does not append or move cursor when mutation fails',()=>{assert.throws(()=>h.history.transact(s,{scope:'STRUCTURE',operation:'resizeColumn'},()=>{throw Object.assign(new Error('forced'),{code:'FORCED'})}),/forced/);assert.equal(h.history.get(s).cursor,0);assert.equal(h.structure.list(s).length,0)});
test('rejects undo at base without changing state',()=>{assert.throws(()=>h.history.undo(s),e=>e.code==='NOTHING_TO_UNDO');assert.equal(h.history.get(s).cursor,0)});
