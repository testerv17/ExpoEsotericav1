const $=(s,root=document)=>root.querySelector(s), $$=(s,root=document)=>[...root.querySelectorAll(s)];
const welcome=$('#welcome'),formScreen=$('#formScreen'),successScreen=$('#successScreen');
const form=$('#astroForm'),steps=$$('.form-step'),progress=$('#progressBar'),stepLabel=$('#currentStep');
let currentStep=1;
function showScreen(el){$$('.screen').forEach(x=>x.classList.remove('active'));el.classList.add('active');window.scrollTo({top:0,behavior:'smooth'});}
function renderStep(){steps.forEach(s=>s.classList.toggle('active',Number(s.dataset.step)===currentStep));stepLabel.textContent=String(currentStep).padStart(2,'0');progress.style.width=`${((currentStep-1)/(steps.length-1))*100}%`;$$('.journey i').forEach((n,i)=>{n.style.background=i<currentStep?'#c8cbff':'#292d54';n.style.boxShadow=i<currentStep?'0 0 12px #7e87ff,0 0 0 5px #08091b':'0 0 0 5px #08091b';});}
function validateStep(){const active=$(`.form-step[data-step="${currentStep}"]`);for(const input of $$('input',active)){if(input.type!=='radio'&&!input.checkValidity()){input.reportValidity();return false;}}return true;}
$('#startButton').addEventListener('click',()=>{document.body.classList.add('launching');setTimeout(()=>{showScreen(formScreen);setTimeout(()=>$('#nombre').focus(),350)},320)});
$$('.next-button').forEach(b=>b.addEventListener('click',()=>{if(!validateStep())return;if(currentStep<steps.length){currentStep++;renderStep();}}));
$('#backButton').addEventListener('click',()=>{if(currentStep>1){currentStep--;renderStep()}else showScreen(welcome)});
$('#whatsapp').addEventListener('input',e=>e.target.value=e.target.value.replace(/\D/g,''));

const signs=[['CAPRICORNIO','♑',1,19],['ACUARIO','♒',2,18],['PISCIS','♓',3,20],['ARIES','♈',4,19],['TAURO','♉',5,20],['GÉMINIS','♊',6,20],['CÁNCER','♋',7,22],['LEO','♌',8,22],['VIRGO','♍',9,22],['LIBRA','♎',10,22],['ESCORPIO','♏',11,21],['SAGITARIO','♐',12,21],['CAPRICORNIO','♑',12,31]];
function zodiac(date){const d=new Date(date+'T12:00:00'),m=d.getMonth()+1,day=d.getDate();const bounds=[20,19,21,20,21,21,23,23,23,23,22,22];const names=[['CAPRICORNIO','♑'],['ACUARIO','♒'],['PISCIS','♓'],['ARIES','♈'],['TAURO','♉'],['GÉMINIS','♊'],['CÁNCER','♋'],['LEO','♌'],['VIRGO','♍'],['LIBRA','♎'],['ESCORPIO','♏'],['SAGITARIO','♐']];return day<bounds[m-1]?names[m-1]:names[m%12];}
$('#fechaNacimiento').max=new Date().toISOString().split('T')[0];
$('#fechaNacimiento').addEventListener('change',e=>{if(!e.target.value)return;const [name,glyph]=zodiac(e.target.value);$('#zodiacName').textContent=`${glyph} ${name}`;$('#zodiacGlyph').textContent=glyph;$('#zodiacResult').classList.add('show');$('#zodiacText').textContent='Tu primera coordenada astral ha sido encontrada.';});
const API_URL='https://script.google.com/macros/s/AKfycbyM3mhup2rSWXeodZJMfFETAegn5VMcznZi6YRlIsiB2meQhSI5l-BByaUaH3dhzEZFng/exec';
let submitting=false;
form.addEventListener('submit',async e=>{
  e.preventDefault();
  if(submitting)return;
  if(!form.checkValidity()){form.reportValidity();return;}

  const submitButton=$('.cta.final',form);
  const submitText=$('span',submitButton);
  const originalText=submitText.textContent;
  const fd=new FormData(form);
  const data=Object.fromEntries(fd.entries());
  const params=new URLSearchParams(location.search);
  data.origen=(params.get('src')||'DIRECTO').trim().slice(0,80);
  const z=zodiac(data.fechaNacimiento);

  submitting=true;
  submitButton.disabled=true;
  submitText.textContent='Registrando coordenadas…';

  try{
    const response=await fetch(API_URL,{
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify(data),
      redirect:'follow'
    });
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const result=await response.json();
    if(!result.ok||!result.id)throw new Error(result.error||'No se recibió confirmación del servidor.');

    $('#registrationId').textContent=result.id;
    $('#successZodiac').textContent=`${z[1]} ${z[0]} · CARTA ASTRAL`;
    showScreen(successScreen);
    form.reset();
  }catch(err){
    console.error('QrEvento API:',err);
    alert('No pudimos registrar tus datos. Revisa tu conexión e inténtalo nuevamente.');
  }finally{
    submitting=false;
    submitButton.disabled=false;
    submitText.textContent=originalText;
  }
});

// COSMIC CANVAS — depth, drift, glow and occasional shooting stars
const canvas=$('#cosmos'),ctx=canvas.getContext('2d');let W,H,DPR,stars=[],mx=0,my=0,shoot=null;
function resize(){DPR=Math.min(devicePixelRatio||1,2);W=innerWidth;H=innerHeight;canvas.width=W*DPR;canvas.height=H*DPR;canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.setTransform(DPR,0,0,DPR,0,0);stars=Array.from({length:Math.min(230,Math.floor(W*H/3600))},()=>({x:Math.random()*W,y:Math.random()*H,z:.2+Math.random()*.8,r:.25+Math.random()*1.35,a:.15+Math.random()*.7,p:Math.random()*6.28,s:.006+Math.random()*.012}));}
addEventListener('pointermove',e=>{mx=(e.clientX/W-.5);my=(e.clientY/H-.5)});addEventListener('resize',resize);
function shootingStar(){if(!shoot&&Math.random()<.0015)shoot={x:W*(.25+Math.random()*.65),y:H*(.05+Math.random()*.25),vx:-7-Math.random()*5,vy:5+Math.random()*3,life:1};if(shoot){const g=ctx.createLinearGradient(shoot.x,shoot.y,shoot.x-shoot.vx*12,shoot.y-shoot.vy*12);g.addColorStop(0,`rgba(235,239,255,${shoot.life})`);g.addColorStop(1,'rgba(130,143,255,0)');ctx.strokeStyle=g;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(shoot.x,shoot.y);ctx.lineTo(shoot.x-shoot.vx*12,shoot.y-shoot.vy*12);ctx.stroke();shoot.x+=shoot.vx;shoot.y+=shoot.vy;shoot.life-=.018;if(shoot.life<=0)shoot=null;}}
function animate(){ctx.clearRect(0,0,W,H);for(const s of stars){s.p+=s.s;const a=s.a*(.7+Math.sin(s.p)*.3),x=s.x+mx*s.z*13,y=s.y+my*s.z*10;if(s.r>1){ctx.shadowBlur=8*s.z;ctx.shadowColor='rgba(128,139,255,.65)'}else ctx.shadowBlur=0;ctx.fillStyle=`rgba(${205+Math.floor(40*s.z)},${210+Math.floor(35*s.z)},255,${a})`;ctx.beginPath();ctx.arc(x,y,s.r,0,Math.PI*2);ctx.fill()}ctx.shadowBlur=0;shootingStar();requestAnimationFrame(animate)}resize();renderStep();requestAnimationFrame(animate);
