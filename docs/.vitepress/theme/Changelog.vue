<script setup>
import { ref, onMounted } from "vue";

const releases = ref([]);
const loading = ref(true);
const error = ref(null);

const GITHUB_API = "https://api.github.com/repos/evantahler/keryx/releases";

onMounted(async () => {
  try {
    const res = await fetch(GITHUB_API, {
      headers: { Accept: "application/vnd.github.v3+json" },
    });
    if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
    releases.value = await res.json();
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function renderBody(body) {
  if (!body) return "";
  return body
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>',
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/^## (.+)$/gm, '<h3 class="changelog-section-title">$1</h3>')
    .replace(/^\* (.+)$/gm, "<li>$1</li>")
    .replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>")
    .replace(/\n\n/g, "<br>");
}
</script>

<template>
  <div class="changelog">
    <div v-if="loading" class="changelog-loading">Loading releases...</div>
    <div v-else-if="error" class="changelog-error">
      <p>Failed to load releases from GitHub.</p>
      <p class="error-detail">{{ error }}</p>
      <p>
        <a
          href="https://github.com/evantahler/keryx/releases"
          target="_blank"
          rel="noopener"
        >
          View releases on GitHub →
        </a>
      </p>
    </div>
    <div v-else>
      <div
        v-for="release in releases"
        :key="release.id"
        class="changelog-release"
      >
        <div class="release-header">
          <a
            :href="release.html_url"
            target="_blank"
            rel="noopener"
            class="release-tag"
          >
            {{ release.tag_name }}
          </a>
          <span class="release-date">
            {{ formatDate(release.published_at) }}
          </span>
        </div>
        <div class="release-body" v-html="renderBody(release.body)" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.changelog {
  max-width: 740px;
  margin: 0 auto;
  padding: 0 24px;
}

.changelog-loading {
  text-align: center;
  padding: 48px 0;
  color: var(--vp-c-text-2);
}

.changelog-error {
  text-align: center;
  padding: 48px 0;
  color: var(--vp-c-text-2);
}

.error-detail {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85rem;
  color: var(--vp-c-danger-1);
}

.changelog-release {
  padding: 24px 0;
  border-bottom: 1px solid var(--vp-c-divider);
}

.changelog-release:last-child {
  border-bottom: none;
}

.release-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
}

.release-tag {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.release-tag:hover {
  text-decoration: underline;
}

.release-date {
  font-size: 0.85rem;
  color: var(--vp-c-text-3);
}

.release-body {
  color: var(--vp-c-text-2);
  line-height: 1.7;
}

.release-body :deep(ul) {
  list-style: disc;
  padding-left: 20px;
  margin: 8px 0;
}

.release-body :deep(li) {
  margin: 4px 0;
}

.release-body :deep(a) {
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.release-body :deep(a:hover) {
  text-decoration: underline;
}

.release-body :deep(.changelog-section-title) {
  font-size: 1rem;
  font-weight: 600;
  margin: 16px 0 8px;
  color: var(--vp-c-text-1);
}
</style>
