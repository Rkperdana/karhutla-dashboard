/* Indonesia Karhutla Monitor 2026 — Geospatial Explorer
 * No simulated observations: all numeric values originate in BNPB responses.
 * GIS boundaries are separate from wildfire observations.
 */
(() => {
  'use strict';
  const BNPB_URL = 'https://gis.bnpb.go.id/server/rest/services/2026_karhutla/mv_prov_karhutla_2026/MapServer/3/query';
  const BIG_URL = 'https://geoservices.big.go.id/gis/rest/services/STIG/Batas_Provinsi/MapServer/0/query';
  const FALLBACK_GEO = 'https://cdn.jsdelivr.net/gh/AlfianAliM/Indonesia-GeoJSON@master/provinsi.geojson';
  const PROVINCES = ['Riau','Jambi','Sumatera Selatan','Kalimantan Barat','Kalimantan Tengah','Kalimantan Selatan'];
  const FIELDS = ['provinsi','tgl_update','total_hotspot','hotspot_rendah','hotspot_sedang','hotspot_tinggi','luas_lahan_terbakar_sipongi_2026','total_personil_gabungan','sortie_water_bombing'];
  const $ = id => document.getElementById(id);
  const nf = new Intl.NumberFormat('id-ID', {maximumFractionDigits: 2});
  const nd = new Intl.DateTimeFormat('id-ID', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  const state = {records:[], source:'', fetched:null, loadError:'', province:'', mapMode:'hotspot', levels:new Set(['rendah','sedang','tinggi']), showBoundaries:true, map:null, shapes:null, selected:null, geoFeatures:[], geoReady:false, isDark:false};
  const ICONS = {
    refresh:'<path d="M20 11a8.1 8.1 0 0 0-14.9-3M4 4v5h5"/><path d="M4 13a8.1 8.1 0 0 0 14.9 3M20 20v-5h-5"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
    moon:'<path d="M20.9 13.3A9 9 0 0 1 10.7 3.1 9 9 0 1 0 20.9 13.3Z"/>',
    sliders:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="currentColor" stroke="#fff"/><circle cx="16" cy="17" r="2" fill="currentColor" stroke="#fff"/>',
    search:'<circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 5 5"/>',
    layers:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
    expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
    pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    fire:'<path d="M12 22c-5 0-8-3-8-8 0-4 3-7 4-9 1 4 3 5 4 6 2-3 3-6 2-9 4 4 6 8 6 12 0 5-3 8-8 8Z"/><path d="M12 22c-3 0-4-2-4-4s3-5 4-6c0 3 4 4 4 6s-1 4-4 4Z"/>',
    tree:'<path d="M12 3 4 13h5l-4 5h14l-4-5h5L12 3Zm0 15v4"/>',
    people:'<circle cx="9" cy="8" r="3"/><circle cx="17.5" cy="9" r="2"/><path d="M3 20v-2a6 6 0 0 1 12 0v2H3Zm13-7a5 5 0 0 1 5 5v2h-4"/>',
    helicopter:'<path d="M3 12c0-3 3-5 6-5h7c2 0 4 2 4 5v4H3v-4Zm5 4v4m9-4v4M2 5h20M14 7v-2M3 12l-2-3m21 4-2 3"/>',
    chart:'<path d="M3 3v18h18"/><path d="m7 15 4-5 4 3 5-7"/>',
    trophy:'<path d="M7 4h10v7a5 5 0 0 1-10 0V4Zm-2 2H3v3a4 4 0 0 0 4 4m12-7h2v3a4 4 0 0 1-4 4M12 16v4m-5 1h10"/>',
    pie:'<path d="M11 3v9h9A9 9 0 1 1 11 3Z"/><path d="M14 3a9 9 0 0 1 7 7h-7V3Z"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>'
  };
  function installIcons() { document.querySelectorAll('svg[data-icon]').forEach(svg => {const kind=svg.dataset.icon;svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.innerHTML=ICONS[kind]||ICONS.info;}); }
  function toast(msg) { const el=$('toast'); el.textContent=msg; el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),4200); }
  function norm(value) { let s=String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\bPROVINSI\b/g,'').replace(/\bDAERAH ISTIMEWA\b/g,'DI').replace(/\bDAERAH KHUSUS IBUKOTA\b/g,'DKI').replace(/\bSUMATRA\b/g,'SUMATERA').replace(/\bKEP\.?\b/g,'KEPULAUAN').replace(/[^A-Z0-9]+/g,' ').trim().replace(/\s+/g,' ');if(s==='JAKARTA')s='DKI JAKARTA';if(s==='YOGYAKARTA')s='DI YOGYAKARTA';if(s==='BANGKA BELITUNG')s='KEPULAUAN BANGKA BELITUNG';if(s==='RIAU KEPULAUAN')s='KEPULAUAN RIAU';return s; }
  const canonical = new Map(PROVINCES.map(p=>[norm(p),p]));
  function provinceName(x){return canonical.get(norm(x)) || String(x||'').trim();}
  const finite = x => (x===null||x===undefined||x===''||!Number.isFinite(Number(x))) ? null : Number(x);
  const fmt = x => x===null||x===undefined ? '—' : nf.format(x);
  function formatDate(v){if(!v)return '—';const m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);if(!m)return String(v);return nd.format(new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`));}
  function isValidItem(obj){return obj && typeof obj === 'object' && Object.hasOwn(obj,'provinsi') && String(obj.provinsi||'').trim();}
  function parseRecords(response){
    if(response?.error)throw new Error(response.error.message||'Respons API error');
    if(!Array.isArray(response?.features))throw new Error('Struktur respons tidak memiliki features');
    const rows=response.features.map(f=>f?.attributes||f?.properties||f).filter(isValidItem).map(a=>{
      const output={...a,provinsi:provinceName(a.provinsi)};
      for(const k of FIELDS.filter(k=>!['provinsi','tgl_update'].includes(k)))output[k]=finite(a[k]);
      return output;
    });
    // Do not add duplicate snapshots. Use the latest date per province, not a sum across reporting dates.
    const latest=new Map();
    for(const row of rows){const key=norm(row.provinsi), old=latest.get(key);if(!old||String(row.tgl_update||'')>String(old.tgl_update||''))latest.set(key,row);}
    return [...latest.values()].filter(r=>canonical.has(norm(r.provinsi))).sort((a,b)=>a.provinsi.localeCompare(b.provinsi,'id'));
  }
  async function fetchJson(url, timeoutMs=14000){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{const response=await fetch(url,{signal:controller.signal,cache:'no-store'});if(!response.ok)throw new Error('HTTP '+response.status);return await response.json();}
    finally{clearTimeout(timer)}
  }
  function setStatus(type, message){const el=$('source-status');el.className='source-status '+type;$('source-status-text').textContent=message;}
  function setScope(){
    const n=state.records.length;
    const dates=state.records.map(r=>r.tgl_update).filter(Boolean).sort();
    const first=dates[0], lastDate=dates.at(-1);
    const period=lastDate?(first!==lastDate?`${formatDate(first)}–${formatDate(lastDate)}`:formatDate(lastDate)):'belum tersedia';
    $('scope-caption').textContent=n?`${n} provinsi · Data per ${period} · bukan total nasional`:'Data per: belum tersedia';
    $('scope-notice').textContent=n?`${n} provinsi memiliki rekaman dalam layer ini. Angka yang ditampilkan merupakan agregat wilayah tercakup, bukan total nasional. Nilai kosong bukan nol.`:'Hanya provinsi yang tersedia pada layanan BNPB masuk perhitungan. Wilayah tanpa data tidak dianggap nol.';
    let last=state.records.map(r=>r.tgl_update).filter(Boolean).sort().at(-1);
    $('footer-update').textContent='Tanggal rujukan BNPB: '+formatDate(last)+(state.fetched?' · Diambil: '+new Date(state.fetched).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short'})+' WIB':'');
  }
  function filteredRecords(){return state.province?state.records.filter(r=>norm(r.provinsi)===norm(state.province)):state.records;}
  function displayedHotspot(rec){const sel=[...state.levels];if(sel.length===0)return null;if(sel.length===3 && rec.total_hotspot!==null)return rec.total_hotspot;const vals=sel.map(k=>rec['hotspot_'+k]);return vals.some(v=>v===null||v===undefined)?null:vals.reduce((a,b)=>a+b,0);}
  function byMetric(rec,metric){return metric==='area'?rec.luas_lahan_terbakar_sipongi_2026:displayedHotspot(rec);}
  function sumField(rows,extract){const vals=rows.map(extract).filter(v=>v!==null&&v!==undefined&&Number.isFinite(v));return vals.length?vals.reduce((a,b)=>a+b,0):null;}
  function renderKpis(){const rows=filteredRecords();const total=sumField(rows,displayedHotspot);$('kpi-hotspot').textContent=fmt(total);$('kpi-area').textContent=fmt(sumField(rows,r=>r.luas_lahan_terbakar_sipongi_2026));$('kpi-personnel').textContent=fmt(sumField(rows,r=>r.total_personil_gabungan));$('kpi-sorties').textContent=fmt(sumField(rows,r=>r.sortie_water_bombing));$('kpi-hotspot-sub').textContent=rows.length?`${rows.length} provinsi tercakup`:'Menunggu data';}
  function renderRanking(){const metric=$('ranking-metric').value;const rows=filteredRecords().map(r=>({name:r.provinsi,value:byMetric(r,metric)})).filter(r=>r.value!==null).sort((a,b)=>b.value-a.value).slice(0,5);const el=$('ranking-list');el.replaceChildren();if(!rows.length){el.innerHTML='<div class="list-empty">Belum ada data yang dapat diperingkat.</div>';return;}const max=Math.max(...rows.map(r=>r.value),1);rows.forEach((r,i)=>{const node=document.createElement('button');node.type='button';node.className='rank-row';node.style.cssText='width:100%;border:0;background:none;padding:0;text-align:left;cursor:pointer';node.innerHTML=`<span class="rank-num">${i+1}</span><span class="rank-label"></span><span class="rank-bartrack"><span class="rank-barfill" style="display:block;width:${Math.max(0,r.value/max*100)}%"></span></span><span class="rank-value">${fmt(r.value)}</span>`;node.querySelector('.rank-label').textContent=r.name;node.title=`Lihat ${r.name}`;node.addEventListener('click',()=>chooseProvince(r.name));el.append(node);});}
  function renderDonut(){const rows=filteredRecords();const get=k=>sumField(rows,r=>r['hotspot_'+k]);const low=get('rendah'),med=get('sedang'),high=get('tinggi');$('legend-low').textContent=fmt(low);$('legend-med').textContent=fmt(med);$('legend-high').textContent=fmt(high);const values=[high,med,low];const total=values.every(v=>v!==null)?values.reduce((a,b)=>a+b,0):null;$('donut-value').textContent=fmt(total);$('donut-label').textContent=total===null?'Belum ada data':'hotspot';const d=$('donut');if(total>0){const pHigh=high/total*100,pMed=med/total*100;d.style.background=`conic-gradient(#ed4b49 0 ${pHigh}%,#f88b35 ${pHigh}% ${pHigh+pMed}%,#fbc74b ${pHigh+pMed}% 100%)`;}else d.style.background='#e7ecf2';}
  function renderTable(){const tbody=$('province-table');tbody.replaceChildren();const rows=filteredRecords();if(!rows.length){tbody.innerHTML='<tr><td colspan="5" class="table-empty">Tidak ada data provinsi yang dapat ditampilkan.</td></tr>';return;}for(const r of rows){const tr=document.createElement('tr');const values=[r.provinsi,fmt(displayedHotspot(r)),fmt(r.luas_lahan_terbakar_sipongi_2026),fmt(r.total_personil_gabungan),formatDate(r.tgl_update)];for(const v of values){const td=document.createElement('td');td.textContent=v;tr.append(td);}tr.addEventListener('click',()=>chooseProvince(r.provinsi));tbody.append(tr);}}
  function renderDetails(){const name=state.selected||state.province;const panel=$('province-detail');if(!name){$('detail-empty').hidden=false;$('detail-content').hidden=true;panel.classList.remove('selected');return;}
    panel.classList.add('selected');$('detail-empty').hidden=true;$('detail-content').hidden=false;$('detail-name').textContent=name;
    const r=state.records.find(x=>norm(x.provinsi)===norm(name));$('detail-coverage').textContent=r?'Rekaman tersedia dalam layer BNPB':'Tidak ada rekaman untuk provinsi ini';$('detail-date').textContent=r?'Pembaruan BNPB: '+formatDate(r.tgl_update):'Ketiadaan rekaman tidak berarti tidak ada karhutla.';
    const rows=[['Total hotspot',r?displayedHotspot(r):null],['Hotspot tinggi',r?.hotspot_tinggi],['Hotspot sedang',r?.hotspot_sedang],['Hotspot rendah',r?.hotspot_rendah],['Luas terbakar (ha)',r?.luas_lahan_terbakar_sipongi_2026],['Personel gabungan',r?.total_personil_gabungan],['Sortie water bombing',r?.sortie_water_bombing]];
    $('detail-list').replaceChildren();rows.forEach(([key,val])=>{const node=document.createElement('div');const label=document.createElement('span'),str=document.createElement('strong');label.textContent=key;str.textContent=fmt(val);node.append(label,str);$('detail-list').append(node);});
  }
  function valColor(v,max){if(v===null)return '#8a98a8';if(v===0)return '#b4c8d4';const p=max<=0?0:v/max;return p>.75?'#b83f48':p>.45?'#eb6c42':p>.18?'#f6a652':'#fbdc83';}
  function recordFor(name){return state.records.find(r=>norm(r.provinsi)===norm(name));}
  function geoName(properties){const keys=['WADMPR','wadmpr','name','NAME_1','nama','provinsi','NAMA_PROV','PROVINSI','prov_name','province','NAMA','Propinsi'];for(const key of keys){if(typeof properties?.[key]==='string'&&properties[key].trim())return provinceName(properties[key]);}for(const [k,v] of Object.entries(properties||{})){if(typeof v==='string'&&canonical.has(norm(v)))return provinceName(v);}return ''}
  function renderMap(){if(!state.shapes)return;const max=Math.max(0,...state.records.map(r=>byMetric(r,state.mapMode)).filter(v=>v!==null));state.shapes.eachLayer(layer=>{const name=geoName(layer.feature?.properties),rec=recordFor(name),value=rec?byMetric(rec,state.mapMode):null;layer.setStyle({color:state.selected===name?'#fff0a2':'#d4dde5',weight:state.showBoundaries?(state.selected===name?2.7:1.2):0,fillColor:valColor(value,max),fillOpacity:value===null?.42:.82});if(layer.bringToFront&&state.selected===name)layer.bringToFront();});$('legend-title').textContent=state.mapMode==='area'?'Luas terbakar terlapor (ha)':'Jumlah hotspot terlapor';$('map-caption-text').textContent='Warna menunjukkan '+(state.mapMode==='area'?'luas terbakar':'jumlah hotspot')+', bukan tingkat risiko kebakaran.';}
  function render(){setScope();renderKpis();renderRanking();renderDonut();renderTable();renderDetails();renderMap();}
  function chooseProvince(name){const clean=provinceName(name);state.selected=clean;state.province=clean;$('province-select').value=clean;$('map-search').value='';$('search-results').hidden=true;render();if(state.shapes){let match;state.shapes.eachLayer(layer=>{if(norm(geoName(layer.feature?.properties))===norm(clean))match=layer;});if(match&&match.getBounds)state.map.fitBounds(match.getBounds(),{maxZoom:7,padding:[26,26],animate:true});}closeFilter();}
  function clearProvince(){state.province='';state.selected='';$('province-select').value='';render();if(state.map)state.map.flyTo([-2.5,118.3],5,{animate:true,duration:.6});}
  function changeLayer(mode){state.mapMode=mode;document.querySelectorAll('input[name="map-mode"]').forEach(e=>e.checked=e.value===mode);renderMap();}
  function fillProvinceOptions(){const sel=$('province-select');for(const p of PROVINCES){const o=document.createElement('option');o.value=p;o.textContent=p;sel.append(o);}}
  function closeFilter(){$('filters').classList.remove('open');$('filter-scrim').classList.remove('open');}
  function installEvents(){
    $('filter-mobile-btn').addEventListener('click',()=>{$('filters').classList.add('open');$('filter-scrim').classList.add('open');});$('filter-close-btn').addEventListener('click',closeFilter);$('filter-scrim').addEventListener('click',closeFilter);
    $('province-select').addEventListener('change',e=>e.target.value?chooseProvince(e.target.value):clearProvince());
    document.querySelectorAll('input[data-confidence]').forEach(e=>e.addEventListener('change',ev=>{const key=ev.target.dataset.confidence;ev.target.checked?state.levels.add(key):state.levels.delete(key);render();}));
    document.querySelectorAll('input[name="map-mode"]').forEach(e=>e.addEventListener('change',ev=>changeLayer(ev.target.value)));
    $('show-boundaries').addEventListener('change',ev=>{state.showBoundaries=ev.target.checked;renderMap();});
    $('reset-btn').addEventListener('click',()=>{state.levels=new Set(['rendah','sedang','tinggi']);document.querySelectorAll('input[data-confidence]').forEach(e=>e.checked=true);$('show-boundaries').checked=true;state.showBoundaries=true;changeLayer('hotspot');clearProvince();toast('Filter kembali ke pengaturan awal.');});
    $('detail-close-btn').addEventListener('click',clearProvince);
    $('ranking-metric').addEventListener('change',renderRanking);
    $('map-search').addEventListener('input',e=>{const q=norm(e.target.value),list=$('search-results');list.replaceChildren();if(!q){list.hidden=true;return;}const matches=PROVINCES.filter(p=>norm(p).includes(q)).slice(0,8);for(const p of matches){const b=document.createElement('button');b.type='button';b.textContent=p;b.addEventListener('click',()=>chooseProvince(p));list.append(b);}list.hidden=!matches.length;});
    $('map-search').addEventListener('keydown',e=>{if(e.key==='Enter'){const q=norm(e.target.value),match=PROVINCES.find(p=>norm(p).includes(q));if(match)chooseProvince(match);}if(e.key==='Escape')$('search-results').hidden=true;});
    document.addEventListener('click',e=>{if(!e.target.closest('.search-wrap'))$('search-results').hidden=true;});
    $('refresh-btn').addEventListener('click',()=>loadBnpb(true));
    $('layer-btn').addEventListener('click',()=>{changeLayer(state.mapMode==='hotspot'?'area':'hotspot');toast('Layer peta: '+(state.mapMode==='hotspot'?'hotspot':'luas terbakar'));});
    $('fullscreen-btn').addEventListener('click',async()=>{const node=$('peta');try{if(!document.fullscreenElement&&node.requestFullscreen)await node.requestFullscreen();else if(document.exitFullscreen)await document.exitFullscreen();setTimeout(()=>state.map?.invalidateSize(),150);}catch(e){toast('Mode layar penuh tidak tersedia.');}});
    document.addEventListener('fullscreenchange',()=>setTimeout(()=>state.map?.invalidateSize(),220));
    $('theme-btn').addEventListener('click',()=>{state.isDark=!state.isDark;document.documentElement.classList.toggle('dark-ui',state.isDark);$('theme-btn').innerHTML=`<svg data-icon="${state.isDark?'moon':'sun'}"></svg>`;installIcons();});
    document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>{const view=btn.dataset.view;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$(view)?.scrollIntoView({behavior:'smooth',block:'start'});}));
    document.querySelectorAll('[data-trend]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-trend]').forEach(x=>x.classList.toggle('active',x===b));}));
    $('download-csv-btn').addEventListener('click',()=>download('csv'));$('download-json-btn').addEventListener('click',()=>download('json'));
  }
  function csvCell(x){return '"'+String(x??'').replaceAll('"','""')+'"';}
  function download(format){const rows=filteredRecords();if(!rows.length){toast('Data BNPB belum tersedia untuk diunduh.');return;}const fields=['provinsi','tgl_update','total_hotspot','hotspot_rendah','hotspot_sedang','hotspot_tinggi','luas_lahan_terbakar_sipongi_2026','total_personil_gabungan','sortie_water_bombing'];const payload=format==='json'?JSON.stringify({source:'BNPB 2026 Karhutla MapServer/3',notice:'Cakupan terbatas; bukan total nasional',fetched_at:state.fetched,records:rows},null,2):'\ufeff'+[fields.join(','),...rows.map(r=>fields.map(f=>csvCell(r[f])).join(','))].join('\r\n');const blob=new Blob([payload],{type:format==='json'?'application/json;charset=utf-8':'text/csv;charset=utf-8'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='karhutla-bnpb-2026-tercakup.'+format;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  async function loadBnpb(userTriggered=false){setStatus('pending','Menghubungkan BNPB');const url=new URL(BNPB_URL);url.search=new URLSearchParams({where:'1=1',outFields:FIELDS.join(','),returnGeometry:'false',f:'json',resultRecordCount:'2000'});let fallback=false;try{const json=await fetchJson(url.toString(),15000);const recs=parseRecords(json);if(!recs.length)throw new Error('Respons BNPB tidak berisi rekaman provinsi');state.records=recs;state.source='live';state.fetched=new Date().toISOString();setStatus('ok','BNPB · '+recs.length+' provinsi');if(userTriggered)toast('Data berhasil dimuat dari BNPB untuk '+recs.length+' provinsi.');}
    catch(error){state.loadError=error.message;try{const json=await fetchJson('data/karhutla.json',4500);const recs=parseRecords(json);if(recs.length){state.records=recs;state.source='snapshot';state.fetched=json.fetched_at||null;setStatus('pending','Snapshot BNPB · '+recs.length+' provinsi');fallback=true;if(userTriggered)toast('API langsung tidak tersedia. Menggunakan snapshot BNPB.');}else throw Error('Snapshot kosong');}catch(_){state.records=[];state.source='';setStatus('err','Data belum tersedia');if(userTriggered)toast('API BNPB belum dapat diakses dari browser; data tidak direkayasa.');}}
    render();if(!fallback && !state.records.length)console.warn('Koneksi BNPB tidak tersedia:',state.loadError);
  }
  async function initMap(){const loader=$('map-loading');if(typeof window.L==='undefined'){loader.innerHTML='<strong>Peta interaktif belum dapat dimuat</strong><small>Periksa koneksi ke pustaka Leaflet.</small>';return;}
    state.map=L.map('map',{zoomControl:false,scrollWheelZoom:false,minZoom:4,maxZoom:12,preferCanvas:true}).setView([-2.5,118.5],5);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:19}).addTo(state.map);
    L.control.zoom({position:'bottomright'}).addTo(state.map);
    // Guaranteed interactive fallback: geographic reference markers, NOT hotspot locations.
    const centers=[
      ['Riau',0.53,101.45],['Jambi',-1.61,103.61],
      ['Sumatera Selatan',-3.32,104.91],['Kalimantan Barat',-0.03,109.34],
      ['Kalimantan Tengah',-1.68,113.38],['Kalimantan Selatan',-3.09,115.28]
    ];
    const markers=L.layerGroup().addTo(state.map);
    for(const [name,lat,lng] of centers){
      const marker=L.circleMarker([lat,lng],{radius:9,color:'#ffffff',weight:2,fillColor:'#ef7c43',fillOpacity:.9});
      marker.bindTooltip(name+' · penanda lokasi provinsi (bukan titik hotspot)',{direction:'top'});
      marker.on('click',()=>chooseProvince(name));
      marker.addTo(markers);
    }
    loader.hidden=true;
    setTimeout(()=>state.map?.invalidateSize(),100);

    const bigUrl=new URL(BIG_URL);
     bigUrl.search=new URLSearchParams({where:'1=1',outFields:'WADMPR',returnGeometry:'true',outSR:'4326',geometryPrecision:'3',maxAllowableOffset:'0.008',f:'geojson'});
     const sources=[String(bigUrl),FALLBACK_GEO];
     const attempts=sources.map(url=>fetchJson(url,8500).then(json=>{
       if(json?.type!=='FeatureCollection'||!Array.isArray(json.features)||json.features.length<6)throw Error('Geometri tidak lengkap');
       if(!json.features.some(f=>canonical.has(norm(geoName(f.properties)))))throw Error('Nama provinsi tidak dikenali');
       return json;
     }));
     let geo;
     try{geo=await Promise.any(attempts);}
     catch(err){console.warn('Batas provinsi gagal; penanda provinsi tetap aktif.',err);$('map-caption-text').textContent='Penanda menunjukkan lokasi perkiraan provinsi, bukan titik hotspot. Batas provinsi belum tersedia.';return;}
     state.geoFeatures=geo.features;state.geoReady=true;
    const layer=L.geoJSON({type:'FeatureCollection',features:geo.features.filter(f=>canonical.has(norm(geoName(f.properties))))},{renderer:L.canvas({padding:0.25}),style:()=>({color:'#d4dde5',weight:1.2,fillOpacity:.35,fillColor:'#7b8c9c'}),onEachFeature:(feature,polygon)=>{
      const name=geoName(feature.properties);if(name){polygon.bindTooltip(name,{direction:'top',sticky:true});polygon.on('click',()=>chooseProvince(name));polygon.on('mouseover',()=>polygon.setStyle({weight:2.5,color:'#fff3bf'}));polygon.on('mouseout',()=>renderMap());}
    }}).addTo(state.map);
    state.shapes=layer;if(layer.getLayers().length){markers.clearLayers();state.map.fitBounds(layer.getBounds(),{padding:[18,20],maxZoom:5,animate:false});}renderMap();
  }
  function start(){installIcons();fillProvinceOptions();installEvents();render();initMap();loadBnpb();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
