<template>
  <div class="home-content">
    <div class="container">
      <h2>Write Once, Run Everywhere</h2>
      <p class="subtitle">
        One action class. It's your HTTP endpoint, your CLI command, your
        WebSocket handler, and your background task — all at the same time.
      </p>
      <div class="code-example">
        <div class="language-ts vp-adaptive-theme">
          <pre><code><span class="line"><span style="color: var(--vp-c-brand-1)">export class</span> Status <span style="color: var(--vp-c-brand-1)">implements</span> Action {</span>
<span class="line">  name = <span style="color: #b56959">"status"</span>;</span>
<span class="line">  description = <span style="color: #b56959">"Return the status of the server"</span>;</span>
<span class="line">  inputs = z.object({});</span>
<span class="line">  web = { route: <span style="color: #b56959">"/status"</span>, method: HTTP_METHOD.GET };</span>
<span class="line">  task = { queue: <span style="color: #b56959">"default"</span>, frequency: <span style="color: #2f848f">60000</span> };</span>
<span class="line"></span>
<span class="line">  <span style="color: var(--vp-c-brand-1)">async</span> run() {</span>
<span class="line">    <span style="color: var(--vp-c-brand-1)">return</span> {</span>
<span class="line">      name: api.process.name,</span>
<span class="line">      uptime: Date.now() - api.bootTime,</span>
<span class="line">    };</span>
<span class="line">  }</span>
<span class="line">}</span></code></pre>
        </div>
      </div>
      <p class="cta-text">
        That's it. Same validation, same error handling, same response shape —
        whether the request comes from a browser, a CLI, or a cron job.
      </p>
    </div>
  </div>
</template>

<style scoped>
.home-content {
  padding: 48px 24px 64px;
  max-width: 900px;
  margin: 0 auto;
}

.container h2 {
  font-size: 2rem;
  font-weight: 700;
  text-align: center;
  margin-bottom: 8px;
}

.subtitle {
  text-align: center;
  color: var(--vp-c-text-2);
  font-size: 1.1rem;
  margin-bottom: 32px;
}

.cta-text {
  text-align: center;
  color: var(--vp-c-text-2);
  font-size: 1rem;
  margin-top: 24px;
}

.code-example {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
}

.code-example pre {
  padding: 24px;
  margin: 0;
  overflow-x: auto;
  font-size: 0.9rem;
  line-height: 1.6;
}
</style>
