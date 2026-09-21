const fs=require('fs');const path=require('path');
const file=path.resolve(__dirname,'../data/render-patches.json');
const matches={
  rp_20260807_2b094b:{renderIndex:33,width:70,height:27},rp_20260807_0a08b2:{renderIndex:28,width:70,height:27},
  rp_20260807_44d6d7:{renderIndex:36,width:70,height:27},rp_20260807_0f754e:{renderIndex:34,width:70,height:27},
  rp_20260807_78693d:{renderIndex:10,width:70,height:33},rp_20260807_66cd1f:{renderIndex:0,width:425,height:68},
  rp_20260807_127aed:{renderIndex:4,width:75,height:32}
};
const data=JSON.parse(fs.readFileSync(file,'utf8')),results=[];
for(const patch of data.patches){const match=matches[patch.patchId];if(!match){results.push({patchId:patch.patchId,status:'UNRESOLVED'});continue}patch.canvasIndex=0;patch.renderIndex=match.renderIndex;patch.renderInstanceKey=`p${patch.pageIndex}|c0|src:${patch.sourceObjectId}|band:${patch.bandId}|row:${patch.rowIndex}|idx:${match.renderIndex}`;patch.originalFingerprint={left:patch.before.left,top:patch.before.top,width:match.width,height:match.height};results.push({patchId:patch.patchId,status:'MIGRATED',renderInstanceKey:patch.renderInstanceKey})}
const temp=`${file}.${process.pid}.tmp`;fs.writeFileSync(temp,JSON.stringify(data,null,2)+'\n');fs.renameSync(temp,file);console.log(JSON.stringify({count:results.length,results},null,2));
