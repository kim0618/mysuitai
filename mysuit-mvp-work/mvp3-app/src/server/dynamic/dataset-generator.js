const zlib=require('zlib');
const clone=x=>JSON.parse(JSON.stringify(x));
function createImportedDataset(prototype,model){const out=clone(prototype);out.id=model.id;out.className='UBDmcUser';out.typeName='user';out.dataStructureType=0;out.reference=true;out.totalCount=0;out.addCount=0;out.columns=model.columns.map(c=>({type:'0',dataField:c.name,header:c.name,sample:encodeURIComponent(String(model.rows[0]?.[c.name]??''))}));out.data=zlib.deflateSync(Buffer.from(JSON.stringify(model.rows),'utf8')).toString('base64').match(/.{1,76}/g).join('\n');return out}
function decodeImportedRows(dataset){return JSON.parse(zlib.inflateSync(Buffer.from(dataset.data.replace(/\s/g,''),'base64')).toString('utf8'))}
module.exports={createImportedDataset,decodeImportedRows};
