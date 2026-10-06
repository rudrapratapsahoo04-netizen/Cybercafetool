
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/Cybercafetool/",

  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",

      manifest: {
        name: "Cyber Cafe Photo Studio",
        short_name: "Photo Studio",
        description: "Cyber Cafe Photo Editing and Printing Studio",

        start_url: "/Cybercafetool/",
        scope: "/Cybercafetool/",

        display: "standalone",
        background_color: "#07111f",
        theme_color: "#07111f",
        orientation: "portrait-primary",

        icons: [
          {
            src: "/Cybercafetool/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/Cybercafetool/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },

      workbox: {
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,webp,jpg,jpeg}",
        ],
      },
    }),
  ],
});
