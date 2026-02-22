import { defineConfig } from "vitepress";
import llmstxt from "vitepress-plugin-llms";

export default defineConfig({
  title: "Keryx",
  description:
    "The modern TypeScript API framework — transport-agnostic actions for HTTP, WebSocket, CLI, background tasks, and MCP, built on Bun.",
  head: [["link", { rel: "icon", href: "/images/horn.svg" }]],

  themeConfig: {
    logo: "/images/horn.svg",
    nav: [
      { text: "Guide", link: "/guide/" },
      { text: "Reference", link: "/reference/actions" },
      {
        text: "GitHub",
        link: "https://github.com/evantahler/keryx",
      },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            { text: "Getting Started", link: "/guide/" },
            { text: "About Keryx", link: "/guide/about" },
          ],
        },
        {
          text: "Core Concepts",
          items: [
            { text: "Actions", link: "/guide/actions" },
            { text: "Initializers", link: "/guide/initializers" },
            { text: "Channels", link: "/guide/channels" },
            { text: "Tasks", link: "/guide/tasks" },
            { text: "Middleware", link: "/guide/middleware" },
            { text: "MCP", link: "/guide/mcp" },
            { text: "Configuration", link: "/guide/config" },
          ],
        },
        {
          text: "Usage",
          items: [
            { text: "CLI", link: "/guide/cli" },
            { text: "Authentication", link: "/guide/authentication" },
            { text: "Security", link: "/guide/security" },
            { text: "Testing", link: "/guide/testing" },
            { text: "Deployment", link: "/guide/deployment" },
          ],
        },
        {
          text: "Migration",
          items: [
            {
              text: "Coming from ActionHero",
              link: "/guide/from-actionhero",
            },
          ],
        },
      ],
      "/reference/": [
        {
          text: "Classes",
          items: [
            { text: "Action", link: "/reference/actions" },
            { text: "Initializer", link: "/reference/initializers" },
            {
              text: "API, Connection, Channel & more",
              link: "/reference/classes",
            },
          ],
        },
        {
          text: "Transports",
          items: [
            {
              text: "Servers (HTTP, WebSocket, CLI, MCP)",
              link: "/reference/servers",
            },
          ],
        },
        {
          text: "Utilities",
          items: [
            {
              text: "Zod Helpers & Mixins",
              link: "/reference/utilities",
            },
          ],
        },
        {
          text: "Configuration",
          items: [{ text: "Config Reference", link: "/reference/config" }],
        },
      ],
    },
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/evantahler/keryx",
      },
    ],
    search: { provider: "local" },
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2024-present Evan Tahler",
    },
  },

  sitemap: { hostname: "https://keryxjs.com" },

  vite: {
    plugins: [llmstxt()],
  },
});
