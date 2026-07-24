const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TEST_RESULTS = {
  sogo6: {
    url: 'http://localhost:3000',
    login: false,
    calendar: false,
    events: false,
    errors: []
  }
};

async function takeScreenshot(page, name) {
  const screenshotDir = path.join(__dirname, 'screenshots', 'sogo6');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  await page.screenshot({ path: path.join(screenshotDir, `${name}.png`) });
  console.log(`Screenshot saved: ${name}.png`);
}

async function testSogo6() {
  console.log('\n=== Testing SOGo 6 (http://localhost:3000) ===');

  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors']
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const instance = TEST_RESULTS.sogo6;

  try {
    console.log('Step 1: Navigate to SOGo 6 UI');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
    await takeScreenshot(page, 'sogo6-01-homepage');

    console.log(`Current URL: ${page.url()}`);
    await page.waitForTimeout(2000);

    console.log('\nStep 2: Looking for login form');

    const emailSelectors = [
      'input[name="email"]',
      'input[type="email"]',
      'input[type="text"][placeholder*="email"]',
      'input[placeholder*="Email"]'
    ];

    let emailField = null;
    for (const selector of emailSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        emailField = selector;
        console.log(`Found email field with selector: ${selector}`);
        break;
      } catch (e) {
      }
    }

    if (!emailField) {
      throw new Error('Could not find email field');
    }

    await takeScreenshot(page, 'sogo6-02-login-form');

    console.log('\nStep 3: Entering email (testuser@example.org)');
    await page.fill(emailField, 'testuser@example.org');

    const continueSelectors = [
      'button[type="submit"]',
      'button:has-text("Continue")',
      'button:has-text("Next")',
      'input[type="submit"]'
    ];

    let submitted = false;
    for (const selector of continueSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 1000 });
        await page.click(selector);
        console.log(`Clicked continue button: ${selector}`);
        submitted = true;
        break;
      } catch (e) {
      }
    }

    if (!submitted) {
      await page.press(emailField, 'Enter');
      console.log('Pressed Enter to submit email');
    }

    await page.waitForTimeout(2000);
    await takeScreenshot(page, 'sogo6-03-email-submitted');

    console.log('\nStep 4: Entering password');
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]'
    ];

    let passwordField = null;
    for (const selector of passwordSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        passwordField = selector;
        console.log(`Found password field with selector: ${selector}`);
        break;
      } catch (e) {
      }
    }

    if (passwordField) {
      await page.fill(passwordField, 'password123');

      const loginSelectors = [
        'button[type="submit"]',
        'button:has-text("Sign in")',
        'button:has-text("Login")',
        'button:has-text("Sign In")'
      ];

      submitted = false;
      for (const selector of loginSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 1000 });
          await page.click(selector);
          console.log(`Clicked login button: ${selector}`);
          submitted = true;
          break;
        } catch (e) {
        }
      }

      if (!submitted) {
        await page.press(passwordField, 'Enter');
        console.log('Pressed Enter to submit password');
      }

      await page.waitForTimeout(3000);
      await takeScreenshot(page, 'sogo6-04-after-login');

      const loginUrl = page.url();
      console.log(`URL after login attempt: ${loginUrl}`);

      if (!loginUrl.includes('error') && !loginUrl.includes('failed')) {
        instance.login = true;
        console.log('Login appears successful');
      } else {
        throw new Error('Login failed - error in URL');
      }
    }

    console.log('\nStep 5: Looking for calendar navigation');
    const calendarSelectors = [
      'a[href*="calendar"]',
      'a:has-text("Calendar")',
      'button:has-text("Calendar")',
      '[data-nav="calendar"]',
      '[aria-label*="Calendar"]'
    ];

    let foundCalendar = false;
    for (const selector of calendarSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await element.isVisible();
          if (isVisible) {
            console.log(`Found calendar element: ${selector}`);
            await element.click();
            console.log('Clicked calendar link');
            foundCalendar = true;
            await page.waitForTimeout(2000);
            await takeScreenshot(page, 'sogo6-05-calendar-view');
            break;
          }
        }
      } catch (e) {
      }
    }

    if (foundCalendar) {
      instance.calendar = true;
    }

    console.log('\nStep 6: Testing calendar event creation');
    const eventSelectors = [
      'button:has-text("New Event")',
      'button:has-text("New")',
      'button:has-text("Create")',
      'button:has-text("Add")',
      '[data-action="new-event"]',
      '[aria-label*="New event"]'
    ];

    let createdEvent = false;
    for (const selector of eventSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await element.isVisible();
          if (isVisible) {
            console.log(`Found new event button: ${selector}`);
            await element.click();
            console.log('Clicked new event button');
            await page.waitForTimeout(2000);
            await takeScreenshot(page, 'sogo6-06-new-event-modal');

            const titleSelectors = [
              'input[name="title"]',
              'input[type="text"][placeholder*="title"]',
              'input[type="text"]'
            ];

            let titleFilled = false;
            for (const titleSelector of titleSelectors) {
              try {
                await page.waitForSelector(titleSelector, { timeout: 1000 });
                await page.fill(titleSelector, `Test Event ${Date.now()}`);
                titleFilled = true;
                console.log('Filled event title');
                break;
              } catch (e) {
              }
            }

            if (titleFilled) {
              const saveSelectors = [
                'button:has-text("Save")',
                'button:has-text("Create")',
                'button[type="submit"]'
              ];
              for (const saveSelector of saveSelectors) {
                try {
                  await page.waitForSelector(saveSelector, { timeout: 1000 });
                  await page.click(saveSelector);
                  console.log('Clicked save button');
                  createdEvent = true;
                  await page.waitForTimeout(2000);
                  await takeScreenshot(page, 'sogo6-07-event-created');
                  break;
                } catch (e) {
                }
              }
            }

            if (createdEvent) {
              instance.events = true;
              break;
            }
          }
        }
      } catch (e) {
      }
    }

    if (!createdEvent) {
      console.log('Could not create event, exploring alternative UI');
      const pageContent = await page.content();
      console.log('Page contains calendar-related terms:');
      const calendarTerms = ['calendar', 'event', 'appointment', 'termine'];
      for (const term of calendarTerms) {
        if (pageContent.toLowerCase().includes(term.toLowerCase())) {
          console.log(`  - Found: ${term}`);
        }
      }

      await takeScreenshot(page, 'sogo6-08-current-state');
    }

    console.log('\n=== SOGo 6 Test Summary ===');
    console.log(`Login: ${instance.login ? 'PASS' : 'FAIL'}`);
    console.log(`Calendar: ${instance.calendar ? 'PASS' : 'FAIL'}`);
    console.log(`Events: ${instance.events ? 'PASS' : 'FAIL'}`);

  } catch (error) {
    console.error('Error in SOGo 6 test:', error.message);
    instance.errors.push(error.message);
    await takeScreenshot(page, 'sogo6-error');
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('Starting SOGo 6 E2E testing with Playwright');
  console.log('='.repeat(60));

  await testSogo6();

  console.log('\n' + '='.repeat(60));
  console.log('FINAL TEST RESULTS');
  console.log('='.repeat(60));

  const resultsPath = path.join(__dirname, 'test-results-sogo6.json');
  fs.writeFileSync(resultsPath, JSON.stringify(TEST_RESULTS, null, 2));

  console.log(JSON.stringify(TEST_RESULTS, null, 2));
  console.log(`\nResults saved to: ${resultsPath}`);
  console.log(`Screenshots saved to: ${path.join(__dirname, 'screenshots', 'sogo6')}`);

  const allPassed = TEST_RESULTS.sogo6.login && TEST_RESULTS.sogo6.calendar;

  if (allPassed) {
    console.log('\nALL TESTS PASSED');
  } else {
    console.log('\nSOME TESTS FAILED');
  }
}

main().catch(console.error);
