import { defineConfig, devices } from "@playwright/test";

const FRONTEND_PORT = 5173;
const BACKEND_PORT = 8000;

export const ADMIN_MAIL_ID =
  process.env.E2E_ADMIN_MAIL_ID ?? "john@example.com";

export const ADMIN_PASSWORD =
  process.env.E2E_ADMIN_PASSWORD ?? "ChangeMe123!";

// ADO / CI can provide BASE_URL.
// PLAYWRIGHT_BASE_URL is also supported for local/manual usage.
const rawBaseURL =
  process.env.BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL;

const REMOTE_BASE_URL = rawBaseURL
  ? /^https?:\/\//.test(rawBaseURL)
    ? rawBaseURL
    : `https://${rawBaseURL}`
  : undefined;

const VERCEL_BYPASS_TOKEN =
  process.env.VERCEL_PROTECTION_BYPASS;

export default defineConfig({
  testDir: "./e2e",

  fullyParallel: true,

  // Fail the pipeline if test.only is accidentally committed.
  forbidOnly: !!process.env.CI,

  // Retry failed tests in CI.
  retries: process.env.CI ? 2 : 0,

  // Use one worker in CI for more stable E2E execution.
  workers: process.env.CI ? 1 : undefined,

  reporter: process.env.CI
    ? [
        [
          "junit",
          {
            outputFile: "playwright-report/results.xml",
          },
        ],
        [
          "html",
          {
            open: "never",
          },
        ],
      ]
    : "html",

  // Remote deployments may take time to respond because of
  // cold starts.
  timeout: REMOTE_BASE_URL ? 90_000 : 30_000,

  expect: {
    timeout: REMOTE_BASE_URL ? 20_000 : 5_000,
  },

  use: {
    // If BASE_URL exists, test the deployed application.
    // Otherwise, test the local frontend.
    baseURL:
      REMOTE_BASE_URL ??
      `http://localhost:${FRONTEND_PORT}`,

    // Run headless in ADO/CI.
    // Locally, you can still run headed if desired.
    headless: !!process.env.CI,

    trace: "on-first-retry",

    screenshot: "only-on-failure",

    video: "retain-on-failure",

    launchOptions: {
      // Don't slow down CI tests.
      // PW_SLOWMO can still be used locally.
      slowMo: process.env.CI
        ? 0
        : Number(process.env.PW_SLOWMO ?? 0),
    },

    // If Vercel Deployment Protection is enabled,
    // send the bypass headers.
    ...(VERCEL_BYPASS_TOKEN
      ? {
          extraHTTPHeaders: {
            "x-vercel-protection-bypass":
              VERCEL_BYPASS_TOKEN,

            "x-vercel-set-bypass-cookie": "true",
          },
        }
      : {}),
  },

  projects: [
    {
      name: "chromium",

      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],

  // Start local frontend + backend only when
  // BASE_URL / PLAYWRIGHT_BASE_URL is NOT provided.
  //
  // When ADO provides BASE_URL, these servers are NOT started.
  webServer: REMOTE_BASE_URL
    ? undefined
    : [
        {
          command:
            "npm run dev -- --port 5173 --strictPort",

          cwd: import.meta.dirname,

          url: `http://localhost:${FRONTEND_PORT}`,

          reuseExistingServer: !process.env.CI,

          timeout: 120_000,
        },

        {
          command:
            'node -e "require(\'fs\').rmSync(\'e2e-test.db\', { force: true })" && python -m app.seed && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000',

          cwd: `${import.meta.dirname}/../backend`,

          url: `http://localhost:${BACKEND_PORT}/docs`,

          reuseExistingServer: !process.env.CI,

          timeout: 120_000,

          env: {
            DATABASE_PATH: "./e2e-test.db",

            CORS_ORIGINS:
              `http://localhost:${FRONTEND_PORT}`,

            DEFAULT_ADMIN_MAIL_ID:
              ADMIN_MAIL_ID,

            DEFAULT_ADMIN_PASSWORD:
              ADMIN_PASSWORD,
          },
        },
      ],
});