import { readFileSync } from 'fs';
import latestVersion from 'latest-version';
import { Page } from 'puppeteer';
import { from, interval, timer } from 'rxjs';
import { map, takeUntil, tap, delay, switchMap } from 'rxjs/operators';
import { Whatsapp } from '../api/whatsapp';
import { CreateConfig, defaultOptions } from '../config/create-config';
import { upToDate } from '../utils/semver';
import { isAuthenticated, isInsideChat, retrieveQR } from './auth';
import {
  initWhatsapp,
  injectApi,
  initBrowser,
  getWhatsappPage,
} from './browser';
import chalk = require('chalk');
import boxen = require('boxen');
import Spinnies = require('spinnies');
import { rejects } from 'assert';
const { version } = require('../../package.json');
import * as path from 'path';
import { puppeteerConfig } from '../config/puppeteer.config';

// Global
let updatesChecked = false;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Should be called to initialize whatsapp client
 */
export async function create(
  session = 'session',
  catchQR?: (qrCode: string, asciiQR: string) => Promise<boolean>,
  log?: (message: string) => Promise<void>,
  options?: CreateConfig
) {
  // Check for updates if needed
  if (!updatesChecked) {
    //spinnies.add('sulla-version-spinner', { text: 'Checking for updates...' });
    //checkSullaVersion(spinnies);
    updatesChecked = true;
  }

  let callLog = async (message) => {
    if (log) await log(message);
  };

  // Initialize whatsapp
  const mergedOptions = { ...defaultOptions, ...options };

  await callLog(`Start browser`);
  const browser = await initBrowser(session, options);
  let waPage = await getWhatsappPage(browser);
  await waPage.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Safari/537.36'
  );

  let attempts = 0;
  let tryOpenWhatsAppWeb = true;
  while (tryOpenWhatsAppWeb) {
    attempts++;
    if (attempts < 5) {
      await callLog(`Opening WhatsApp Web`);
      try {
        await waPage.goto(puppeteerConfig.whatsappUrl);
        tryOpenWhatsAppWeb = false;
      } catch (e) {
        await callLog(`Opening WhatsApp Web error - ${e.toString()}`);
      }

      if (tryOpenWhatsAppWeb) await sleep(5000);
    } else throw 'Error Opening WhatsApp Web';
  }

  await callLog(`Authenticating`);
  const authenticated = await isAuthenticated(waPage);

  if (authenticated) {
    await callLog(`Authenticated`);
  } else {
    const login = new Promise(async (resolve, reject) => {
      var check = true;
      var result = false;
      var lastData = null;
      while (check) {
        let codes = { code: null, data: null };
        try {
          await waPage.waitForSelector('canvas', { timeout: 2000 });
          codes = await waPage.evaluate(() => {
            const canvas = document.querySelector('canvas');
            return { code: null, data: canvas.toDataURL() };
          });

          if (codes.data == lastData) {
            try {
              var element = await waPage.waitForXPath(
                "//div[contains(text(), 'Click to reload QR code')]",
                { timeout: 10000 }
              );

              if (element) {
                await element.click();

                codes = await waPage.evaluate(() => {
                  const canvas = document.querySelector('canvas');
                  return { code: null, data: canvas.toDataURL() };
                });
              }
            } catch (e) {
              await callLog('error try reload QR Code');
            }
          } else lastData = codes.data;
        } catch (e) {
          await callLog('error try get canvas');
          codes = { code: null, data: null };
        }

        if (codes.data) check = await catchQR(codes.data, '');
        else check = true;

        if (check) {
          result = await from(
            waPage
              .waitForFunction(
                `
                (document.getElementsByClassName('app')[0] &&
                document.getElementsByClassName('app')[0].attributes &&
                !!document.getElementsByClassName('app')[0].attributes.tabindex) || 
                (document.getElementsByClassName('two')[0] && 
                document.getElementsByClassName('two')[0].attributes && 
                !!document.getElementsByClassName('two')[0].attributes.tabindex)
            `,
                {
                  timeout: 20000,
                }
              )
              .then(() => true)
              .catch(() => false)
          ).toPromise();

          if (result) check = false;
        }
      }

      if (result) {
        resolve();
      } else {
        await waPage.close();
        if (waPage.browser) {
          await waPage.browser().close();
          waPage.browser().process().kill();
        }
        reject('LoginCanceled');
      }
    });
    await login;

    await callLog(`Authenticated`);
  }

  attempts = 0;
  let tryInject = true;
  while (tryInject) {
    attempts++;
    if (attempts < 5) {
      await callLog(`Try Injecting api`);
      try {
        waPage = await injectApi(waPage);
        tryInject = false;
      } catch (e) {
        await callLog(`Injecting api error - ${e.toString()}`);
      }

      if (tryInject) await sleep(5000);
    } else throw 'Error Try Injecting api';
  }

  await callLog(`Injected`);

  return new Whatsapp(waPage);
}

function grabQRUntilInside(
  waPage: Page,
  options: CreateConfig,
  session: string,
  catchQR: (qrCode: string, asciiQR: string) => void
) {
  console.log('A:1');
  const isInside = isInsideChat(waPage);
  console.log('A:2');
  timer(0, options.refreshQR)
    .pipe(
      takeUntil(isInside),
      switchMap(() => retrieveQR(waPage))
    )
    .subscribe(({ data, asciiQR }) => {
      console.log('A:3');
      if (catchQR) {
        catchQR(data, asciiQR);
      }
      if (options.logQR) {
        console.clear();
        console.log(`Scan QR for: ${session}                `);
        console.log(asciiQR);
      }
    });
  console.log('A:4');
}

/**
 * Checs for a new versoin of sulla and logs
 */
function checkSullaVersion(spinnies) {
  latestVersion('sulla').then((latest) => {
    if (!upToDate(version, latest)) {
      logUpdateAvailable(version, latest);
    }

    spinnies.succeed('sulla-version-spinner', { text: 'Checking for updates' });
  });
}

/**
 * Logs a boxen of instructions to update
 * @param current
 * @param latest
 */
function logUpdateAvailable(current: string, latest: string) {
  // prettier-ignore
  const newVersionLog = 
  `There is a new version of ${chalk.bold(`sulla`)} ${chalk.gray(current)} ➜  ${chalk.bold.green(latest)}\n` + 
  `Update your package by running:\n\n` +
  `${chalk.bold('\>')} ${chalk.blueBright('npm update sulla')}`;

  console.log(boxen(newVersionLog, { padding: 1 }));
  console.log(
    `For more info visit: ${chalk.underline(
      'https://github.com/danielcardeenas/sulla/blob/master/UPDATES.md'
    )}\n`
  );
}
