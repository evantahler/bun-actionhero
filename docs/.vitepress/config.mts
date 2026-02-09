import { defineConfig } from "vitepress";
import llmstxt from "vitepress-plugin-llms";

export default defineConfig({
  title: "bun-actionhero",
  description:
    "The modern TypeScript API framework — transport-agnostic actions for HTTP, WebSocket, CLI, background tasks, and MCP, built on Bun.",
  head: [["link", { rel: "icon", href: "/images/logo.svg" }]],

  themeConfig: {
    logo: "/images/logo.svg",
    nav: [
      { text: "Guide", link: "/guide/" },
      { text: "Reference", link: "/reference/actions" },
      {
        text: "GitHub",
        link: "https://github.com/evantahler/bun-actionhero",
      },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [{ text: "Getting Started", link: "/guide/" }],
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
            { text: "Testing", link: "/guide/testing" },
            { text: "Deployment", link: "/guide/deployment" },
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
              text: "Servers (HTTP, WebSocket, CLI)",
              link: "/reference/servers",
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
        link: "https://github.com/evantahler/bun-actionhero",
      },
    ],
    search: { provider: "local" },
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2024-present Evan Tahler",
    },
  },

  sitemap: { hostname: "https://bun.actionherojs.com" },

  vite: {
    plugins: [llmstxt()],
  },
});
