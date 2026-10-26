(()=>{
const gasUrl=String(window.BONYAN_GAS_URL||'').trim();
const keys=['bonyan-projects','bonyan-expenses','bonyan-items','bonyan-categories','bonyan-units','bonyan-income','bonyan-suppliers','bonyan-customers','bonyan-invoices','bonyan-quotations','bonyan-company'];
const configured=/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec\/?$/.test(gasUrl);
const pending=new Map(),saveQueues=new Map();
let frame=null,bridgeWindow=null,frameOrigin='',bridgeReady=false,readyResolve,readyReject,loadTimer,readyTimer;
const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject});
const nonce=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
const trustedGoogleOrigin=/^https:\/\/(script\.google\.com|([a-z0-9-]+\.)*googleusercontent\.com)$/;
function start(){
 if(location.protocol==='file:'){readyReject(Error('اتصال Google Apps Script يتطلب فتح النظام من عنوان HTTPS المنشور على GitHub Pages؛ لا يعمل من ملف محلي file://.'));return}
 if(!configured){readyResolve(false);return}
 const add=()=>{if(!document.body){setTimeout(add,20);return}
  frame=document.createElement('iframe');frame.title='Bonyan API transport';frame.setAttribute('aria-hidden','true');frame.name='bonyan-api-'+nonce;frame.style.cssText='position:fixed;width:1px;height:1px;left:-10px;bottom:-10px;border:0;opacity:0;pointer-events:none';
  const u=new URL(gasUrl);u.searchParams.set('bridge','1');u.searchParams.set('origin',location.origin);u.searchParams.set('nonce',nonce);
  frame.onerror=()=>readyReject(Error('تعذر تحميل واجهة Google Apps Script'));
  frame.onload=()=>{clearTimeout(loadTimer);loadTimer=setTimeout(()=>{if(!bridgeReady)readyReject(Error('لم تصل إشارة الجسر. تحقق من صلاحية Anyone ورابط Web App المنشور.'))},10000)};
  frame.src=u.href;document.body.append(frame);
  readyTimer=setTimeout(()=>readyReject(Error('لم يرد Apps Script. تحقق من رابط /exec وصلاحية Anyone ثم أعد نشر أحدث إصدار.')),30000)
 };add()
}
start();
window.addEventListener('message',e=>{
 if(!trustedGoogleOrigin.test(e.origin))return;
 const d=e.data||{};if(d.nonce!==nonce)return;
 if(d.type==='READY'){clearTimeout(loadTimer);clearTimeout(readyTimer);bridgeWindow=e.source;frameOrigin=e.origin;bridgeReady=true;readyResolve(true);return}
 if(d.type==='ERROR'){clearTimeout(loadTimer);clearTimeout(readyTimer);readyReject(Error(d.error||'عنوان GitHub Pages غير مسموح'));return}
 const p=pending.get(d.id);if(!p)return;pending.delete(d.id);clearTimeout(p.timer);d.ok?p.resolve(d.result):p.reject(Error(d.error||'تعذر الاتصال بخدمة البيانات'))
});
function call(action,data={}){
 const send=()=>new Promise((resolve,reject)=>{
  if(!bridgeWindow||!frameOrigin){reject(Error('تعذر تحميل جسر Google Apps Script'));return}
  const id='req-'+(++seq)+'-'+Date.now(),timer=setTimeout(()=>{pending.delete(id);reject(Error('انتهت مهلة الاتصال بخدمة البيانات'))},60000);
  pending.set(id,{resolve,reject,timer});bridgeWindow.postMessage({id,action,data,nonce},frameOrigin)
 });
 return bridgeReady?send():ready.then(ok=>{if(!ok)throw Error('تعذر تحميل جسر Google Apps Script');return send()})
}
let seq=0;
function saveDataset(key,value){if(!configured)return Promise.resolve({ok:true,local:true});const token=localStorage.getItem('bonyan-api-session');if(!token)return Promise.reject(Error('انتهت الجلسة؛ سجّل الدخول مجدداً'));const prior=saveQueues.get(key),run=()=>call(key==='bonyan-users'?'saveUsers':'saveData',{token,key,value}),task=prior?prior.catch(()=>{}).then(run):run();let tracked;tracked=task.finally(()=>{if(saveQueues.get(key)===tracked)saveQueues.delete(key)});saveQueues.set(key,tracked);return tracked}
function flush(){return Promise.all([...saveQueues.values()])}
async function syncAll(token){const response=await call('loadAll',{token});if(!response||!response.ok)throw Error(response?.error||'تعذر تحميل بيانات المؤسسة');keys.forEach(k=>localStorage.removeItem(k));keys.forEach(k=>localStorage.setItem(k,JSON.stringify(Object.prototype.hasOwnProperty.call(response.data||{},k)?response.data[k]:(k==='bonyan-company'?{}:[]))));localStorage.setItem('bonyan-users',JSON.stringify(response.users||[]));return response}
window.BonyanCloud={configured,gasUrl,keys,ready,call,saveDataset,flush,hasPendingWrites:()=>saveQueues.size>0,syncAll,setUrl(url){const v=String(url||'').trim();if(!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec\/?$/.test(v))throw Error('أدخل رابط Web App الذي ينتهي بـ /exec');localStorage.setItem('bonyan-gas-url',v);location.reload()}};
})();
