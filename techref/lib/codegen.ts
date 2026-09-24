import { OperationSpec } from '@/types/techref-spec';

export type CodeLanguage = 'curl' | 'python' | 'javascript' | 'rust' | 'go';

export interface SnippetContext {
  operation: OperationSpec;
  baseUrl: string;
  pathParams: Record<string, string>;
  queryParams: Record<string, string>;
  headers: Record<string, string>;
  bodyJson: string;
}

export function generateSnippet(lang: CodeLanguage, ctx: SnippetContext): string {
  let resolvedPath = ctx.operation.path;
  for (const [key, val] of Object.entries(ctx.pathParams)) {
    const encoded = encodeURIComponent(val.trim() !== '' ? val : `{${key}}`);
    resolvedPath = resolvedPath.replace(`{${key}}`, encoded);
  }

  const queryPairs = Object.entries(ctx.queryParams)
    .filter(([, v]) => v.trim() !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);

  const queryString = queryPairs.length > 0 ? `?${queryPairs.join('&')}` : '';
  const cleanBase = ctx.baseUrl.replace(/\/$/, '');
  const fullUrl = `${cleanBase}${resolvedPath}${queryString}`;
  const method = ctx.operation.method.toUpperCase();
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method) && ctx.bodyJson.trim() !== '';

  switch (lang) {
    case 'curl': {
      let cmd = `curl -X ${method} "${fullUrl}"`;
      for (const [hKey, hVal] of Object.entries(ctx.headers)) {
        if (hVal.trim()) cmd += ` \\\n  -H "${hKey}: ${hVal}"`;
      }
      if (hasBody) {
        if (!ctx.headers['Content-Type']) {
          cmd += ` \\\n  -H "Content-Type: application/json"`;
        }
        cmd += ` \\\n  -d '${ctx.bodyJson.replace(/'/g, "'\\''")}'`;
      }
      return cmd;
    }

    case 'python': {
      const mergedHeaders = { ...ctx.headers };
      if (hasBody && !mergedHeaders['Content-Type']) {
        mergedHeaders['Content-Type'] = 'application/json';
      }
      const headerStr = JSON.stringify(mergedHeaders, null, 4);

      return `import requests
import json

url = "${fullUrl}"
headers = ${headerStr}
${hasBody ? `payload = json.loads('''${ctx.bodyJson}''')\n` : ''}
response = requests.${method.toLowerCase()}(
    url,
    headers=headers,
    ${hasBody ? 'json=payload,' : ''}
    timeout=30
)

print(f"Status: {response.status_code}")
print(response.json())`;
    }

    case 'javascript': {
      const mergedHeaders = { ...ctx.headers };
      if (hasBody && !mergedHeaders['Content-Type']) {
        mergedHeaders['Content-Type'] = 'application/json';
      }

      return `// Node.js 18+ or Modern Browser ES2024
const url = "${fullUrl}";
const options = {
  method: "${method}",
  headers: ${JSON.stringify(mergedHeaders, null, 2)},
  ${hasBody ? `body: JSON.stringify(${ctx.bodyJson})` : ''}
};

try {
  const response = await fetch(url, options);
  const data = await response.json();
  console.log("Status:", response.status, data);
} catch (error) {
  console.error("API Error:", error);
}`;
    }

    case 'go': {
      return `package main

import (
\t"bytes"
\t"fmt"
\t"io"
\t"net/http"
)

func main() {
\turl := "${fullUrl}"
\tvar body io.Reader
${hasBody ? `\tbody = bytes.NewBuffer([]byte(\`${ctx.bodyJson}\`))\n` : ''}
\treq, err := http.NewRequest("${method}", url, body)
\tif err != nil {
\t\tpanic(err)
\t}

${Object.entries(ctx.headers)
  .map(([k, v]) => `\treq.Header.Set("${k}", "${v}")`)
  .join('\n')}
${hasBody && !ctx.headers['Content-Type'] ? `\treq.Header.Set("Content-Type", "application/json")\n` : ''}
\tclient := &http.Client{}
\tresp, err := client.Do(req)
\tif err != nil {
\t\tpanic(err)
\t}
\tdefer resp.Body.Close()

\trespBody, _ := io.ReadAll(resp.Body)
\tfmt.Println("Status:", resp.Status)
\tfmt.Println(string(respBody))
}`;
    }

    case 'rust': {
      return `use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use std::error::Error;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let client = reqwest::Client::new();
    let url = "${fullUrl}";
    let mut headers = HeaderMap::new();

${Object.entries(ctx.headers)
  .map(
    ([k, v]) =>
      `    headers.insert(HeaderName::from_static("${k.toLowerCase()}"), HeaderValue::from_static("${v}"));`
  )
  .join('\n')}

    let req = client
        .${method.toLowerCase()}(url)
        .headers(headers)
        ${
          hasBody
            ? `.header("content-type", "application/json")\n        .body(r#"${ctx.bodyJson}"#)`
            : ''
        };

    let res = req.send().await?;
    println!("Status: {}", res.status());
    let body = res.text().await?;
    println!("Response Body: {}", body);
    Ok(())
}`;
    }
  }
}
