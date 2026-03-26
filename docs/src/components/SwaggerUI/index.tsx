import React from 'react';
import SwaggerUIReact from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

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
  return <SwaggerUIReact url={url} spec={spec} />;
}
