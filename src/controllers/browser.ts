import * as ChromeLauncher from 'chrome-launcher';
import * as path from 'path';
import { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import { CreateConfig } from '../config/create-config';
import { puppeteerConfig } from '../config/puppeteer.config';
import chalk = require('chalk');
import StealthPlugin = require('puppeteer-extra-plugin-stealth');

export async function initWhatsapp(session: string, options: CreateConfig) {
  const browser = await initBrowser(session, options);
  const waPage = await getWhatsappPage(browser);
  await waPage.setUserAgent(
    'WhatsApp/2.2037.6 Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36'
  );

  await waPage.goto(puppeteerConfig.whatsappUrl);
  return waPage;
}

export async function injectApi(page: Page) {
  console.log('A');
  await page.waitForFunction(() => {
    // @ts-ignore
    return webpackJsonp !== undefined;
  });

  console.log('B');
  await page.addScriptTag({
    path: require.resolve(path.join(__dirname, '../lib/wapi', 'wapi.js')),
  });

  console.log('C');
  await page.addScriptTag({
    path: require.resolve(
      path.join(__dirname, '../lib/middleware', 'middleware.js')
    ),
  });

  console.log('D');
  // Make sure WAPI is initialized
  await page.waitForFunction(() => {
    // @ts-ignore
    return !!WAPI.getWAVersion;
  });

  console.log('E');
  return page;
}

/**
 * Initializes browser, will try to use chrome as default
 * @param session
 */
export async function initBrowser(
  session: string,
  options: CreateConfig,
  extras = {}
) {
  if (options.useChrome) {
    const chromePath = getChrome();
    if (chromePath) {
      extras = { ...extras, executablePath: chromePath };
    } else {
      console.log('Chrome not found, using chromium');
      extras = {};
    }
  }

  // Use stealth plugin to avoid being detected as a bot
  puppeteer.use(StealthPlugin());

  const browser = await puppeteer.launch({
    // headless: true,
    headless: options.headless,
    devtools: options.devtools,
    userDataDir: path.join(process.cwd(), session),
    args: options.browserArgs
      ? options.browserArgs
      : [...puppeteerConfig.chroniumArgs],
    ...extras,
  });
  return browser;
}

export async function getWhatsappPage(browser: Browser) {
  const pages = await browser.pages();
  console.assert(pages.length > 0);
  return pages[0];
}

/**
 * Retrieves chrome instance path
 */
function getChrome() {
  try {
    const chromeInstalations = ChromeLauncher.Launcher.getInstallations();
    return chromeInstalations[0];
  } catch (error) {
    return undefined;
  }
}
