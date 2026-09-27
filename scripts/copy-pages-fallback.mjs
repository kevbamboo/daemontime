import { copyFile, mkdir } from "node:fs/promises";

await copyFile("dist/index.html", "dist/404.html");

// Publish real entry files for known routes so direct visits return HTTP 200.
for (const route of ["login", "signup", "forgot-password", "reset-password"]) {
  await mkdir(`dist/${route}`, { recursive: true });
  await copyFile("dist/index.html", `dist/${route}/index.html`);
}
await copyFile("CNAME", "dist/CNAME");
