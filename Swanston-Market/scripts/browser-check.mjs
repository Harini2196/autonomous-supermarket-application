// Optional development smoke test: npm install --no-save playwright, then npx playwright install chromium.
import {mkdirSync} from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:3000');
await page.getByRole('heading',{name:'A clear view of the business.'}).waitFor();
await page.getByText('PASS · assurance').waitFor();
mkdirSync('tmp',{recursive:true});
await page.screenshot({path:'tmp/overview.png',fullPage:true});
for(const title of ['Inventory & brain','Commercial findings','Assurance','Daily audit','Model & setup']){
 await page.getByRole('button',{name:new RegExp(title.replace('&','&'))}).first().click();
 await page.getByRole('heading',{name:title,exact:true}).waitFor();
 if(title==='Daily audit'){await page.locator('details').first().waitFor();await page.locator('details').first().click();}
 if(title==='Commercial findings')await page.screenshot({path:'tmp/findings.png',fullPage:true});
}
await page.setViewportSize({width:390,height:844});
await page.getByRole('button',{name:/Overview/}).click();
await page.screenshot({path:'tmp/mobile.png',fullPage:true});
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
await browser.close();
if(errors.length||overflow)throw Error(JSON.stringify({errors,overflow}));
console.log('All six views rendered; daily records expanded; no browser errors or mobile page overflow.');
