import { useEffect } from "react";

declare var SwaggerUIBundle: any; // imported via the layout

export const SwaggerCard = () => {
  useEffect(() => {
    SwaggerUIBundle({
      dom_id: "#swaggerContainer",
      url: `${process.env.NEXT_PUBLIC_API_URL}/swagger`,
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.SwaggerUIStandalonePreset,
      ],
      deepLinking: true,
      docExpansion: "none",
      filter: true,
    });
  }, []);

  return <div id="swaggerContainer" data-testid="swagger-container" />;
};
