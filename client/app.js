const $=id=>document.getElementById(id);
const pathTable=location.pathname.match(/(?:^|\/)t\/([0-9a-f]{32})\/?$/)?.[1];
const table=pathTable||new URLSearchParams(location.search).get('table')?.match(/^[0-9a-f]{32}$/)?.[0]||null;
const API_BASE=String(window.SEGUNDS_API_BASE_URL||'').replace(/\/$/,'');
const storageKey=`segunds.intent.${table}`;
const credentialKey=`segunds.guest.${table}`;
let guestCredential=sessionStorage.getItem(credentialKey)||'';
let menu=null,consumption=null,cart=[],cartRevision=null,selected=new Set(),busy=false;
let pending=null;
try{pending=JSON.parse(sessionStorage.getItem(storageKey)||'null');}catch{sessionStorage.removeItem(storageKey);}
const money=cents=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(cents/100);
const message=text=>{$('message').textContent=text;};
function node(tag,text,cls){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;}
function button(text,fn,secondary=false){const e=node('button',text,secondary?'secondary':null);e.type='button';e.addEventListener('click',fn);return e;}
async function api(path,data=null){
  const headers={};if(data)headers['Content-Type']='application/json';if(guestCredential)headers.Authorization=`Bearer ${guestCredential}`;
  const r=await fetch(`${API_BASE}${path}`,{method:data?'POST':'GET',credentials:'omit',cache:'no-store',headers,body:data?JSON.stringify(data):undefined});
  const result=await r.json();if(!r.ok)throw Object.assign(new Error(result.error||'No pudimos confirmar la solicitud.'),{status:r.status});return result;
}
function pendingView(){
  $('pending').hidden=!pending;
  $('pending-text').textContent=pending?.rejected?'La solicitud fue rechazada. Revisa los datos antes de otra operación.':'Hay una solicitud pendiente por confirmar.';
  $('retry').disabled=busy||!!pending?.rejected;
  $('discard').hidden=!pending?.rejected;
}
function rememberIntent(){if(pending)sessionStorage.setItem(storageKey,JSON.stringify(pending));else sessionStorage.removeItem(storageKey);pendingView();}
async function refresh(){
  try{consumption=await api(`/api/consumption?table=${table}`);$('admission').hidden=true;render();}
  catch(e){if(e.status===401){guestCredential='';sessionStorage.removeItem(credentialKey);consumption=null;$('admission').hidden=false;render();message('Pide el código temporal al personal para entrar a la sesión.');await bootstrap();}else message(e.message);}
}
async function bootstrap(){
  const data=await api(`/api/bootstrap?table=${table}`);menu=data.menu;
  $('identity').replaceChildren(node('h1',menu.restaurant),node('p',`${menu.branch} · ${menu.table}`),node('p',menu.address));
  renderMenu();
}
async function send(action,payload){
  if(!consumption){message('Primero entra con el código del personal.');return;}
  if(pending){message('Confirma la solicitud pendiente antes de otra operación.');return;}
  pending={request_id:crypto.randomUUID(),action,payload:{...payload,session_id:consumption.session_id},session_id:consumption.session_id,rejected:false};rememberIntent();await retry();
}
async function retry(){
  if(!pending||pending.rejected||busy)return;
  if(!consumption||pending.session_id!==consumption.session_id){pending.rejected=true;rememberIntent();message('La solicitud pertenece a otra sesión y no se reenviará.');return;}
  busy=true;pendingView();
  try{await api('/api/action',{table,...pending});
    if(pending.action==='order'){cart=[];cartRevision=null;}
    if(pending.action==='reserve'||pending.action==='release')selected.clear();
    pending=null;rememberIntent();message('Solicitud procesada. Actualizando consumo…');await refresh();await bootstrap();
  }catch(e){if([400,401,403,409].includes(e.status)){pending.rejected=true;rememberIntent();}message(e.message);}
  finally{busy=false;pendingView();render();}
}
function renderMenu(){
  if(!menu)return;const root=$('menu');root.replaceChildren();
  if(!menu.published||!menu.products.length){root.append(node('p','El restaurante todavía no ha publicado su menú.'));return;}
  for(const category of [...new Set(menu.products.map(p=>p.category))]){
    root.append(node('h3',category,'category'));const group=node('div',null,'product-group');root.append(group);
    for(const p of menu.products.filter(p=>p.category===category)){
      const card=node('article',null,'product');if(p.image){const img=node('img');img.src=p.image;img.alt=p.name;img.loading='lazy';card.append(img);}
      card.append(node('h3',p.name),node('p',p.description),node('p',money(p.price_cents),'price'));
      const variants=node('select');variants.append(new Option('Sin variante',''));
      for(const v of p.variants.filter(v=>v.available))variants.append(new Option(`${v.name} · ${money(p.price_cents+v.additional_price_cents)}`,v.id));
      if(p.variants.length)card.append(variants);
      const notes=node('textarea');notes.maxLength=500;notes.placeholder='Notas o indicaciones';notes.setAttribute('aria-label',`Notas para ${p.name}`);card.append(notes);
      const add=button(p.available?'Agregar al pedido':'No disponible',()=>{
        if(!consumption||consumption.mode!=='self_service'){message('Entra a la sesión y elige autoservicio, o llama al mesero.');return;}
        if(pending){message('Confirma la solicitud pendiente.');return;}
        if(cartRevision!==null&&cartRevision!==menu.revision){message('El menú cambió. Quita el pedido anterior y selecciona con los precios actuales.');return;}
        if(cart.reduce((n,i)=>n+i.quantity,0)>=100){message('Máximo 100 unidades por pedido.');return;}
        const v=p.variants.find(v=>v.id===variants.value);const existing=cart.find(i=>i.product_id===p.id&&i.variant_id===(v?.id||null)&&i.notes===notes.value);
        if(existing){if(existing.quantity>=20){message('Máximo 20 unidades por línea.');return;}existing.quantity++;}
        else cart.push({product_id:p.id,variant_id:v?.id||null,notes:notes.value,quantity:1,name:p.name,variant_name:v?.name||'',unit_price:p.price_cents+(v?.additional_price_cents||0)});
        cartRevision=menu.revision;render();
      });add.disabled=!p.available;card.append(add);group.append(card);
    }
  }
}
function render(){
  const joined=!!consumption;$('service').hidden=!joined;$('consumption-section').hidden=!joined;
  $('cart-section').hidden=!joined||consumption.mode!=='self_service';
  $('mode').textContent=joined?(consumption.mode==='self_service'?'Autoservicio: confirma tus pedidos aquí.':'Atención tradicional: el personal toma tus pedidos.') : '';
  const root=$('cart');root.replaceChildren();
  for(const [index,item]of cart.entries()){
    const row=node('div',null,'unit');row.append(node('span',`${item.quantity} × ${item.name} ${item.variant_name} · ${money(item.quantity*item.unit_price)}`),button('Quitar',()=>{if(pending)return;cart.splice(index,1);if(!cart.length)cartRevision=null;render();},true));root.append(row);
  }
  if(!cart.length)root.append(node('p','Todavía no has seleccionado platillos.'));
  const units=$('consumption');units.replaceChildren();
  if(joined)for(const unit of consumption.units){
    const row=node('label',null,'unit');const check=node('input');check.type='checkbox';
    check.disabled=unit.paid||unit.cancelled||unit.reserved||busy||!!pending;
    if(check.disabled)selected.delete(unit.id);check.checked=selected.has(unit.id);
    check.addEventListener('change',()=>{check.checked?selected.add(unit.id):selected.delete(unit.id);render();});
    row.append(check,node('span',`${unit.snapshot.name} ${unit.snapshot.variant?.name||''} · ${money(unit.unit_price_cents)}`),node('small',unit.cancelled?'Cancelada':unit.paid?'Pagada':unit.reserved?'Reservada':'Pendiente'));units.append(row);
  }
  if(joined&&!consumption.units.length)units.append(node('p','Esta sesión aún no tiene consumo.'));
  const mutationBlocked=busy||!!pending||!joined;
  for(const id of ['traditional','self','waiter','bill'])$(id).disabled=mutationBlocked;
  $('order').disabled=mutationBlocked||!cart.length||consumption?.mode!=='self_service';
  $('reserve').disabled=mutationBlocked||!selected.size;
  $('release').disabled=mutationBlocked||!consumption?.units.some(u=>u.mine&&u.reservation_id);
  pendingView();
}
$('join').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;busy=true;
  try{await bootstrap();if(!guestCredential){guestCredential=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');sessionStorage.setItem(credentialKey,guestCredential);}const joined=await api('/api/join',{table,code:$('code').value.trim().toLowerCase(),credential:guestCredential});guestCredential=joined.credential;sessionStorage.setItem(credentialKey,guestCredential);$('code').value='';await refresh();message('Ya estás en la sesión de la mesa.');}
  catch(e){message({invalid_entry_code:'Código incorrecto o vencido.',rate_limited:'Espera unos minutos o solicita otro código al personal.',session_closed:'El personal debe abrir una sesión nueva.'}[e.message]||e.message);}
  finally{busy=false;render();}
});
$('traditional').addEventListener('click',()=>send('mode',{mode:'traditional'}));$('self').addEventListener('click',()=>send('mode',{mode:'self_service'}));
$('waiter').addEventListener('click',()=>send('call',{kind:'waiter'}));$('bill').addEventListener('click',()=>send('call',{kind:'bill'}));
$('order').addEventListener('click',()=>send('order',{items:cart.map(({product_id,variant_id,quantity,notes})=>({product_id,variant_id,quantity,notes})),menu_revision:cartRevision}));
$('reserve').addEventListener('click',()=>send('reserve',{unit_ids:[...selected].sort()}));
$('release').addEventListener('click',()=>{const reservation=consumption?.units.find(u=>u.mine&&u.reservation_id)?.reservation_id;if(reservation)send('release',{reservation_id:reservation});});
$('retry').addEventListener('click',retry);$('discard').addEventListener('click',()=>{if(pending?.rejected){if(pending.action==='order'){cart=[];cartRevision=null;}pending=null;rememberIntent();refresh();bootstrap().catch(e=>message(e.message));}});
if(!table)message('Escanea el QR de una mesa para ver su menú.');else bootstrap().then(refresh).catch(e=>message(e.message));
setInterval(()=>{if(table&&consumption&&!busy&&!document.hidden)refresh();},15000);
