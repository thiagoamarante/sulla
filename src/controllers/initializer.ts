import { readFileSync } from 'fs';
import latestVersion from 'latest-version';
import { Page } from 'puppeteer';
import { from, interval, timer } from 'rxjs';
import { map, takeUntil, tap, delay, switchMap } from 'rxjs/operators';
import { Whatsapp } from '../api/whatsapp';
import { CreateConfig, defaultOptions } from '../config/create-config';
import { upToDate } from '../utils/semver';
import { isAuthenticated, isInsideChat, retrieveQR } from './auth';
import { initWhatsapp, injectApi } from './browser';
import chalk = require('chalk');
import boxen = require('boxen');
import Spinnies = require('spinnies');
import { rejects } from 'assert';
const { version } = require('../../package.json');
import * as path from 'path';

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
  options?: CreateConfig
) {
  // Check for updates if needed
  if (!updatesChecked) {
    //spinnies.add('sulla-version-spinner', { text: 'Checking for updates...' });
    //checkSullaVersion(spinnies);
    updatesChecked = true;
  }

  // Initialize whatsapp
  const mergedOptions = { ...defaultOptions, ...options };
  let waPage: Page = null;
  let tryInitWhatsApp = true;
  while (tryInitWhatsApp) {
    console.log(`${session}: Creating whatsapp instace`);
    try {
      waPage = await initWhatsapp(session, mergedOptions);
      tryInitWhatsApp = false;
    } catch (e) {
      console.log(`${session}: InitWhatsapp error`);
    }

    if (tryInitWhatsApp) await sleep(5000);
  }

  console.log(`${session}: Authenticating`);
  const authenticated = await isAuthenticated(waPage);

  // If not authenticated, show QR and wait for scan
  if (authenticated) {
    // Wait til inside chat
    //await isInsideChat(waPage).toPromise();
    console.log(`${session}: Authenticated`);
  } else {
    let currentCode = '';
    const login = new Promise(async (resolve, reject) => {
      var check = true;
      var result = false;
      while (check) {
        let codes = { code: null, data: null };
        try {
          await waPage.waitForSelector('canvas', { timeout: 2000 });
          await waPage.addScriptTag({
            path: require.resolve(
              path.join(__dirname, '../lib/jsQR', 'jsQR.js')
            ),
          });
          codes = await waPage.evaluate(() => {
            const canvas = document.querySelector('canvas');
            const context = canvas.getContext('2d');

            // @ts-ignore
            const code = jsQR(
              context.getImageData(0, 0, canvas.width, canvas.height).data,
              canvas.width,
              canvas.height
            );

            return { code: code.data, data: canvas.toDataURL() };
          });
        } catch (e) {
          codes = { code: null, data: null };
        }

        if (codes.data == currentCode) {
          try {
            var element = await waPage.waitForXPath(
              "//div[contains(text(), 'Click to reload QR code')]",
              { timeout: 10000 }
            );
            if (element) {
              await element.click();
            }
          } catch (e) {}
        } else {
          currentCode = codes.data;
          check = await catchQR(codes.data, '');
          if (check) {
            result = await from(
              waPage
                .waitForFunction(
                  `
              document.getElementsByClassName('app')[0] &&
              document.getElementsByClassName('app')[0].attributes &&
              !!document.getElementsByClassName('app')[0].attributes.tabindex
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

    console.log(`${session}: Authenticated`);
  }

  let tryInject = true;
  while (tryInject) {
    console.log(`${session}: Try Injecting api`);
    try {
      waPage = await injectApi(waPage);
      tryInject = false;
    } catch (e) {
      console.log(`${session}: Injecting api error`);
    }

    if (tryInject) await sleep(5000);
  }

  console.log(`${session}: Injected`);

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
