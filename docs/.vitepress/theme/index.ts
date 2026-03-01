import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import Layout from "./Layout.vue";
import Changelog from "./Changelog.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component("Changelog", Changelog);
  },
} satisfies Theme;
