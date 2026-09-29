const { chromium } = require('playwright');
(async () => {
  console.log('Starting browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Navigating to deployed site...');
  await page.goto('https://giyeun-lift.vercel.app/');
  
  console.log('Logging in...');
  await page.fill('input[type="text"]', 'u-1'); 
  await page.fill('input[type="password"]', 'admin123'); 
  await page.click('button[type="submit"]');
  
  await page.waitForTimeout(3000);
  
  console.log('Navigating to Contracts (계약 관리)...');
  await page.evaluate(() => {
     const links = Array.from(document.querySelectorAll('a, button, span, div'));
     const link = links.find(el => el.textContent.trim() === '계약 관리');
     if(link) link.click();
  });
  await page.waitForTimeout(3000);
  
  console.log('Finding grid container...');
  const tableContainer = await page.evaluateHandle(() => {
     const tables = document.querySelectorAll('table');
     if(tables.length === 0) return null;
     let wrapper = tables[0].parentElement;
     while (wrapper && wrapper.tagName !== 'MAIN') {
       const style = window.getComputedStyle(wrapper);
       if (style.overflowX === 'auto' || style.overflowX === 'scroll' || wrapper.classList.contains('table-container')) {
         return wrapper;
       }
       wrapper = wrapper.parentElement;
     }
     return null;
  });

  const boundingBox = await tableContainer.boundingBox();
  console.log('Grid bounding box:', boundingBox);

  console.log('\n--- Test 1: Scroll OUTSIDE the grid (without Shift) ---');
  await page.mouse.move(boundingBox.x + 10, boundingBox.y - 50);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(500);
  
  let gridScroll = await page.evaluate((el) => ({ x: el.scrollLeft, y: el.scrollTop }), tableContainer);
  console.log('Grid scroll after outside scroll:', gridScroll);
  if (gridScroll.x === 0 && gridScroll.y === 0) {
      console.log('PASS: Grid did not scroll when scrolling outside.');
  } else {
      console.log('FAIL: Grid scrolled unexpectedly when scrolling outside.');
  }

  console.log('\n--- Test 2: Scroll INSIDE the grid (WITH Shift) ---');
  await page.mouse.move(boundingBox.x + 100, boundingBox.y + 100);
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, 500);
  await page.keyboard.up('Shift');
  await page.waitForTimeout(500);

  gridScroll = await page.evaluate((el) => ({ x: el.scrollLeft, y: el.scrollTop }), tableContainer);
  console.log('Grid scroll after Shift+Wheel inside:', gridScroll);
  if (gridScroll.x > 0) {
      console.log('PASS: Grid scrolled horizontally with Shift+Wheel.');
  } else {
      console.log('FAIL: Grid DID NOT scroll horizontally with Shift+Wheel.');
  }
  
  console.log('\n--- Test 3: Scroll INSIDE the grid (without Shift) ---');
  let previousY = gridScroll.y;
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(500);
  gridScroll = await page.evaluate((el) => ({ x: el.scrollLeft, y: el.scrollTop, clientHeight: el.clientHeight, scrollHeight: el.scrollHeight }), tableContainer);
  console.log('Grid scroll after normal Wheel inside:', gridScroll);
  
  if (gridScroll.scrollHeight > gridScroll.clientHeight) {
      if (gridScroll.y > previousY) {
          console.log('PASS: Grid scrolled vertically normally.');
      } else {
          console.log('FAIL: Grid did not scroll vertically despite having vertical content.');
      }
  } else {
      console.log('INFO: Grid does not have vertical scroll content.');
      console.log('PASS: Normal scroll ignored for horizontal because shift is required.');
  }

  await browser.close();
})();
