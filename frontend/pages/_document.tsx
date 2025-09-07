import { Html, Head, Main, NextScript } from "next/document";

const swaggerVersion = "5.13.0";

export default function Document() {
  return (
    <Html>
      <Head>
        <link rel="stylesheet" href="/assets/styles/bootstrap.min.css" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href={`https://unpkg.com/swagger-ui-dist@${swaggerVersion}/swagger-ui.css`}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
