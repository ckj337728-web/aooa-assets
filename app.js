"use strict";

const publicLibrary = window.PUBLIC_LIBRARY === true;
document.documentElement.dataset.mode = publicLibrary ? "public" : "local";
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const paths = {
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  archive:'<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v11h14V9m-9 4h4"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.3"/><rect x="14" y="3" width="7" height="7" rx="1.3"/><rect x="3" y="14" width="7" height="7" rx="1.3"/><rect x="14" y="14" width="7" height="7" rx="1.3"/>',
  list:'<path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1"/>',
  menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
  x:'<path d="m6 6 12 12M18 6 6 18"/>',
  refresh:'<path d="M20 8a8 8 0 0 0-14-2L3 9m0-5v5h5m-4 7a8 8 0 0 0 14 2l3-3m0 5v-5h-5"/>',
  "folder-plus":'<path d="M3 7V5h6l2 2h9v13H3V7Zm5 6h7m-3.5-3.5v7"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.8"/><path d="m16 16 4.5 4.5"/>',
  sliders:'<path d="M4 7h7m4 0h5M4 17h3m4 0h9"/><circle cx="13" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  "chevron-down":'<path d="m6 9 6 6 6-6"/>',
  sort:'<path d="M4 6h16M4 12h11M4 18h6"/>',
  "check-square":'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3 3 7-7"/>',
  check:'<path d="m4 12 5.5 5.5L20 7"/>',
  review:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 3v.4"/>',
  car:'<path d="m4 10 2.5-5h11l2.5 5m-16 0h16l1 3v4h-2v2h-2v-2H7v2H5v-2H3v-4l1-3Zm2 3h2m8 0h2"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  play:'<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/>',
  file:'<path d="M5 3h9l5 5v13H5Zm9 0v6h5"/>',
  folder:'<path d="M3 7V5h6l3 3h8v12H3V7Z"/>',
  external:'<path d="M10 4H4v16h16v-6M13 3h8v8m0-8L10 14"/>'
};
function icon(name, size=17) {
  return '<svg aria-hidden="true" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+(paths[name] || "")+'</svg>';
}
document.querySelectorAll("[data-icon]").forEach(el => {el.innerHTML = icon(el.dataset.icon);});

const state = {
  assets:[], categories:[], models:[], query:"", category:"", model:"", review:false,
  format:"", sort:"gallery", layout:"grid", page:1, selecting:false, selection:new Set(), closedBrands:new Set()
};
const pageSize = 36;
const byName = new Intl.Collator("zh-CN",{numeric:true,sensitivity:"base"});
const aliases = [
  [/civic|思域/i,"本田 思域 honda civic"], [/mustang|野马/i,"福特 野马 ford mustang"],
  [/cybertruck|赛博/i,"特斯拉 赛博皮卡 赛博越野旅行车 tesla cybertruck"],
  [/model\s*[3y]|tesla|特斯拉/i,"tesla 特斯拉"], [/eco[\s-]*boost/i,"ecoboost eco boost"],
  [/performance|性能版/i,"performance 性能版"]
];
let matches = [], pageItems = [], modelGroups = [], dataById = new Map(), index = new Map();
let focusedCard = null, toastTimer;

const compact = s => String(s || "").normalize("NFKC").toLowerCase().replace(/[\s·•\/\\_.&–—-]+/gu,"");
const unknown = text => !text || /待确认|待定|未识别|未知|未分/.test(text);
const needsReview = a => unknown(a.model) || unknown(a.category);
const count = n => n.toLocaleString("zh-CN");
function indexAssets() {
  dataById = new Map(state.assets.map(a=>[a.id,a]));
  const groups = new Map();
  index = new Map(state.assets.map(a => {
    const brand = a.brand || (unknown(a.model) ? "待确认" : "其他车型");
    if (!groups.has(brand)) groups.set(brand,new Map());
    const models = groups.get(brand);
    models.set(a.model,(models.get(a.model) || 0)+1);
    const descriptor = a.brand+" "+a.model;
    const alt = aliases.filter(([regex])=>regex.test(descriptor)).map(([,s])=>s).join(" ");
    const range = String(a.year||"").match(/(19\d\d|20\d\d)\D+(19\d\d|20\d\d)/);
    return [a.id,{text:compact([a.model,a.year,a.brand,a.title,a.category,a.name,a.path,a.ext,alt].join(" ")),min:range?+range[1]:0,max:range?+range[2]:0}];
  }));
  modelGroups = [...groups].filter(([,models])=>[...models.keys()].some(name=>!unknown(name))).sort(([a],[b])=>Number(unknown(a))-Number(unknown(b)) || byName.compare(a,b));
}
function searchMatch(a, tokens) {
  const data=index.get(a.id);
  return tokens.every(token=>{
    if (/^model[3y]$/.test(token)) return compact(a.model).includes(token);
    return data.text.includes(token) || (/^(19|20)\d{2}$/.test(token) && +token>=data.min && +token<=data.max);
  });
}
function scoped(a) { return (!state.model || a.model===state.model) && (!state.review || needsReview(a)); }
function modelLabel(s) {return s || "车型待确认";}
function sizeLabel(bytes) {
  if (bytes<1024) return bytes+" B";
  return bytes<1048576 ? Math.round(bytes/1024)+" KB" : (bytes/1048576).toFixed(1)+" MB";
}
const smallNav=window.matchMedia("(max-width:820px)");
function openNav(open) {
  document.body.classList.toggle("nav-open",open);
  $("scrim").hidden=!open;
  $("sidebar").inert=smallNav.matches&&!open;
  if (open) $("close-nav").focus(); else if (smallNav.matches) $("open-nav").focus();
}
$("sidebar").inert=smallNav.matches;
smallNav.addEventListener("change",()=>{document.body.classList.remove("nav-open");$("sidebar").inert=smallNav.matches;$("scrim").hidden=true;});
function sideRow(name, number, type, selected, glyph) {
  return '<button class="side-row '+(selected?"active ":"")+(type==="model"?"model-row":"")+'" data-nav="'+type+'" data-value="'+escapeHtml(name)+'" title="'+escapeHtml(name)+'" '+(selected?'aria-current="page"':'')+'>'+(glyph?icon(glyph):'')+'<span class="nav-name">'+escapeHtml(name)+'</span><span class="row-count">'+count(number)+'</span></button>';
}
function renderNavigation() {
  $("library-nav").innerHTML = sideRow("全部素材",state.assets.length,"all",!state.model&&!state.review,"grid")+sideRow("待确认素材",state.assets.filter(needsReview).length,"review",state.review,"review");
  $("model-count").textContent=count(state.models.filter(m=>!unknown(m)).length)+" 款";
  $("model-nav").innerHTML=modelGroups.map(([brand,models])=>{
    const open=!state.closedBrands.has(brand);
    const brandText=escapeHtml(brand);
    const modelRows=[...models].sort(([a],[b])=>byName.compare(a,b)).map(([name,n])=>sideRow(name,n,"model",name===state.model)).join("");
    return '<div class="brand-block"><button class="brand-row" data-brand="'+brandText+'" aria-expanded="'+open+'">'+icon("car",17)+'<span class="nav-name">'+brandText+'</span><span class="chev">'+icon("chevron-down",14)+'</span></button><div class="model-list" '+(open?"":"hidden")+'>'+modelRows+'</div></div>';
  }).join("");
}
function renderScope() {
  const items=state.assets.filter(scoped);
  const models=new Set(items.map(a=>a.model).filter(m=>!unknown(m)));
  const cats=new Set(items.map(a=>a.category));
  const title=state.model || (state.review?"待确认素材":"全部素材");
  $("page-title").textContent=title;
  $("hero").classList.toggle("scoped",Boolean(state.model||state.review));
  const years=[...new Set(items.map(a=>a.year).filter(Boolean))].sort().join(" / ");
  const metric=(glyph,label)=>'<span>'+icon(glyph,16)+escapeHtml(label)+'</span>';
  $("hero-stats").innerHTML=metric("image",count(items.length)+" 份素材")+(state.model?(years?metric("car",years):""):metric("car",count(models.size)+" 款车型"))+metric("layers",count(cats.size)+" 个已用类目");
  document.title=title+" · AOOA素材库";
}
function renderFilters() {
  $("category-filters").innerHTML=["",...state.categories].map(c=>'<button class="chip '+(state.category===c?"active":"")+'" data-category="'+escapeHtml(c)+'" aria-pressed="'+(state.category===c)+'">'+escapeHtml(c||"全部")+'</button>').join("");
  const formats=[...new Set(state.assets.map(a=>a.ext))].filter(Boolean).sort();
  $("format").innerHTML='<option value="">全部格式</option>'+formats.map(x=>'<option value="'+escapeHtml(x)+'">'+escapeHtml(x.toUpperCase())+'</option>').join("");
  $("format").value=state.format;
  $("clear-search").hidden=!state.query;
  $("search-shortcut").hidden=Boolean(state.query);
}
// Alternate models to surface different fitments on the first page of a mixed library.
function galleryOrder(items) {
  const groups=new Map();
  for (const a of items) {
    if (!groups.has(a.model)) groups.set(a.model,[]);
    groups.get(a.model).push(a);
  }
  function rank(a) {
    const name=a.name.replace(/\.[^.]+$/,"");
    let base=/详情|对比|安装|compare/i.test(name)?5:0;
    if (/红|橙|黄|蓝|绿|紫/.test(name)) base-=3;
    if (/字|logo/i.test(name)) base--;
    if (/\d$/.test(name)) base+=3;
    if (/四件套白底图/.test(a.title)) base-=7;
    if (/装车实拍/.test(a.title) && a.model==="Model Y") base-=15;
    if (/红色罩 · 正面/.test(a.title) && a.model==="Model 3") base-=15;
    if (/浅蓝/.test(a.title) && /EcoBoost/.test(a.model)) base-=2;
    if (/橘红/.test(a.title) && /Cybertruck/.test(a.model)) base-=2;
    if (/薰衣草/.test(a.title) && /Civic/.test(a.model)) base-=2;
    if (/副本/.test(a.name)) base+=4;
    if (a.kind!=="image") base+=7;
    return base;
  }
  const buckets=[...groups].sort(([a],[b])=>Number(unknown(a))-Number(unknown(b)) || byName.compare(a,b)).map(([,rows])=>rows.sort((a,b)=>rank(a)-rank(b)||byName.compare(a.name,b.name)));
  const sorted=[];
  for (let i=0;i<Math.max(0,...buckets.map(rows=>rows.length));i++) for (const rows of buckets) if (rows[i]) sorted.push(rows[i]);
  return sorted;
}
function card(a) {
  const checked=state.selection.has(a.id);
  const tone=/组合/.test(a.category)?"combo":unknown(a.category)?"unknown":a.category==="汽车制动卡钳"?"caliper":"cover";
  const title=a.title||a.name;
  return '<button type="button" class="asset-card '+(checked?'selected':'')+'" data-id="'+a.id+'" title="'+escapeHtml(a.name)+'" aria-label="'+escapeHtml((state.selecting?"选择 ":"预览 ")+a.model+" "+a.name)+'" '+(state.selecting?'aria-pressed="'+checked+'"':'')+'><div class="media"><span class="media-fallback" hidden>'+icon(a.kind==="video"?"play":a.kind==="image"?"image":"file",26)+'</span><img src="'+escapeHtml(a.thumb)+'" alt="" loading="lazy" decoding="async"><span class="file-chip">'+escapeHtml(a.ext.toUpperCase())+'</span><span class="check-overlay">'+icon("check",14)+'</span></div><div class="card-body"><div class="card-model">'+escapeHtml(modelLabel(a.model))+'</div><div class="card-title" title="'+escapeHtml(title)+'">'+escapeHtml(title)+'</div><div class="card-meta"><span class="cat-tag" data-tone="'+tone+'">'+escapeHtml(a.category)+'</span><span class="file-size">'+sizeLabel(a.size)+'</span></div></div></button>';
}
function renderSelection() {
  $("batch-bar").hidden=!state.selecting;
  $("selected-count").textContent="已选 "+count(state.selection.size)+" 份";
  $("classify-selection").disabled=state.selection.size===0;
  $("select-mode").setAttribute("aria-pressed",state.selecting);
  $("select-mode").hidden=state.selecting;
  const selectedHere=pageItems.filter(a=>state.selection.has(a.id)).length;
  $("select-page").checked=pageItems.length>0&&selectedHere===pageItems.length;
  $("select-page").indeterminate=selectedHere>0 && selectedHere<pageItems.length;
  $("select-page").disabled=pageItems.length===0;
  $("select-all-results").hidden=matches.length<=pageItems.length;
  $("select-all-results").disabled=matches.length===state.selection.size;
  $("select-all-results").textContent="选中全部 "+count(matches.length)+" 份";
  $("assets").classList.toggle("selecting",state.selecting);
}
function renderResults() {
  // Keep short Tesla model names intact rather than matching the digit in any filename.
  const tokens=state.query.trim()
    .replace(/model[\s_-]+([3y])/gi,"model$1")
    .replace(/(?<!\d)((?:19|20)\d{2})(?!\d)\s*(?:年款|年|款)?/g," $1 ")
    .split(/\s+/).map(compact).filter(Boolean);
  matches=state.assets.filter(a=>scoped(a) && (!state.category || a.category===state.category) && (!state.format || a.ext===state.format) && searchMatch(a,tokens));
  if (state.sort==="gallery") matches=galleryOrder(matches);
  else matches.sort((a,b)=>(state.sort==="recent"?b.mtime-a.mtime:0)||byName.compare(a.name,b.name));
  const pages=Math.max(1,Math.ceil(matches.length/pageSize));
  state.page=Math.min(pages,state.page);
  pageItems=matches.slice((state.page-1)*pageSize,state.page*pageSize);
  $("assets").innerHTML=pageItems.map(card).join("");
  $("assets").classList.toggle("list-mode",state.layout==="list");
  $("assets").setAttribute("aria-busy","false");
  $("grid-view").setAttribute("aria-pressed",state.layout==="grid");
  $("list-view").setAttribute("aria-pressed",state.layout==="list");
  $("empty").hidden=matches.length!==0;
  $("result-count").textContent=count(matches.length);
  $("pagination").hidden=pages<=1;
  $("pagination").innerHTML='<button class="button" data-page="-1" '+(state.page===1?"disabled":"")+'>上一页</button><span>第 '+state.page+' / '+pages+' 页</span><button class="button" data-page="1" '+(state.page===pages?"disabled":"")+'>下一页</button>';
  renderSelection();
}
function render() {renderNavigation();renderScope();renderFilters();renderResults();}
function resetPage() {state.page=1;state.selection.clear();}
function selectScope(type, model="") {
  resetPage();
  Object.assign(state,{review:type==="review",model:type==="model"?model:"",category:"",format:"",query:"",selecting:false});
  $("query").value="";
  if (document.body.classList.contains("nav-open")) openNav(false);
  render();
  window.scrollTo(0,0);
}
function notice(message) {
  clearTimeout(toastTimer);
  $("toast").textContent=message;$("toast").hidden=false;
  toastTimer=setTimeout(()=>{$("toast").hidden=true;},3200);
}
async function api(path, body) {
  if (publicLibrary && body !== undefined) throw new Error("公开素材库仅供浏览和下载。");
  const response=await fetch(path,body===undefined?{cache:"no-store"}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  if (!response.ok) {
    let error;try {error=(await response.json()).error;} catch {}
    throw new Error(error || "操作失败，请重试（"+response.status+"）");
  }
  return response.json();
}
async function load() {
  const library=await api(publicLibrary ? "./library.json" : "./api/library");
  Object.assign(state,{assets:library.assets,models:library.models,categories:library.categories});
  if (state.model&&!state.models.includes(state.model)) state.model="";
  indexAssets();render();
  $("db-status").textContent=publicLibrary ? "公开素材库" : "本地素材库已连接";
  $("error-banner").hidden=true;
}
function reportError(error) {
  $("error-banner").textContent=error.message || "素材读取失败，请刷新后再试。";
  $("error-banner").hidden=false;
}
const dlg=$("editor");
function dialog(title, body, detail=false) {
  dlg.classList.toggle("detail",detail);
  $("editor-content").innerHTML='<div class="modal-head"><h2 id="dialog-title">'+escapeHtml(title)+'</h2><button class="icon-button" data-close aria-label="关闭">'+icon("x",20)+'</button></div>'+body;
  dlg.setAttribute("aria-labelledby","dialog-title");
  if (!dlg.open) dlg.showModal();
  document.body.style.overflow="hidden";
}
function option(value,label,selected=false) {
  return '<option value="'+escapeHtml(value)+'" '+(selected?"selected":"")+'>'+escapeHtml(label)+'</option>';
}
function editFields(asset) {
  const categories=state.categories.map(c=>option(c,c,c===asset?.category)).join("");
  const models=state.models.map(m=>option(m,m)).join("");
  return '<label class="form-field">素材类目<select name="category">'+(asset?"":option("","保留原类目",true))+categories+'</select></label><label class="form-field">适用车型<input name="model" list="known-models" maxlength="80" value="'+escapeHtml(asset?.model||"")+'" placeholder="'+(asset?"选择或输入车型":"保留原车型，或输入新车型")+'" '+(asset?"required":"")+'></label><datalist id="known-models">'+models+'</datalist>';
}
function formEnd(label) {
  return '<div class="form-error" role="alert" hidden></div><div class="modal-actions"><button type="button" class="button" data-close>取消</button><button class="button dark" type="submit">'+label+'</button></div>';
}
function preview(a) {
  focusedCard=a.id;
  const file=escapeHtml(a.url);
  let media='<span class="media-fallback">'+icon("file",32)+'<span>请使用原文件查看此格式</span></span>';
  if(a.kind==="image") media='<img src="'+file+'" alt="'+escapeHtml(a.title||a.name)+'">';
  if(a.kind==="video") media='<video src="'+file+'" controls preload="metadata"></video>';
  const header='<h3 class="file-name">'+escapeHtml(a.name)+'</h3><p class="file-facts">'+escapeHtml([a.ext.toUpperCase(),sizeLabel(a.size),a.year].filter(Boolean).join(" · "))+'</p>';
  let details;
  if (publicLibrary) {
    const fields=[["适用车型",modelLabel(a.model)],["素材类目",a.category],["素材描述",a.title]];
    const rows=fields.filter(([,value])=>value).map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+escapeHtml(value)+'</dd></div>').join("");
    const download='<a class="button dark download-original" href="'+file+'" download="'+escapeHtml(a.name)+'">'+icon("download")+'免费下载原文件</a>';
    details='<dl class="public-metadata">'+rows+'</dl>'+download;
  } else {
    details='<form data-form="asset" data-id="'+a.id+'">'+editFields(a)+formEnd("保存修改")+'</form><div class="path"><small>原文件路径</small><p>'+escapeHtml(a.path)+'</p></div><div class="file-actions"><a class="button" href="'+file+'" target="_blank" rel="noopener">'+icon("external",15)+'打开原文件</a><button class="button" data-reveal="'+a.id+'">'+icon("folder",15)+'定位原文件</button></div><p class="reveal-status file-facts" role="status"></p>';
  }
  dialog("素材详情",'<div class="detail-layout"><div class="preview-pane">'+media+'</div><div class="detail-info">'+header+details+'</div></div>',true);
}
function newCategory() {
  dialog("新建类目",'<form class="form-body" data-form="category"><label class="form-field">类目名称<input name="name" placeholder="例如：安装实拍" required maxlength="80" autocomplete="off"></label>'+formEnd("创建类目")+'</form>');
  dlg.querySelector('[name="name"]').focus();
}
function batchEdit() {
  dialog("调整 "+count(state.selection.size)+" 份素材的归属",'<form class="form-body" data-form="batch">'+editFields(null)+formEnd("保存归属")+'</form>');
}
async function submitForm(event) {
  event.preventDefault();
  const form=event.target;
  const values=Object.fromEntries(new FormData(form));
  const submit=form.querySelector('[type="submit"]');
  const error=form.querySelector(".form-error");
  const creating=form.dataset.form==="category";
  const batch=form.dataset.form==="batch";
  error.hidden=true;submit.disabled=true;
  try {
    let message;
    if(creating) {
      const name=values.name.trim();
      if (!name) throw new Error("请输入类目名称。");
      if (state.categories.some(c=>c.toLowerCase()===name.toLowerCase())) throw new Error("已有同名类目，请换一个名称。");
      await api("./api/categories",{name});
      message="已创建类目「"+name+"」";
    } else {
      const ids=batch?[...state.selection]:[Number(form.dataset.id)];
      const a=batch?null:dataById.get(ids[0]);
      const changes={ids};
      if(values.category && values.category!==a?.category) changes.category=values.category;
      if(values.model.trim() && values.model.trim()!==a?.model) changes.model=values.model.trim();
      if(Object.keys(changes).length===1) throw new Error(batch?"请选择目标类目或填写车型。":"车型和类目均未修改。");
      await api("./api/assets",changes);
      message="已保存 "+count(ids.length)+" 份素材的归属";
      state.selecting=false;state.selection.clear();
    }
    await load();dlg.close();notice(message);
  } catch(e) {error.textContent=e.message;error.hidden=false;}
  finally {submit.disabled=false;}
}
$("library-nav").addEventListener("click",e=>{const row=e.target.closest("[data-nav]");if(row)selectScope(row.dataset.nav);});
$("model-nav").addEventListener("click",e=>{
  const brand=e.target.closest("[data-brand]");
  if(brand) {
    const name=brand.dataset.brand;
    const opened=state.closedBrands.delete(name);
    if(!opened)state.closedBrands.add(name);
    brand.setAttribute("aria-expanded",opened);brand.nextElementSibling.hidden=!opened;
    return;
  }
  const row=e.target.closest("[data-nav]");
  if(row)selectScope("model",row.dataset.value);
});
$("category-filters").addEventListener("click",e=>{
  const chip=e.target.closest("[data-category]");
  if(!chip)return;
  state.category=chip.dataset.category;resetPage();renderFilters();renderResults();
  [...$("category-filters").children].find(c=>c.dataset.category===state.category)?.focus({preventScroll:true});
});
$("query").addEventListener("input",e=>{
  state.query=e.target.value;resetPage();renderResults();
  $("clear-search").hidden=!state.query;$("search-shortcut").hidden=Boolean(state.query);
});
$("clear-search").onclick=()=>{$("query").value="";$("query").dispatchEvent(new Event("input"));$("query").focus();};
$("format").onchange=e=>{state.format=e.target.value;resetPage();renderResults();};
$("sort").onchange=e=>{state.sort=e.target.value;state.page=1;renderResults();};
$("grid-view").onclick=()=>{state.layout="grid";renderResults();};
$("list-view").onclick=()=>{state.layout="list";renderResults();};
$("select-mode").onclick=()=>{state.selecting=true;renderResults();};
$("cancel-selection").onclick=()=>{state.selecting=false;state.selection.clear();renderResults();};
$("select-all-results").onclick=()=>{state.selection=new Set(matches.map(a=>a.id));renderResults();};
$("select-page").onchange=e=>{for(const a of pageItems)if(e.target.checked)state.selection.add(a.id);else state.selection.delete(a.id);renderResults();};
$("assets").addEventListener("click",e=>{
  const element=e.target.closest("[data-id]");if(!element)return;
  const id=Number(element.dataset.id);
  if(!state.selecting) return preview(dataById.get(id));
  if(!state.selection.delete(id))state.selection.add(id);
  element.classList.toggle("selected",state.selection.has(id));
  element.setAttribute("aria-pressed",state.selection.has(id));renderSelection();
});
$("assets").addEventListener("error",e=>{if(e.target.tagName==="IMG"){e.target.hidden=true;e.target.previousElementSibling.hidden=false;}},true);
$("pagination").onclick=e=>{const b=e.target.closest("[data-page]");if(b&&!b.disabled){state.page+=Number(b.dataset.page);renderResults();$("results-bar").scrollIntoView({block:"start"});}};
$("clear-filters").onclick=()=>selectScope("all");
$("new-category").onclick=newCategory;
$("classify-selection").onclick=batchEdit;
$("editor-content").addEventListener("submit",submitForm);
dlg.addEventListener("click",async e=>{
  const reveal=e.target.closest("[data-reveal]");
  if(reveal){
    reveal.disabled=true;
    const status=dlg.querySelector(".reveal-status");
    try{await api("./api/reveal",{id:Number(reveal.dataset.reveal)});status.textContent="已在资源管理器中定位文件。";}
    catch(error){status.textContent=error.message;}
    finally{reveal.disabled=false;}
  }else if(e.target.closest("[data-close]")||e.target===dlg)dlg.close();
});
dlg.addEventListener("close",()=>{
  $("editor-content").replaceChildren();
  document.body.style.overflow="";
  if(focusedCard!==null){$("assets").querySelector('[data-id="'+focusedCard+'"]')?.focus({preventScroll:true});focusedCard=null;}
});
$("scan").onclick=async()=>{
  const btn=$("scan");btn.disabled=true;btn.lastElementChild.textContent="扫描中…";
  try{
    const result=await api("./api/scan",{});await load();
    notice("扫描完成，共 "+count(result.total)+" 份素材，新增 "+count(result.added)+" 份，移出 "+count(result.removed)+" 份");
  }catch(error){reportError(error);}
  finally{btn.disabled=false;btn.lastElementChild.textContent="重新扫描";}
};
$("open-nav").onclick=()=>openNav(true);$("close-nav").onclick=()=>openNav(false);$("scrim").onclick=()=>openNav(false);
document.addEventListener("keydown",e=>{
  if(dlg.open)return;
  if(e.key==="Escape"&&document.body.classList.contains("nav-open")){openNav(false);return;}
  if(e.key==="/"&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!["INPUT","SELECT","TEXTAREA"].includes(document.activeElement.tagName)){e.preventDefault();$("query").focus();}
});
load().catch(error=>{
  reportError(error);
  $("db-status").textContent=publicLibrary ? "素材索引读取失败" : "本地素材库连接失败";
  $("hero-stats").textContent=publicLibrary ? "请刷新页面重试" : "请检查服务后重新扫描";
  $("assets").setAttribute("aria-busy","false");
});
