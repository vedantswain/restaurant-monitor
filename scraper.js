const puppeteer = require('puppeteer');

const PREFERRED_DAYS = ['Thursday', 'Friday', 'Saturday'];

async function checkResyAvailability(restaurantId, restaurantName, cancellationHours = 72) {
  let browser;
  try {
    console.log(`[${new Date().toISOString()}] Launching Puppeteer for ${restaurantName}`);
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const url = `https://resy.com/cities/new-york-ny/venues/${restaurantId}`;
    console.log(`[${new Date().toISOString()}] Loading ${url}`);

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log(`[${new Date().toISOString()}] Page loaded, looking for availability data`);

    // Wait for availability data to load
    await page.waitForSelector('[data-date]', { timeout: 5000 }).catch(() => null);

    // Extract available dates from the page
    const availableDates = await page.evaluate(() => {
      const dates = [];
      const dateElements = document.querySelectorAll('[data-date]');

      dateElements.forEach(el => {
        const dateStr = el.getAttribute('data-date');
        const dayName = el.getAttribute('aria-label') || el.textContent;

        if (dateStr && !el.classList.contains('disabled')) {
          dates.push({
            date: dateStr,
            day: dayName,
            available: !el.classList.contains('disabled')
          });
        }
      });

      return dates;
    });

    // Filter for Thu/Fri/Sat and minimum days out
    const minDate = new Date();
    minDate.setHours(0, 0, 0, 0);
    minDate.setDate(minDate.getDate() + Math.ceil(cancellationHours / 24));

    console.log(`[${new Date().toISOString()}] Found ${availableDates.length} total dates`);

    const filtered = availableDates.filter(d => {
      const dateObj = new Date(d.date);
      const dayName = new Date(d.date).toLocaleDateString('en-US', { weekday: 'long' });
      return PREFERRED_DAYS.includes(dayName) && dateObj >= minDate && d.available;
    });

    console.log(`[${new Date().toISOString()}] Filtered to ${filtered.length} qualifying dates (Thu/Fri/Sat, 72+ hrs)`);

    if (filtered.length > 0) {
      console.log(`✓ ${restaurantName}: Available on ${filtered[0].date}`);
      return { available: true, date: filtered[0].date };
    }

    console.log(`✗ ${restaurantName}: No availability found`);
    return { available: false, date: null };
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error checking ${restaurantName}: ${error.message}`);
    return { available: false, date: null, error: error.message };
  } finally {
    if (browser) {
      console.log(`[${new Date().toISOString()}] Closing browser for ${restaurantName}`);
      await browser.close();
    }
  }
}

async function checkOpenTableAvailability(restaurantId, restaurantName, cancellationHours = 72) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(`https://www.opentable.com/r/${restaurantId}-new-york`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for availability calendar
    await page.waitForSelector('[role="button"][aria-label*="AM"], [role="button"][aria-label*="PM"]', {
      timeout: 5000
    }).catch(() => null);

    // Extract available times
    const availableTimes = await page.evaluate(() => {
      const times = [];
      const buttons = document.querySelectorAll('[role="button"][aria-label*="AM"], [role="button"][aria-label*="PM"]');

      buttons.forEach(btn => {
        if (!btn.classList.contains('disabled') && !btn.getAttribute('aria-disabled')) {
          const label = btn.getAttribute('aria-label') || btn.textContent;
          times.push({
            label: label,
            available: true
          });
        }
      });

      return times;
    });

    if (availableTimes.length > 0) {
      console.log(`✓ ${restaurantName}: Available at ${availableTimes[0].label}`);
      return { available: true, time: availableTimes[0].label };
    }

    console.log(`✗ ${restaurantName}: No availability found`);
    return { available: false, time: null };
  } catch (error) {
    console.error(`Error checking ${restaurantName}:`, error.message);
    return { available: false, time: null, error: error.message };
  } finally {
    if (browser) await browser.close();
  }
}

async function checkSevenroomsAvailability(restaurantName, cancellationHours = 24) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto('https://www.sevenrooms.com/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Search for the restaurant
    await page.type('input[placeholder*="search"], input[placeholder*="Search"]', restaurantName, {
      delay: 100
    }).catch(() => null);

    await page.waitForTimeout(1000);

    // Click on restaurant if found
    const restaurantLink = await page.$(`text=${restaurantName}`);
    if (restaurantLink) {
      await restaurantLink.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => null);
    }

    // Check for availability
    const availableDates = await page.evaluate(() => {
      const dates = [];
      const dateElements = document.querySelectorAll('[data-date], .available-date');

      dateElements.forEach(el => {
        const dateStr = el.getAttribute('data-date') || el.textContent;
        if (dateStr && !el.classList.contains('disabled')) {
          dates.push(dateStr);
        }
      });

      return dates;
    });

    if (availableDates.length > 0) {
      console.log(`✓ ${restaurantName}: Available on ${availableDates[0]}`);
      return { available: true, date: availableDates[0] };
    }

    console.log(`✗ ${restaurantName}: No availability found`);
    return { available: false, date: null };
  } catch (error) {
    console.error(`Error checking ${restaurantName}:`, error.message);
    return { available: false, date: null, error: error.message };
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = {
  checkResyAvailability,
  checkOpenTableAvailability,
  checkSevenroomsAvailability
};
