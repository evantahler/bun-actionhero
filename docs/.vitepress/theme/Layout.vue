<script setup>
import DefaultTheme from "vitepress/theme";
import { useData } from "vitepress";
import CliSnippet from "./CliSnippet.vue";
import HomeContent from "./HomeContent.vue";
import MarkdownLink from "./MarkdownLink.vue";

const { Layout } = DefaultTheme;
const { frontmatter } = useData();
</script>

<template>
  <Layout>
    <template #home-hero-info-after>
      <CliSnippet />
    </template>
    <template #home-features-after>
      <HomeContent />
    </template>
    <template v-if="frontmatter.layout !== 'home'" #doc-footer-before>
      <MarkdownLink />
    </template>
    <template #layout-bottom>
      <div class="footer-lion">
        <img src="/images/lion-sitting.svg" alt="Keryx lion" />
      </div>
    </template>
  </Layout>
</template>

<style scoped>
.footer-lion {
  display: flex;
  justify-content: center;
  padding-bottom: 24px;
}
</style>
