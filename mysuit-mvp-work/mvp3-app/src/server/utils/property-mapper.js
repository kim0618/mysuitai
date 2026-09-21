const DEFINITIONS = Object.freeze({
  text:{sourceProperty:'text',kind:'text',defaultValue:''},
  fontSize:{sourceProperty:'fontSize',kind:'number',min:6,max:96,defaultValue:12},
  fontWeight:{sourceProperty:'fontWeight',kind:'enum',values:['normal','bold'],defaultValue:'normal'},
  textAlign:{sourceProperty:'textAlign',kind:'enum',values:['left','center','right'],defaultValue:'left'},
  visible:{sourceProperty:'visible',kind:'boolean',defaultValue:true},
  left:{sourceProperty:'x',kind:'number',min:0,max:2000},
  top:{sourceProperty:'y',kind:'number',min:0,max:3000},
  width:{sourceProperty:'width',kind:'positive',min:1,max:2000},
  height:{sourceProperty:'height',kind:'positive',min:1,max:3000},
  scaleType:{sourceProperty:'scaleType',kind:'enum',values:[0,1,3],defaultValue:0},
  data:{sourceProperty:'data',kind:'asset'}
});
const images=()=>require('../services/image-asset-service');
function error(code,message){const e=new Error(message);e.code=code;return e}
function definition(property){const value=DEFINITIONS[property];if(!value)throw error('UNSUPPORTED_PROPERTY','지원하지 않는 속성입니다.');return value}
function sourceValue(item,property){const d=definition(property);const raw=item[d.sourceProperty];if(property==='data')return images().inlineRef(raw);if(property==='scaleType')return raw===undefined||raw===''?d.defaultValue:Number(raw);if(property==='text'){try{return decodeURIComponent(raw??'')}catch(_){return raw??''}}return raw===undefined?d.defaultValue:raw}
function validateValue(property,value){const d=definition(property);if(d.kind==='text'){if(typeof value!=='string'||!value.trim()||value.length>200)throw error('INVALID_PROPERTY_VALUE','문구 값이 올바르지 않습니다.');return value}if(d.kind==='boolean'){if(typeof value!=='boolean')throw error('INVALID_PROPERTY_VALUE','표시 여부는 boolean이어야 합니다.');return value}if(d.kind==='asset')return images().assertUsable(value);if(d.kind==='enum'){if(!d.values.includes(value))throw error('INVALID_PROPERTY_VALUE','허용되지 않은 속성 값입니다.');return value}if(typeof value!=='number'||!Number.isFinite(value)||value<d.min||value>d.max)throw error('INVALID_PROPERTY_VALUE','숫자 값이 허용 범위를 벗어났습니다.');return value}
function encodedValue(property,value,current){return property==='text'?encodeURIComponent(value):property==='data'?images().resolve(value,current):value}
function isDynamicText(text){return /(?:\{|\}|FN\.|dataset_|switch\s*\(|RowDataValue|CurrentPage|TotalPage)/i.test(text)}
function supportedProperties(match,runtimeText){const item=match.item;if(item.className==='UBImage')return{properties:['visible','width','height','left','top','scaleType','data'],direct:true,staticText:false,positionConfidence:'source-direct'};const direct=item.className==='UBLabel';const staticText=!isDynamicText(sourceValue(item,'text'))&&sourceValue(item,'text')===runtimeText;const freeform=direct&&!item.band;const properties=['fontSize','fontWeight','textAlign','visible','width','height',...(freeform?['left','top']:[])];if(direct||staticText)properties.unshift('text');return{properties,direct,staticText,positionConfidence:freeform?'source-direct':direct?'source-equal-but-render-unverified':'unverified-cell-offset'}}
module.exports={DEFINITIONS,definition,sourceValue,validateValue,encodedValue,isDynamicText,supportedProperties};
