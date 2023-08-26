const puppeteer = require("puppeteer");
const STATUS_URL = "https://status.cfx.re/";
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const BASE_SELECTOR = "body";

const alertWebhook = "INSERT WEBHOOK HERE";
const webhookThumbnail = "https://placehold.co/500x500";
const selectors = {
  globalStatus: getSelector(1, 1, "span.status.font-large"),
  cfxPlatformServer: getSelector(1, 3, "span.component-status"),
  fivemStatus: getSelector(1, 1, "span.component-status"),
  cnlStatus: getSelector(2, 1, "span.component-status"),
  policyStatus: getSelector(2, 2, "span.component-status"),
  keymasterStatus: getSelector(2, 3, "span.component-status"),
  forumsStatus: getSelector(3, 1, "span.component-status"),
  serverListStatus: getSelector(3, 2, "span.component-status"),
  runtimeStatus: getSelector(3, 3, "span.component-status"),
  idmsStatus: getSelector(3, 4, "span.component-status"),
};

const statusMap = new Map();

function getSelector(component, subComponent, status) {
  return `${BASE_SELECTOR} > div.layout-content.status.status-index.starter > div.container > div.components-section.font-regular > div.components-container.one-column > div:nth-child(${component}) > div.child-components-container > div:nth-child(${subComponent}) > ${status}`;
}

async function sendWebhookMessage(webhook, status) {
  const message = {
    embeds: [
      {
        title: "CFX Status Update",
        description: `The status of **${status}** has changed to **${statusMap.get(
          status
        )}**, please check https://status.cfx.re for more information.`,
        color: 0x853dbf,
        thumbnail: {
          url: webhookThumbnail,
        },
        timestamp: new Date(),
      },
    ],
  };

  const response = await fetch(webhook, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    console.error(`Failed to send webhook message to ${webhook}`);
  }

  return response;
}

async function getTextFromSelector(page, selector) {
  await page.waitForSelector(selector);
  const el = await page.$(selector);
  const text = await el.evaluate((e) => e.innerHTML);
  return text.replace(/(\r\n|\n|\r)/gm, "").trim();
}

async function checkStatusAndTakeAction(page, statusMap) {
  for (const [key, selector] of Object.entries(selectors)) {
    try {
      const status = await getTextFromSelector(page, selector);
      statusMap.set(key, status);

      if (!status.toLowerCase().includes("operational")) {
        if (statusMap.get(key) !== status) {
          await sendWebhookMessage(alertWebhook, key);
        }
      }
    } catch (error) {
      console.error(`Error processing status for ${key}: ${error}`);
    }
  }
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  async function refreshStatusesAndCheck() {
    await page.goto(STATUS_URL);
    await checkStatusAndTakeAction(page, statusMap);
    setTimeout(refreshStatusesAndCheck, REFRESH_INTERVAL_MS);
  }

  refreshStatusesAndCheck();

  process.on("SIGINT", async () => {
    await browser.close();
    process.exit();
  });
})();
