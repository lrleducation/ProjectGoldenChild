const toggle=document.querySelector('.menu-toggle');
const nav=document.querySelector('.navlinks');
if(toggle&&nav){toggle.setAttribute('aria-expanded','false');toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));});}
document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{const root=btn.closest('[data-tabs-root]');if(!root)return;root.querySelectorAll('[data-tab]').forEach(x=>x.classList.remove('active'));root.querySelectorAll('[data-tab-panel]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');root.querySelector(`[data-tab-panel="${btn.dataset.tab}"]`)?.classList.add('active');}));
document.querySelectorAll('[data-year]').forEach(el=>el.textContent=String(new Date().getFullYear()));
