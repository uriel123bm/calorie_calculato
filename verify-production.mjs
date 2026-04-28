const baseUrl = (process.env.VERIFY_URL || "https://calorie-calculato.vercel.app").replace(/\/$/, "");
const requiredMarkers = (process.env.VERIFY_MARKERS || "daily-tracker-top-grid")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${url} (${res.status})`);
  }
  return res.text();
}

function pickCssPath(html) {
  const match = html.match(/href="(\/assets\/index-[^"]+\.css)"/);
  if (!match) throw new Error("Could not locate built CSS asset in homepage HTML.");
  return match[1];
}

async function run() {
  const html = await fetchText(`${baseUrl}/`);
  const cssPath = pickCssPath(html);
  const css = await fetchText(`${baseUrl}${cssPath}`);

  const missing = requiredMarkers.filter((marker) => !css.includes(marker));
  if (missing.length > 0) {
    console.error(`Missing CSS markers in production build: ${missing.join(", ")}`);
    process.exit(1);
  }

  console.log(`Verified ${baseUrl}${cssPath}`);
  console.log(`Markers found: ${requiredMarkers.join(", ")}`);
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
