<script setup>
import DefaultTheme from "vitepress/theme";
import HomeContent from "./HomeContent.vue";
import CliSnippet from "./CliSnippet.vue";

const { Layout } = DefaultTheme;
</script>

<template>
  <Layout>
    <template #home-hero-info-after>
      <CliSnippet />
    </template>
    <template #home-features-after>
      <HomeContent />
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
