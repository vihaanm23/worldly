#!/usr/bin/env node
/**
 * Test script: validates Worlds.json and checks that Marble URLs are reachable.
 * Run: node test/check-worlds.js
 * Optional: node test/check-worlds.js --open  (opens first world URL in your browser)
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const WORLDS_JSON_PATH = path.join(__dirname, "../unity/Assets/StreamingAssets/Worlds.json");

function loadWorlds() {
  const p = path.resolve(WORLDS_JSON_PATH);
  if (!fs.existsSync(p)) {
    console.error("Not found:", p);
    process.exit(1);
  }
  const raw = fs.readFileSync(p, "utf8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error("Invalid JSON in Worlds.json:", e.message);
    process.exit(1);
  }
  if (!data || !Array.isArray(data.worlds)) {
    console.error("Worlds.json must have a 'worlds' array.");
    process.exit(1);
  }
  return data.worlds;
}

function checkUrl(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { timeout: 10000 }, (res) => {
      // Follow redirects: 3xx is "reachable"
      const status = res.statusCode;
      if (status >= 200 && status < 400) {
        resolve({ ok: true, status });
      } else {
        resolve({ ok: false, status });
      }
    });
    req.on("error", (err) => resolve({ ok: false, error: err.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "timeout" });
    });
  });
}

async function main() {
  const openFirst = process.argv.includes("--open");

  console.log("Loading", WORLDS_JSON_PATH, "\n");
  const worlds = loadWorlds();

  if (worlds.length === 0) {
    console.log("No worlds in list. Add entries to Worlds.json and run again.");
    process.exit(0);
  }

  console.log("Validating structure and checking URLs:\n");
  let allOk = true;

  for (let i = 0; i < worlds.length; i++) {
    const w = worlds[i];
    const name = w.displayName || "(no name)";
    const url = w.marbleUrl;

    if (!url || typeof url !== "string") {
      console.log(`  [${i + 1}] ${name}: MISSING marbleUrl`);
      allOk = false;
      continue;
    }

    const result = await checkUrl(url);
    if (result.ok) {
      console.log(`  [${i + 1}] ${name}: OK (${result.status})`);
    } else {
      console.log(`  [${i + 1}] ${name}: FAIL (${result.status || result.error || "unknown"})`);
      allOk = false;
    }
  }

  console.log("");
  if (allOk) {
    console.log("All worlds have valid URLs. When you click a link (in the app or web launcher), the user should be able to enter the world.");
  } else {
    console.log("Some URLs failed. Fix Worlds.json or use the web launcher to test with a known-good Marble link.");
  }

  if (openFirst && worlds.length > 0 && worlds[0].marbleUrl) {
    const { exec } = require("child_process");
    const url = worlds[0].marbleUrl;
    const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    exec(`${cmd} "${url}"`, (err) => {
      if (err) console.warn("Could not open browser:", err.message);
      else console.log("\nOpened first world URL in browser. Confirm you can enter the world.");
    });
  }

  process.exit(allOk ? 0 : 1);
}

main();
