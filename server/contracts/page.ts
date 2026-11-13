/**
 * The signing page a store owner opens from the letter (GET /api/contracts/s/:token). Self-contained: no link to
 * the store, no outside resources, not indexed, no referrer (the token is in the address) — criterion C-05.
 * Arabic or English after the agreement loads (the store's language).
 */
export function signingPage(nonce: string): string {
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>Agreement · الاتفاقية</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f6f3ee;color:#292524;font:16px/1.7 system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif}
main{max-width:760px;margin:0 auto;padding:20px 16px 60px}h1{font-size:22px;margin:8px 0 4px}.muted{color:#78716c;font-size:13px}
.card{background:#fff;border:1px solid #e7e5e4;border-radius:16px;padding:16px;margin:14px 0;box-shadow:0 1px 2px rgba(0,0,0,.04)}
pre{white-space:pre-wrap;word-wrap:break-word;font:inherit;font-size:14px;max-height:55vh;overflow:auto;margin:0}
label{display:block;font-weight:600;margin:10px 0 4px}input[type=text],textarea{width:100%;padding:10px 12px;border:1px solid #d6d3d1;border-radius:10px;font:inherit}
.row{display:flex;gap:8px;align-items:flex-start}.row input{margin-top:6px}button{font:inherit;border:0;border-radius:12px;padding:12px 18px;cursor:pointer}
.primary{background:#b45309;color:#fff;font-weight:700;width:100%}.ghost{background:#f5f5f4;color:#44403c}.danger{background:none;color:#991b1b;text-decoration:underline;padding:6px}
button[disabled]{opacity:.5;cursor:default}.ok{background:#ecfdf5;border-color:#a7f3d0}.err{color:#991b1b;font-weight:600;min-height:1.4em}code{font-size:12px;word-break:break-all}
</style></head><body><main id="app"><p class="muted">Loading… · جاري التحميل…</p></main>
<script nonce="${nonce}">
(function(){
var token=location.pathname.split('/').filter(Boolean).pop();var api='/api/contracts/sign/'+encodeURIComponent(token);var app=document.getElementById('app');var d=null;var L={};
var T={ar:{title:'اتفاقية عرض منتجات',for:'مع',read:'اقرأ الاتفاقية كاملة قبل الموافقة:',fp:'بصمة النص (SHA-256):',name:'الاسم بالكامل',role:'صفتك في المتجر (مثلاً: المالك، المدير)',agree:'قرأت الاتفاقية وأوافق عليها، وأوافق على توقيعها إلكترونياً.',code:'كود التأكيد',send:'ابعت الكود على',sent:'وصل الكود على الإيميل — صالح 15 دقيقة.',sign:'أوافق وأوقّع',decline:'لا أرغب في التعاون',reason:'سبب (اختياري)',confirmDecline:'تأكيد الرفض',done:'تم التوقيع بنجاح، شكراً لكم.',ref:'الرقم المرجعي:',pending:'لإتمام التوثيق: رجاءً ردّوا على الإيميل الذي وصلكم منا بكلمة «موافق» مع الرقم المرجعي، من الإيميل الرسمي للمتجر.',closed:'هذه الاتفاقية لم تعد متاحة للتوقيع.',declined:'تم تسجيل رفضكم، ولن نراسلكم بخصوصها مرة أخرى.',bad:'هذا الرابط غير صالح.',signedAt:'وقت التوقيع:'},
en:{title:'Product listing agreement',for:'with',read:'Please read the whole agreement before accepting:',fp:'Text fingerprint (SHA-256):',name:'Full name',role:'Your role in the store (e.g. owner, manager)',agree:'I have read and accept this agreement, and I agree to sign it electronically.',code:'Confirmation code',send:'Send the code to',sent:'The code was sent — valid for 15 minutes.',sign:'Accept and sign',decline:'I am not interested',reason:'Reason (optional)',confirmDecline:'Confirm',done:'Signed successfully — thank you.',ref:'Reference:',pending:'To complete the verification, please reply to the email you received from us with "agreed" and the reference, from the store\\'s official email.',closed:'This agreement can no longer be signed.',declined:'Your answer was recorded; we will not contact you about it again.',bad:'This link is not valid.',signedAt:'Signed at:'}};
function el(tag,attrs,kids){var e=document.createElement(tag);for(var k in attrs||{}){if(k==='text')e.textContent=attrs[k];else e.setAttribute(k,attrs[k]);}(kids||[]).forEach(function(c){if(c)e.appendChild(c)});return e}
function call(path,body){return fetch(api+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined}).then(function(r){return r.json().then(function(j){if(!r.ok)throw j;return j})})}
function lang(l){L=T[l]||T.ar;document.documentElement.lang=l;document.documentElement.dir=l==='ar'?'rtl':'ltr'}
function msg(text,cls){app.innerHTML='';app.appendChild(el('div',{class:'card '+(cls||'')},[el('p',{text:text})]))}
function done(r){app.innerHTML='';var c=el('div',{class:'card ok'},[el('h1',{text:L.done}),el('p',{text:L.ref+' '+r.reference}),el('p',{class:'muted',text:L.signedAt+' '+new Date(r.signedAt).toLocaleString()}),el('p',{class:'muted'},[document.createTextNode(L.fp+' '),el('code',{text:r.sha256})])]);if(r.verification==='pending')c.appendChild(el('p',{text:L.pending}));app.appendChild(c)}
function render(){app.innerHTML='';app.appendChild(el('h1',{text:L.title+' — '+d.storeName}));app.appendChild(el('p',{class:'muted',text:d.domain}));
if(!d.signable){msg(d.status==='declined'?L.declined:(d.signedAt?L.done+' '+L.signedAt+' '+new Date(d.signedAt).toLocaleString():L.closed),d.signedAt?'ok':'');return}
app.appendChild(el('p',{text:L.read}));app.appendChild(el('div',{class:'card'},[el('pre',{text:d.text})]));app.appendChild(el('p',{class:'muted'},[document.createTextNode(L.fp+' '),el('code',{text:d.sha256})]));
var name=el('input',{type:'text',autocomplete:'name',maxlength:'80'}),role=el('input',{type:'text',maxlength:'80'}),agree=el('input',{type:'checkbox',id:'agree'}),err=el('p',{class:'err'}),code=el('input',{type:'text',inputmode:'numeric',maxlength:'6',autocomplete:'one-time-code'});
var form=el('div',{class:'card'},[el('label',{text:L.name}),name,el('label',{text:L.role}),role,el('div',{class:'row'},[agree,el('label',{for:'agree',text:L.agree,style:'font-weight:400'})])]);
if(d.codeRequired){var sendBtn=el('button',{class:'ghost',type:'button',text:L.send+' '+d.email}),note=el('p',{class:'muted'});sendBtn.onclick=function(){sendBtn.disabled=true;call('/code',{}).then(function(r){note.textContent=r.delivered?L.sent:'';if(!r.delivered){d.codeRequired=false;render()}}).catch(function(e){err.textContent=e.error||'Error';sendBtn.disabled=false})};form.appendChild(el('label',{text:L.code}));form.appendChild(el('div',{},[sendBtn,note,code]))}
var btn=el('button',{class:'primary',type:'button',text:L.sign});btn.onclick=function(){err.textContent='';btn.disabled=true;call('',{name:name.value,title:role.value,agree:agree.checked,sha256:d.sha256,code:code.value}).then(done).catch(function(e){err.textContent=e.error||'Error';btn.disabled=false})};
form.appendChild(err);form.appendChild(btn);app.appendChild(form);
var reason=el('textarea',{rows:'2',maxlength:'500'}),dec=el('button',{class:'danger',type:'button',text:L.decline}),box=el('div',{style:'display:none'},[el('label',{text:L.reason}),reason,el('button',{class:'ghost',type:'button',text:L.confirmDecline})]);
dec.onclick=function(){box.style.display='block'};box.lastChild.onclick=function(){call('/decline',{reason:reason.value}).then(function(){msg(L.declined)}).catch(function(e){err.textContent=e.error||'Error'})};app.appendChild(el('div',{},[dec,box]))}
call('').then(function(j){d=j;lang(j.lang);render()}).catch(function(){lang('ar');msg(T.ar.bad+' · '+T.en.bad)});
})();
</script></body></html>`;
}
