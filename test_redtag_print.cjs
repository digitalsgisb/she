/* Render the compact print fixture and verify its physical card dimensions. */
const fs=require('fs'),assert=require('assert'),cp=require('child_process'),pathTools=require('path');
const {chromium}=require(process.env.SHE_QA_PLAYWRIGHT||'playwright');
const fixturePath=process.env.SHE_QA_PRINT_HTML;
const fixture=fixturePath?fs.readFileSync(fixturePath):cp.execFileSync(process.env.SHE_QA_PYTHON||'python',['-c',
 "import redtag; rows=[dict(id=i,red_tag_id=f'RT2610-{i:03d}',finding_date='2026-10-20',section='FG Store',machine='Packing line',pic='Fareez',type_of_stop='STOP 1',rank='A',status='Open',issued_by='SHE',hazard='Guard damaged',recommendation='Replace guard') for i in range(17,27)]; print(redtag.print_html(rows,'2026-10-20'))"],{env:{...process.env,PYTHONIOENCODING:'utf-8'}});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SHE_QA_BROWSER});
 try{
  const page=await browser.newPage({viewport:{width:733,height:1100}});
  await page.route('**/*',route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/')return route.fulfill({contentType:'text/html; charset=utf-8',body:fixture});
   if(path==='/redtag.css')return route.fulfill({contentType:'text/css',body:fs.readFileSync('redtag.css')});
   const photo=path.match(/^\/api\/red-tags\/(\d+)\/photo$/);
   if(photo)return route.fulfill({contentType:'image/png',body:fixturePath?fs.readFileSync(pathTools.join(pathTools.dirname(fixturePath),photo[1]+'.png')):Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
   return route.fulfill({status:404,body:''});
  });
  await page.goto('https://she.test/');await page.emulateMedia({media:'print'});
  await page.evaluate(()=>Promise.all([...document.images].map(image=>image.decode())));
  assert.equal(await page.locator('.genba-card').count(),10);
  assert.deepEqual(await page.locator('.genba-print-sheet').evaluateAll(sheets=>sheets.map(sheet=>sheet.children.length)),[6,4]);
  const dimensions=await page.locator('.genba-card').evaluateAll(cards=>cards.map(card=>{const r=card.getBoundingClientRect();return {width:r.width*25.4/96,height:r.height*25.4/96};}));
  assert(dimensions.every(r=>Math.abs(r.width-94)<.5&&Math.abs(r.height-85)<.5),JSON.stringify(dimensions));
  assert.equal(await page.locator('.genba-qr svg').count(),10);
  assert.equal(await page.locator('.genba-print-toolbar').isVisible(),false);
  fs.mkdirSync('output/pdf',{recursive:true});
  await page.pdf({path:'output/pdf/red-tag-size-preview.pdf',preferCSSPageSize:true,printBackground:true});
  const pages=JSON.parse(cp.execFileSync(process.env.SHE_QA_PYTHON||'python',['-c',"import json; from pypdf import PdfReader; r=PdfReader('output/pdf/red-tag-size-preview.pdf'); print(json.dumps([dict(cards=p.extract_text().count('RED TAG ATTACHMENT'),width=float(p.mediabox.width),height=float(p.mediabox.height)) for p in r.pages]))"],{encoding:'utf8'}));
  assert.deepEqual(pages.map(p=>p.cards),[6,4]);
  assert(pages.every(p=>Math.abs(p.width-595.28)<1&&Math.abs(p.height-841.89)<1));
  console.log('10 tags: 94 x 85 mm, 2 columns, 6 + 4 per sheet, QR codes present.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
