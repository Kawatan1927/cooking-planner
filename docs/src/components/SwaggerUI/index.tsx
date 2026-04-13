import React from "react";
import BrowserOnly from "@docusaurus/BrowserOnly";
import "swagger-ui-react/swagger-ui.css";

interface Props {
  url?: string;
  spec?: Record<string, unknown>;
}

/**
 * Swagger UI React ラッパーコンポーネント
 *
 * 使い方（MDX ファイル内）:
 * ```mdx
 * import SwaggerUI from '@site/src/components/SwaggerUI';
 *
 * <SwaggerUI url="/openapi.yaml" />
 * ```
 */
export default function SwaggerUI({ url, spec }: Props): JSX.Element {
  return (
    <BrowserOnly fallback={<div>Swagger UI を読み込み中...</div>}>
      {() => {
        const SwaggerUIReact = require("swagger-ui-react")
          .default as typeof import("swagger-ui-react").default;

        return <SwaggerUIReact url={url} spec={spec} />;
      }}
    </BrowserOnly>
  );
}
