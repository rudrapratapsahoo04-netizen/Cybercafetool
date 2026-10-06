const sharp = require("sharp");

async function createIcons() {
  await sharp("public/favicon.svg")
    .resize(192, 192, {
      fit: "contain",
      background: {
        r: 7,
        g: 17,
        b: 31,
        alpha: 1
      }
    })
    .png()
    .toFile("public/pwa-192x192.png");

  await sharp("public/favicon.svg")
    .resize(512, 512, {
      fit: "contain",
      background: {
        r: 7,
        g: 17,
        b: 31,
        alpha: 1
      }
    })
    .png()
    .toFile("public/pwa-512x512.png");

  console.log("PWA icons created successfully.");
}

createIcons().catch((error) => {
  console.error(error);
  process.exit(1);
});