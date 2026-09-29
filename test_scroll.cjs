const { chromium } = require('playwright');

(async () => {
  console.log('Starting browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Navigating to deployed site...');
  await page.goto('https://giyeun-lift.vercel.app/');
  
  console.log('Logging in...');
  // assuming login form: input type="text" for ID, type="password" for PW
  await page.fill('input[type="text"]', 'u-1'); // admin user
  await page.fill('input[type="password"]', 'admin123'); // fallback password
  await page.click('button[type="submit"], button:has-text("로그인")');
  
  await page.waitForTimeout(2000);
  
  // Go to Contracts (계약 관리) which is known to have a huge horizontal grid
  console.log('Navigating to Contracts...');
  await page.click('text="계약 관리"');
  await page.waitForTimeout(2000);
  
  console.log('Finding grid container...');
  // The table container should have overflowX: auto
  const tableContainer = await page.evaluateHandle(() => {
     const table = document.querySelector('table');
     let wrapper = table.parentElement;
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

  // 1. Test vertical scroll outside the grid (e.g., top header)
  console.log('\n--- Test 1: Scroll OUTSIDE the grid (without Shift) ---');
  await page.mouse.move(boundingBox.x + 10, boundingBox.y - 50); // Move above the grid
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(500);
  
  let gridScroll = await page.evaluate((el) => ({ x: el.scrollLeft, y: el.scrollTop }), tableContainer);
  console.log('Grid scroll after outside scroll:', gridScroll);
  if (gridScroll.x === 0 && gridScroll.y === 0) {
      console.log('PASS: Grid did not scroll when scrolling outside.');
  } else {
      console.log('FAIL: Grid scrolled unexpectedly when scrolling outside.');
  }

  // 2. Test horizontal scroll inside the grid (with Shift)
  console.log('\n--- Test 2: Scroll INSIDE the grid (WITH Shift) ---');
  await page.mouse.move(boundingBox.x + 100, boundingBox.y + 100); // Move inside the grid
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
  
  // 3. Test vertical scroll inside the grid (without Shift)
  // Wait, does the grid have vertical scrollable content? We can just simulate wheel down and see if it goes down.
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
      console.log('INFO: Grid does not have vertical scroll content. (scrollHeight <= clientHeight). Normal wheel should not affect horizontal scroll because we removed that logic.');
      if (gridScroll.x === 0 || gridScroll.x === 500) { // Should remain what it was
          console.log('PASS: Horizontal scroll was not hijacked.');
      }
  }

  await browser.close();
})();
