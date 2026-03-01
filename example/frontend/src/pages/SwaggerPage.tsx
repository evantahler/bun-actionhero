import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";

import { API_URL } from "../utils/client";

export default function SwaggerPage() {
  return (
    <div className="scalar-wrapper" style={{ height: "calc(100vh - 72px)" }}>
      <ApiReferenceReact
        configuration={{
          url: `${API_URL}/api/swagger`,
          darkMode: true,
          hideClientButton: true,
          hideDownloadButton: true,
          hiddenClients: true,
          withDefaultFonts: false,
          agent: { disabled: true },
          customCss: `.scalar-api-references-footer { display: none !important; }`,
          fetch: (input, init) =>
            fetch(input, { ...init, credentials: "include" }),
        }}
      />
    </div>
  );
}
