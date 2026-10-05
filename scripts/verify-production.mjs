#!/usr/bin/env node
/**
 * ReelForge Production Readiness Verification Script
 * Validates configuration, environment variables, security rules, and database schema.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

console.log("\n========================================================");
console.log("   ReelForge Production Readiness Verification");
console.log("========================================================\n");

let passed = true;

function check(title, condition, hint) {
  if (condition) {
    console.log(`  [PASS] ${title}`);
  } else {
    console.log(`  [FAIL] ${title}`);
    if (hint) console.log(`         -> ${hint}`);
    passed = false;
  }
}

function warn(title, condition, tip) {
  if (condition) {
    console.log(`  [PASS] ${title}`);
  } else {
    console.log(`  [WARN] ${title}`);
    if (tip) console.log(`         -> Note: ${tip}`);
  }
}

// 1. Security Check: Leaked Secrets in Client Env
const envLocalPath = resolve(process.cwd(), ".env.local");
let envContent = "";
if (existsSync(envLocalPath)) {
  envContent = readFileSync(envLocalPath, "utf-8");
}

check(
  "Service role key is not exposed to client bundle",
  !envContent.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"),
  "Never prefix SUPABASE_SERVICE_ROLE_KEY with NEXT_PUBLIC_!"
);

check(
  "Stripe secret key is not exposed to client bundle",
  !envContent.includes("NEXT_PUBLIC_STRIPE_SECRET_KEY"),
  "Never prefix STRIPE_SECRET_KEY with NEXT_PUBLIC_!"
);

// 2. Schema Check
const schemaPath = resolve(process.cwd(), "supabase/schema.sql");
check("Supabase SQL schema file exists", existsSync(schemaPath));

if (existsSync(schemaPath)) {
  const schemaSql = readFileSync(schemaPath, "utf-8");
  check("Schema contains RLS enabled on profiles", schemaSql.includes("alter table public.profiles enable row level security;"));
  check("Schema contains RLS enabled on videos", schemaSql.includes("alter table public.videos enable row level security;"));
  check("Schema contains RLS enabled on credit_ledger", schemaSql.includes("alter table public.credit_ledger enable row level security;"));
  check("Schema contains claim_scenes queue function", schemaSql.includes("claim_scenes"));
  check("Schema contains daily refill spend_credits function", schemaSql.includes("spend_credits"));
  check("Schema contains moderation reports table", schemaSql.includes("create table public.reports"));
}

// 3. Worker & GPU Pipeline Check
const workerPath = resolve(process.cwd(), "worker/index.mjs");
const gpuServerPath = resolve(process.cwd(), "gpu-server/inference.py");
check("Server-side background worker daemon exists", existsSync(workerPath));
check("GPU inference pipeline (Wan 2.1 & LTX-Video) exists", existsSync(gpuServerPath));

// 4. API Routes Check
const routes = [
  "src/app/api/script/split/route.ts",
  "src/app/api/prompt/enhance/route.ts",
  "src/app/api/tts/route.ts",
  "src/app/api/checkout/route.ts",
  "src/app/api/stripe/webhook/route.ts",
  "src/app/api/extract/route.ts",
];
routes.forEach((r) => {
  check(`API Route exists: ${r}`, existsSync(resolve(process.cwd(), r)));
});

// 5. Mobile Package Check
const mobileAppPath = resolve(process.cwd(), "mobile/App.tsx");
check("Mobile Expo app starter exists", existsSync(mobileAppPath));

console.log("\n--------------------------------------------------------");
if (passed) {
  console.log("  ALL CRITICAL PRODUCTION CHECKS PASSED (Ready for Deploy)!");
} else {
  console.log("  SOME CHECKS FAILED. Review issues above before deploying.");
}
console.log("--------------------------------------------------------\n");
