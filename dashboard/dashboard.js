let currentPage=1,PAGE_SIZE=10,searchTerm="";

const API_URL="https://script.google.com/macros/s/AKfycbyM3mhup2rSWXeodZJMfFETAegn5VMcznZi6YRlIsiB2meQhSI5l-BByaUaH3dhzEZFng/exec",
$=s=>document.querySelector(s);

let raw=[];

/* ==========================================================
   TERRITORIAL INTELLIGENCE
   ========================================================== */
const MAPBOX_TOKEN="pk.eyJ1IjoibWFycXVpbmhvIiwiYSI6ImNsbncydDkzNjA0MDEycWp5Y2hsZzNiZHoifQ.dUzSeWKWWe7R36yohDNb0g";
let territoryMap=null,territoryReady=false,territoryMarkers=[],territoryData=[],territory3D=true;
const geoCache=new Map();

const STATE_ALIASES={
  "nl":"Nuevo León","n l":"Nuevo León","nuevo leon":"Nuevo León","nuevo león":"Nuevo León",
  "coah":"Coahuila","coahuila":"Coahuila","tamps":"Tamaulipas","tamaulipas":"Tamaulipas",
  "cdmx":"Ciudad de México","df":"Ciudad de México","d f":"Ciudad de México","ciudad de mexico":"Ciudad de México",
  "ver":"Veracruz","veracruz":"Veracruz","pue":"Puebla","puebla":"Puebla","jal":"Jalisco","jalisco":"Jalisco",
  "qro":"Querétaro","queretaro":"Querétaro","querétaro":"Querétaro","slp":"San Luis Potosí","san luis potosi":"San Luis Potosí",
  "chih":"Chihuahua","chihuahua":"Chihuahua","son":"Sonora","sonora":"Sonora","sin":"Sinaloa","sinaloa":"Sinaloa",
  "gto":"Guanajuato","guanajuato":"Guanajuato","ags":"Aguascalientes","aguascalientes":"Aguascalientes",
  "yuc":"Yucatán","yucatan":"Yucatán","yucatán":"Yucatán","q roo":"Quintana Roo","quintana roo":"Quintana Roo"
};
const KNOWN_MUNICIPALITIES={
  "monterrey":{municipality:"Monterrey",state:"Nuevo León"},"mty":{municipality:"Monterrey",state:"Nuevo León"},
  "guadalupe":{municipality:"Guadalupe",state:"Nuevo León"},"apodaca":{municipality:"Apodaca",state:"Nuevo León"},
  "san nicolas":{municipality:"San Nicolás de los Garza",state:"Nuevo León"},"san nicolas de los garza":{municipality:"San Nicolás de los Garza",state:"Nuevo León"},
  "escobedo":{municipality:"General Escobedo",state:"Nuevo León"},"general escobedo":{municipality:"General Escobedo",state:"Nuevo León"},
  "santa catarina":{municipality:"Santa Catarina",state:"Nuevo León"},"san pedro":{municipality:"San Pedro Garza García",state:"Nuevo León"},
  "san pedro garza garcia":{municipality:"San Pedro Garza García",state:"Nuevo León"},"juarez":{municipality:"Juárez",state:"Nuevo León"},
  "garcia":{municipality:"García",state:"Nuevo León"},"santiago":{municipality:"Santiago",state:"Nuevo León"},
  "saltillo":{municipality:"Saltillo",state:"Coahuila"},"torreon":{municipality:"Torreón",state:"Coahuila"},
  "reynosa":{municipality:"Reynosa",state:"Tamaulipas"},"nuevo laredo":{municipality:"Nuevo Laredo",state:"Tamaulipas"},
  "matamoros":{municipality:"Matamoros",state:"Tamaulipas"},"victoria":{municipality:"Ciudad Victoria",state:"Tamaulipas"},
  "ciudad victoria":{municipality:"Ciudad Victoria",state:"Tamaulipas"}
};
function cleanPlace(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim()}
function titleCase(v){return String(v||"").toLowerCase().replace(/(^|\s)\S/g,m=>m.toUpperCase())}
function normalizeMunicipality(v){
  let original=String(v||"").trim(),c=cleanPlace(original); if(!c)return null;
  c=c.replace(/\bmexico\b/g,"").replace(/\bmx\b/g,"").trim();
  let state="";
  for(const [alias,name] of Object.entries(STATE_ALIASES).sort((a,b)=>b[0].length-a[0].length)){
    let re=new RegExp("(?:^|\\s)"+alias.replace(/\s+/g,"\\s+")+"(?:$|\\s)","i");
    if(re.test(c)){state=name;c=c.replace(re," ").replace(/\s+/g," ").trim();break}
  }
  let known=KNOWN_MUNICIPALITIES[c]; if(known)return {...known,key:cleanPlace(known.municipality+" "+known.state),original};
  let muni=titleCase(c); if(!muni)return null;
  return {municipality:muni,state,key:cleanPlace(muni+" "+state),original};
}
function normalizedPlaceLabel(v){let n=normalizeMunicipality(v);return n?(n.municipality+(n.state?", "+n.state:"")):(v||"Sin dato")}


const S=[
  ["Capricornio","♑"],
  ["Acuario","♒"],
  ["Piscis","♓"],
  ["Aries","♈"],
  ["Tauro","♉"],
  ["Géminis","♊"],
  ["Cáncer","♋"],
  ["Leo","♌"],
  ["Virgo","♍"],
  ["Libra","♎"],
  ["Escorpio","♏"],
  ["Sagitario","♐"]
];

const B=[20,19,21,20,21,21,23,23,23,23,22,22];

function z(v){
  let p=String(v||"").split("-"),
      m=+p[1],
      d=+p[2];

  return m&&d
    ?(d<B[m-1]?S[m-1]:S[m%12])
    :["Sin dato","✦"];
}

function dt(v){
  let m=String(v||"").match(
    /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/
  );

  return m
    ?new Date(+m[3],+m[2]-1,+m[1],+m[4],+m[5])
    :null;
}

function esc(v){
  return String(v??"").replace(
    /[&<>"']/g,
    c=>({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      "\"":"&quot;",
      "'":"&#039;"
    }[c])
  );
}

function isTest(r){
  return String(r.ID||"").startsWith("TEST-") ||
         String(r.ORIGEN_QR||"").toUpperCase()==="PRUEBA";
}

function counts(a,fn){
  let o={};

  a.forEach(x=>{
    let k=fn(x)||"Sin dato";
    o[k]=(o[k]||0)+1;
  });

  return Object.entries(o).sort((a,b)=>b[1]-a[1]);
}

function animateNumber(el,n){
  let s=performance.now(),
      from=Number(el.textContent)||0,
      d=650;

  function f(t){
    let p=Math.min(1,(t-s)/d),
        e=1-Math.pow(1-p,3);

    el.textContent=Math.round(from+(n-from)*e);

    if(p<1)requestAnimationFrame(f);
  }

  requestAnimationFrame(f);
}


/* ==========================================================
   CARGA DE DATOS
   ========================================================== */

async function load(){

  try{

    $("#status").textContent="Sincronizando universo…";

    let r=await fetch(
      API_URL+"?t="+Date.now(),
      {cache:"no-store"}
    );

    let d=await r.json();

    if(!d.ok)
      throw Error(d.error||"API");

    raw=d.registros||[];

    render();

    $("#status").textContent=
      "Conectado · "+raw.length+" señales recibidas";

    $("#status").className="";

    $("#updated").textContent=
      "Actualizado "+
      new Date().toLocaleTimeString(
        "es-MX",
        {
          hour:"2-digit",
          minute:"2-digit"
        }
      );

  }catch(e){

    $("#status").textContent=
      "Error de conexión · "+e.message;

    $("#status").className="error";
  }
}


/* ==========================================================
   RENDER GENERAL
   ========================================================== */

function render(){

  let a=$("#tests").checked
    ?raw
    :raw.filter(r=>!isTest(r));

  let now=new Date();

  animateNumber($("#total"),a.length);

  animateNumber(
    $("#today"),
    a.filter(r=>{
      let d=dt(r.FECHA_REGISTRO);

      return d &&
             d.toDateString()==now.toDateString();
    }).length
  );

  animateNumber(
    $("#pending"),
    a.filter(
      r=>String(r.ESTATUS).toUpperCase()=="PENDIENTE"
    ).length
  );

  animateNumber(
    $("#sources"),
    new Set(
      a.map(r=>r.ORIGEN_QR||"DIRECTO")
    ).size
  );

  hours(a);
  zs(a);

  $("#origins").innerHTML=
    rank(
      counts(a,r=>r.ORIGEN_QR||"DIRECTO")
    );

  $("#places").innerHTML=
    rank(
      counts(a,r=>normalizedPlaceLabel(r.LUGAR_NACIMIENTO))
    );

  recent(a);
  intelligence(a);
  territory(a);
}


/* ==========================================================
   ACTIVIDAD POR HORAS
   ========================================================== */

function hours(a){

  let hs=Array.from(
    {length:12},
    (_,i)=>i+8
  );

  let c=Object.fromEntries(
    hs.map(h=>[h,0])
  );

  a.forEach(r=>{

    let d=dt(r.FECHA_REGISTRO);

    if(
      d &&
      c[d.getHours()]!==undefined
    ){
      c[d.getHours()]++;
    }

  });

  let mx=Math.max(
    1,
    ...Object.values(c)
  );

  $("#bars").innerHTML=
    hs.map(h=>`
      <div class="col">
        <i>${c[h]||""}</i>

        <div
          class="bar"
          style="height:${Math.max(
            4,
            c[h]/mx*155
          )}px">
        </div>

        <small>${h}:00</small>
      </div>
    `).join("");

  let p=Object.entries(c)
    .sort((a,b)=>b[1]-a[1])[0];

  $("#peak").textContent=
    p&&p[1]
      ?`PICO · ${p[0]}:00 · ${p[1]}`
      :"ESPERANDO SEÑAL";
}


/* ==========================================================
   SIGNOS
   ========================================================== */

function zs(a){

  let c=counts(
    a,
    r=>z(r.FECHA_NACIMIENTO)[0]
  );

  let t=c[0]||["—",0];

  let g=(
    S.find(x=>x[0]==t[0]) ||
    ["","✦"]
  )[1];

  $("#glyph").textContent=g;
  $("#sign").textContent=t[0];

  $("#zlegend").innerHTML=
    c.slice(0,8)
    .map(x=>`
      <div class="lr">
        <span>${esc(x[0])}</span>
        <b>${x[1]}</b>
      </div>
    `)
    .join("") ||
    '<div class="empty">Esperando constelaciones…</div>';
}


/* ==========================================================
   RANKINGS
   ========================================================== */

function rank(it){

  let mx=Math.max(
    1,
    ...it.map(x=>x[1])
  );

  return it.slice(0,6)
    .map(x=>`
      <div class="rank">

        <span class="rn">
          ${esc(x[0])}
        </span>

        <div class="track">
          <div
            class="fill"
            style="width:${x[1]/mx*100}%">
          </div>
        </div>

        <b>${x[1]}</b>

      </div>
    `)
    .join("") ||
    '<div class="empty">Esperando datos…</div>';
}


/* ==========================================================
   EDAD
   ========================================================== */

function ageOf(v){

  let p=String(v||"").split("-");

  if(p.length<3)
    return null;

  let b=new Date(
    +p[0],
    +p[1]-1,
    +p[2]
  );

  let n=new Date();

  let x=
    n.getFullYear()-
    b.getFullYear();

  if(
    n<
    new Date(
      n.getFullYear(),
      b.getMonth(),
      b.getDate()
    )
  ){
    x--;
  }

  return x>=0&&x<120
    ?x
    :null;
}


/* ==========================================================
   INTELLIGENCE
   ========================================================== */

function intelligence(a){

  let ages=
    a.map(
      r=>ageOf(r.FECHA_NACIMIENTO)
    )
    .filter(x=>x!==null);


  if(ages.length){

    let avg=Math.round(
      ages.reduce((x,y)=>x+y,0) /
      ages.length
    );

    let s=[...ages]
      .sort((x,y)=>x-y);

    $("#avgAge").textContent=
      avg+" años";

    $("#ageRange").textContent=
      Math.min(...ages)+
      "–"+
      Math.max(...ages)+
      " años en la muestra";

    $("#ageMedian").textContent=
      "MEDIANA "+
      s[Math.floor(s.length/2)];
  }


  let gs=[
    ["<18",x=>x<18],
    ["18–24",x=>x>=18&&x<=24],
    ["25–34",x=>x>=25&&x<=34],
    ["35–44",x=>x>=35&&x<=44],
    ["45–54",x=>x>=45&&x<=54],
    ["55+",x=>x>=55]
  ];

  let v=gs.map(
    g=>[
      g[0],
      ages.filter(g[1]).length
    ]
  );

  let mx=Math.max(
    1,
    ...v.map(x=>x[1])
  );

  $("#ageBars").innerHTML=
    v.map(x=>`
      <div class="age-col">

        <i>${x[1]||""}</i>

        <div
          class="age-bar"
          style="height:${Math.max(
            3,
            x[1]/mx*135
          )}px">
        </div>

        <small>${x[0]}</small>

      </div>
    `).join("");


  let ds=
    a.map(r=>dt(r.FECHA_REGISTRO))
     .filter(Boolean)
     .sort((x,y)=>x-y);

  let rate=0;

  if(ds.length>1){

    rate=
      ds.length /
      Math.max(
        (ds.at(-1)-ds[0])/36e5,
        1/6
      );
  }

  $("#captureRate").textContent=
    rate
      ?rate.toFixed(rate<10?1:0)+"/h"
      :"—";


  let em={
    Aries:"Fuego",
    Leo:"Fuego",
    Sagitario:"Fuego",

    Tauro:"Tierra",
    Virgo:"Tierra",
    Capricornio:"Tierra",

    Géminis:"Aire",
    Libra:"Aire",
    Acuario:"Aire",

    Cáncer:"Agua",
    Escorpio:"Agua",
    Piscis:"Agua"
  };

  let ec={
    Fuego:0,
    Tierra:0,
    Aire:0,
    Agua:0
  };

  a.forEach(r=>{

    let e=
      em[
        z(r.FECHA_NACIMIENTO)[0]
      ];

    if(e)
      ec[e]++;
  });


  let es=
    Object.entries(ec)
    .sort((x,y)=>y[1]-x[1]);

  let valid=
    Object.values(ec)
    .reduce((x,y)=>x+y,0);


  $("#elementTop").textContent=
    es[0][1]
      ?es[0][0]
      :"—";

  $("#elementPct").textContent=
    valid
      ?Math.round(
        es[0][1]/valid*100
      )+"% de perfiles válidos"
      :"perfil zodiacal";


  let emx=Math.max(
    1,
    ...Object.values(ec)
  );

  $("#elements").innerHTML=
    es.map(x=>`
      <div class="element">

        <div class="element-top">
          <span>${x[0]}</span>
          <b>${x[1]}</b>
        </div>

        <div class="element-track">
          <div
            class="element-fill"
            style="width:${x[1]/emx*100}%">
          </div>
        </div>

      </div>
    `).join("");


  let pc=counts(
    a,
    r=>r.LUGAR_NACIMIENTO||"Sin dato"
  );

  let tp=pc[0]||["—",0];

  $("#topPlace").textContent=
    tp[0];

  $("#topPlacePct").textContent=
    a.length&&tp[1]
      ?Math.round(
        tp[1]/a.length*100
      )+"% de los registros"
      :"ciudad más frecuente";

  curve(ds);
}


/* ==========================================================
   CURVA ACUMULADA
   ========================================================== */

function curve(ds){

  if(!ds.length)
    return;

  let b={};

  let last=ds.at(-1);

  ds.forEach(d=>{

    let k=new Date(d);

    k.setMinutes(
      Math.floor(
        k.getMinutes()/30
      )*30,
      0,
      0
    );

    b[+k]=(b[+k]||0)+1;
  });


  let st=new Date(ds[0]);

  st.setMinutes(
    Math.floor(
      st.getMinutes()/30
    )*30,
    0,
    0
  );


  let en=new Date(last);

  en.setMinutes(
    Math.floor(
      en.getMinutes()/30
    )*30,
    0,
    0
  );


  if(+en==+st)
    en=new Date(+st+18e5);


  let p=[];
  let c=0;

  for(
    let t=+st;
    t<=+en;
    t+=18e5
  ){

    c+=b[t]||0;

    p.push([t,c]);
  }


  let W=720,
      H=180;

  let co=p.map(
    (x,i)=>[
      i/(p.length-1)*W,
      H-x[1]/Math.max(1,c)*(H-20)
    ]
  );


  let d=co.map(
    (x,i)=>
      (i?"L":"M")+
      x[0]+" "+
      x[1]
  ).join(" ");


  $("#linePath")
    .setAttribute("d",d);

  $("#areaPath")
    .setAttribute(
      "d",
      d+
      ` L ${W} ${H} L 0 ${H} Z`
    );


  let f=t=>
    new Date(t)
      .toLocaleTimeString(
        "es-MX",
        {
          hour:"2-digit",
          minute:"2-digit"
        }
      );


  $("#chartLabels").innerHTML=
    [
      p[0],
      p[Math.floor((p.length-1)/2)],
      p.at(-1)
    ]
    .map(
      x=>`<span>${f(x[0])}</span>`
    )
    .join("");


  $("#velocity").textContent=
    ds.filter(
      d=>last-d<=36e5
    ).length+
    " ÚLTIMA HORA";
}


/* ==========================================================
   FORMATO FECHA DE NACIMIENTO
   NUEVO
   1985-10-02 -> 02/10/1985
   ========================================================== */

function formatBirthDate(v){

  if(!v)
    return "—";

  const p=String(v).split("-");

  if(p.length===3){

    return `${p[2]}/${p[1]}/${p[0]}`;
  }

  return esc(v);
}


/* ==========================================================
   TABLA DE ASISTENTES
   AHORA INCLUYE FECHA_NACIMIENTO
   ========================================================== */

function recent(a){

  let all=[...a].sort(
    (x,y)=>
      (dt(y.FECHA_REGISTRO)||0)-
      (dt(x.FECHA_REGISTRO)||0)
  );

  let q=
    searchTerm
      .trim()
      .toLowerCase();


  /*
   * FECHA_NACIMIENTO también entra
   * en el buscador.
   */

  if(q){

    all=all.filter(
      r=>[
        r.NOMBRE,
        r.ID,
        r.WHATSAPP,
        r.FECHA_NACIMIENTO,
        formatBirthDate(r.FECHA_NACIMIENTO),
        r.LUGAR_NACIMIENTO,
        r.ORIGEN_QR,
        r.ESTATUS
      ]
      .some(
        v=>
          String(v||"")
          .toLowerCase()
          .includes(q)
      )
    );
  }


  let pages=Math.max(
    1,
    Math.ceil(
      all.length/PAGE_SIZE
    )
  );


  currentPage=Math.max(
    1,
    Math.min(
      currentPage,
      pages
    )
  );


  let page=all.slice(
    (currentPage-1)*PAGE_SIZE,
    currentPage*PAGE_SIZE
  );


  $("#shownCount").textContent=
    all.length;


  $("#rows").innerHTML=
    page.map(r=>{

      let s=z(
        r.FECHA_NACIMIENTO
      );

      return `
        <tr>

          <td>
            <strong>
              ${esc(r.NOMBRE)}
            </strong>

            <small>
              ${esc(r.ID)}
            </small>
          </td>


          <td>
            <strong>
              +52 ${esc(r.WHATSAPP)}
            </strong>
          </td>


          <td>
            <strong>
              ${formatBirthDate(
                r.FECHA_NACIMIENTO
              )}
            </strong>

            <small>
              Fecha de nacimiento
            </small>
          </td>


          <td>
            ${s[1]}
            ${esc(s[0])}
            ·
            ${esc(
              r.LUGAR_NACIMIENTO
            )}
          </td>


          <td>
            <span class="badge">
              ${esc(
                r.ORIGEN_QR||
                "DIRECTO"
              )}
            </span>
          </td>


          <td>
            <span class="badge">
              ${esc(
                r.ESTATUS||
                "—"
              )}
            </span>
          </td>


          <td>
            ${esc(
              r.FECHA_REGISTRO
            )}
          </td>

        </tr>
      `;

    }).join("") ||

    `
      <tr>
        <td
          colspan="7"
          class="empty">

          ${
            q
            ?"No encontramos coincidencias."
            :"Esperando primeras conexiones…"
          }

        </td>
      </tr>
    `;


  $("#pageInfo").textContent=
    `Página ${currentPage} de ${pages} · `+
    `${all.length} registro${
      all.length===1?"":"s"
    }`;


  $("#prevPage").disabled=
    currentPage<=1;

  $("#nextPage").disabled=
    currentPage>=pages;


  pagesUI(pages);
}


/* ==========================================================
   PAGINACIÓN
   ========================================================== */

function pagesUI(p){

  let n=[];

  if(p<=5){

    for(let i=1;i<=p;i++)
      n.push(i);

  }else{

    n=[1];

    let a=Math.max(
      2,
      currentPage-1
    );

    let b=Math.min(
      p-1,
      currentPage+1
    );

    if(a>2)
      n.push("…");

    for(let i=a;i<=b;i++)
      n.push(i);

    if(b<p-1)
      n.push("…");

    n.push(p);
  }


  $("#pageNumbers").innerHTML=
    n.map(
      x=>
        x==="…"
        ?'<span class="page-dots">…</span>'
        :`
          <button
            class="${
              x===currentPage
              ?"active"
              :""
            }"
            data-page="${x}">
            ${x}
          </button>
        `
    ).join("");


  document
    .querySelectorAll(
      "#pageNumbers button"
    )
    .forEach(
      b=>
        b.onclick=()=>{

          currentPage=
            +b.dataset.page;

          render();
        }
    );
}


/* ==========================================================
   BUSCADOR
   ========================================================== */

$("#search")
  .addEventListener(
    "input",
    e=>{

      searchTerm=
        e.target.value;

      currentPage=1;

      render();
    }
  );


/* ==========================================================
   BOTONES PAGINACIÓN
   ========================================================== */

$("#prevPage").onclick=()=>{

  if(currentPage>1){

    currentPage--;

    render();
  }
};


$("#nextPage").onclick=()=>{

  currentPage++;

  render();
};


/* ==========================================================
   TABS
   ========================================================== */

document
  .querySelectorAll(".view-tab")
  .forEach(
    b=>
      b.onclick=()=>{

        document
          .querySelectorAll(
            ".view-tab"
          )
          .forEach(
            x=>
              x.classList.toggle(
                "active",
                x===b
              )
          );

        $("#intelView")
          .classList.toggle(
            "active",
            b.dataset.view==="intel"
          );

        $("#peopleView")
          .classList.toggle(
            "active",
            b.dataset.view==="people"
          );

        $("#territoryView")
          .classList.toggle(
            "active",
            b.dataset.view==="territory"
          );

        if(b.dataset.view==="territory")setTimeout(()=>{initTerritoryMap();if(territoryMap)territoryMap.resize();},80);
      }
  );


/* ==========================================================
   DESCARGA EXCEL / CSV
   FECHA_NACIMIENTO YA ESTABA INCLUIDA
   ========================================================== */

$("#downloadExcel").onclick=()=>{

  let a=
    $("#tests").checked
    ?raw
    :raw.filter(r=>!isTest(r));


  let h=[
    "ID",
    "FECHA_REGISTRO",
    "NOMBRE",
    "FECHA_NACIMIENTO",
    "LUGAR_NACIMIENTO",
    "HORA",
    "MINUTO",
    "PERIODO",
    "WHATSAPP",
    "ORIGEN_QR",
    "ESTATUS"
  ];


  let q=v=>
    '"'+
    String(v??"")
      .replace(/"/g,'""')+
    '"';


  let csv=
    "\ufeffsep=,\r\n"+
    h.join(",")+
    "\r\n"+
    a.map(
      r=>
        h.map(
          k=>q(r[k])
        ).join(",")
    ).join("\r\n");


  let u=
    URL.createObjectURL(
      new Blob(
        [csv],
        {
          type:
            "text/csv;charset=utf-8"
        }
      )
    );


  let l=
    document.createElement("a");

  l.href=u;

  l.download=
    "Expo_Esoterica_Asistentes_"+
    new Date()
      .toISOString()
      .slice(0,10)+
    ".csv";

  l.click();


  setTimeout(
    ()=>URL.revokeObjectURL(u),
    500
  );
};


/* ==========================================================
   REFRESH
   ========================================================== */

$("#refresh").onclick=()=>{

  let b=$("#refresh");

  b.style.transform=
    "rotate(180deg)";

  load();

  setTimeout(
    ()=>b.style.transform="",
    500
  );
};


$("#tests").onchange=render;


/* ==========================================================
   INICIO
   ========================================================== */

load();

setInterval(
  load,
  30000
);



/* ==========================================================
   TERRITORIAL INTELLIGENCE · MAPBOX
   ========================================================== */
function aggregateTerritory(a){
  let groups=new Map();
  a.forEach(r=>{let n=normalizeMunicipality(r.LUGAR_NACIMIENTO);if(!n)return;let key=n.key||cleanPlace(n.municipality+" "+n.state);if(!groups.has(key))groups.set(key,{...n,count:0,records:[]});let g=groups.get(key);g.count++;g.records.push(r)});
  return [...groups.values()].sort((x,y)=>y.count-x.count);
}
async function geocodeMunicipality(g){
  if(geoCache.has(g.key))return geoCache.get(g.key);
  let query=encodeURIComponent([g.municipality,g.state,"Mexico"].filter(Boolean).join(", "));
  try{
    let u=`https://api.mapbox.com/search/geocode/v6/forward?q=${query}&country=MX&types=place,district,locality&limit=1&access_token=${MAPBOX_TOKEN}`;
    let r=await fetch(u),d=await r.json(),f=d.features&&d.features[0];if(!f)return null;
    let coords=f.geometry.coordinates,props=f.properties||{},ctx=props.context||{};
    let state=g.state||ctx.region?.name||"";
    let out={...g,state,center:coords,geocode:f};geoCache.set(g.key,out);return out;
  }catch(e){return null}
}
function territory(a){
  territoryData=aggregateTerritory(a);
  let total=territoryData.reduce((n,x)=>n+x.count,0),states=new Set(territoryData.map(x=>x.state).filter(Boolean)),top=territoryData[0];
  if($("#territoryVisitors"))animateNumber($("#territoryVisitors"),total);
  if($("#territoryMunicipalities"))animateNumber($("#territoryMunicipalities"),territoryData.length);
  if($("#territoryStates"))animateNumber($("#territoryStates"),states.size);
  if($("#territoryTop"))$("#territoryTop").textContent=top?top.municipality:"—";
  if($("#territoryTopPct"))$("#territoryTopPct").textContent=top&&total?Math.round(top.count/total*100)+"% de visitantes":"esperando datos";
  renderTerritoryRanking(territoryData,total);
  if(territoryReady)refreshTerritoryMap();
}
function renderTerritoryRanking(data,total){
  let el=$("#territoryRanking");if(!el)return;
  el.innerHTML=data.slice(0,12).map((x,i)=>`<button class="territory-rank" data-key="${esc(x.key)}"><span class="num">${String(i+1).padStart(2,"0")}</span><span><strong>${esc(x.municipality)}</strong><small>${esc(x.state||"Estado por resolver")}</small></span><span class="value"><b>${x.count}</b><em>${total?Math.round(x.count/total*100):0}%</em></span></button>`).join("")||'<div class="empty">Esperando procedencias…</div>';
  el.querySelectorAll(".territory-rank").forEach(b=>b.onclick=()=>focusTerritory(b.dataset.key));
}
function initTerritoryMap(){
  if(territoryMap||!window.mapboxgl)return;
  mapboxgl.accessToken=MAPBOX_TOKEN;
  const mapContainer=document.getElementById("territoryMap");
  if(!mapContainer)return;
  mapContainer.innerHTML="";
  territoryMap=new mapboxgl.Map({container:mapContainer,style:"mapbox://styles/mapbox/light-v11",center:[-100.3161,25.6866],zoom:6.4,pitch:48,bearing:-8,antialias:true,attributionControl:true});
  territoryMap.addControl(new mapboxgl.NavigationControl({visualizePitch:true}),"top-right");
  territoryMap.on("load",()=>{territoryReady=true;refreshTerritoryMap();$("#territoryLoading")?.classList.add("hidden")});
  $("#territoryReset").onclick=()=>fitTerritory();
  $("#territoryPitch").onclick=()=>{territory3D=!territory3D;territoryMap.easeTo({pitch:territory3D?48:0,bearing:territory3D?-8:0,duration:900});$("#territoryPitch").textContent=territory3D?"◇ 3D":"◇ 2D"};
}
async function refreshTerritoryMap(){
  if(!territoryReady||!territoryData.length)return;
  let resolved=(await Promise.all(territoryData.slice(0,80).map(geocodeMunicipality))).filter(Boolean); if(!resolved.length)return;
  territoryMarkers.forEach(m=>m.remove());territoryMarkers=[];
  let max=Math.max(...resolved.map(x=>x.count),1);
  let fc={type:"FeatureCollection",features:resolved.map(x=>({type:"Feature",properties:{key:x.key,name:x.municipality,state:x.state||"",count:x.count,pct:x.count/territoryData.reduce((n,y)=>n+y.count,0),height:Math.max(700,Math.sqrt(x.count/max)*9500)},geometry:{type:"Point",coordinates:x.center}}))};
  if(territoryMap.getSource("territory-points"))territoryMap.getSource("territory-points").setData(fc);else{
    territoryMap.addSource("territory-points",{type:"geojson",data:fc});
    territoryMap.addLayer({id:"territory-glow",type:"circle",source:"territory-points",paint:{"circle-radius":["interpolate",["linear"],["get","count"],1,15,max,48],"circle-color":["interpolate",["linear"],["get","count"],1,"#40508c",Math.max(2,max*.35),"#6d72d8",max,"#7ee7ff"],"circle-opacity":.16,"circle-blur":.55}});
    territoryMap.addLayer({id:"territory-core",type:"circle",source:"territory-points",paint:{"circle-radius":["interpolate",["linear"],["get","count"],1,5,max,16],"circle-color":["interpolate",["linear"],["get","count"],1,"#596bcb",Math.max(2,max*.35),"#8177ff",max,"#8ce9ff"],"circle-stroke-width":1.5,"circle-stroke-color":"#d7d3ff","circle-opacity":.9}});
    territoryMap.on("click","territory-core",e=>showTerritoryPopup(e.features[0]));territoryMap.on("mouseenter","territory-core",()=>territoryMap.getCanvas().style.cursor="pointer");territoryMap.on("mouseleave","territory-core",()=>territoryMap.getCanvas().style.cursor="");
  }
  resolved.slice(0,8).forEach(x=>{let el=document.createElement("div");el.className="municipality-marker";el.innerHTML=`<span>${x.count}</span>`;let m=new mapboxgl.Marker({element:el,anchor:"bottom"}).setLngLat(x.center).addTo(territoryMap);territoryMarkers.push(m)});
  fitTerritory(resolved);
}
function fitTerritory(resolved){
  if(!territoryMap)return;let arr=resolved||territoryData.map(x=>geoCache.get(x.key)).filter(Boolean);if(!arr.length){territoryMap.flyTo({center:[-100.3161,25.6866],zoom:6.4,pitch:48});return}let b=new mapboxgl.LngLatBounds();arr.forEach(x=>b.extend(x.center));territoryMap.fitBounds(b,{padding:{top:70,bottom:70,left:70,right:70},maxZoom:9.2,pitch:territory3D?48:0,bearing:territory3D?-8:0,duration:1200})
}
function focusTerritory(key){
  let x=geoCache.get(key);if(!x){let g=territoryData.find(y=>y.key===key);if(g)geocodeMunicipality(g).then(v=>{if(v)focusTerritory(key)});return}territoryMap?.flyTo({center:x.center,zoom:10.4,pitch:territory3D?55:0,bearing:territory3D?-12:0,duration:1300});document.querySelectorAll(".territory-rank").forEach(b=>b.classList.toggle("active",b.dataset.key===key));showTerritoryInfo(x)
}
function showTerritoryPopup(f){let key=f.properties.key,x=geoCache.get(key);if(x)showTerritoryInfo(x)}
function showTerritoryInfo(x){
  if(!territoryMap||!x)return;let ages=x.records.map(r=>ageOf(r.FECHA_NACIMIENTO)).filter(v=>v!==null),avg=ages.length?Math.round(ages.reduce((a,b)=>a+b,0)/ages.length):"—",sign=counts(x.records,r=>z(r.FECHA_NACIMIENTO)[0])[0]?.[0]||"—",channel=counts(x.records,r=>r.ORIGEN_QR||"DIRECTO")[0]?.[0]||"—",total=territoryData.reduce((n,y)=>n+y.count,0);
  new mapboxgl.Popup({className:"territory-popup",offset:22,closeButton:false}).setLngLat(x.center).setHTML(`<div class="territory-pop"><div class="pop-over">MUNICIPIO · AUDIENCIA</div><h4>${esc(x.municipality)}</h4><div class="territory-pop-grid"><div><small>VISITANTES</small><b>${x.count} · ${Math.round(x.count/total*100)}%</b></div><div><small>ESTADO</small><b>${esc(x.state||"—")}</b></div><div><small>EDAD PROMEDIO</small><b>${avg}${avg!=="—"?" años":""}</b></div><div><small>PERFIL / CANAL</small><b>${esc(sign)} · ${esc(channel)}</b></div></div></div>`).addTo(territoryMap)
}

/* ==========================================================
   COSMOS
   ========================================================== */

const cv=$("#cosmos"),
      cx=cv.getContext("2d");

let stars=[],
    shoot=null;


function resize(){

  let d=Math.min(
    devicePixelRatio,
    2
  );

  cv.width=
    innerWidth*d;

  cv.height=
    innerHeight*d;

  cx.setTransform(
    d,0,0,d,0,0
  );


  stars=Array.from(
    {
      length:
        Math.min(
          220,
          Math.floor(
            innerWidth/5
          )
        )
    },
    ()=>({
      x:Math.random()*innerWidth,
      y:Math.random()*innerHeight,
      r:Math.random()*1.25+.15,
      a:Math.random()*.58+.1,
      s:Math.random()*.012+.003
    })
  );
}


function draw(t){

  cx.clearRect(
    0,
    0,
    innerWidth,
    innerHeight
  );


  stars.forEach(s=>{

    s.a+=
      Math.sin(
        t*s.s
      )*.001;


    cx.globalAlpha=
      Math.max(
        .08,
        Math.min(
          .72,
          s.a
        )
      );


    cx.fillStyle=
      "#dfe2ff";


    cx.beginPath();

    cx.arc(
      s.x,
      s.y,
      s.r,
      0,
      7
    );

    cx.fill();
  });


  if(
    !shoot &&
    Math.random()<.002
  ){

    shoot={
      x:Math.random()*
        innerWidth*.65,

      y:Math.random()*
        innerHeight*.35,

      l:0
    };
  }


  if(shoot){

    shoot.l+=12;


    cx.globalAlpha=
      Math.max(
        0,
        1-shoot.l/220
      );


    let g=
      cx.createLinearGradient(
        shoot.x,
        shoot.y,
        shoot.x+shoot.l,
        shoot.y+shoot.l*.35
      );


    g.addColorStop(
      0,
      "transparent"
    );

    g.addColorStop(
      1,
      "#cfd6ff"
    );


    cx.strokeStyle=g;

    cx.lineWidth=1;


    cx.beginPath();

    cx.moveTo(
      shoot.x,
      shoot.y
    );

    cx.lineTo(
      shoot.x+shoot.l,
      shoot.y+shoot.l*.35
    );

    cx.stroke();


    if(shoot.l>220)
      shoot=null;
  }


  cx.globalAlpha=1;

  requestAnimationFrame(draw);
}


addEventListener(
  "resize",
  resize
);

resize();

requestAnimationFrame(draw);
