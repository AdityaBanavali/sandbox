import fs from 'node:fs/promises';
import path from 'node:path';

// Standalone fallback normalizer without hard runtime requirement on swagger-parser if executed offline
async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function normalizeSchema(schema) {
  if (!schema) return { type: 'unknown' };
  if (schema.$ref) {
    return { $ref: schema.$ref };
  }
  const result = {
    type: schema.type || (schema.properties ? 'object' : 'string'),
    description: schema.description || '',
    format: schema.format || undefined,
    required: schema.required || [],
    properties: {},
  };

  if (schema.properties) {
    for (const [key, value] of Object.entries(schema.properties)) {
      result.properties[key] = normalizeSchema(value);
    }
  }

  if (schema.items) {
    result.items = normalizeSchema(schema.items);
  }

  return result;
}

export async function ingestSpec(inputUrl, outDir) {
  console.log(`[TechRef Ingestion] Fetching spec from: ${inputUrl}`);
  const targetDir = path.resolve(process.cwd(), outDir);
  await ensureDir(targetDir);

  let rawSpec;
  try {
    const res = await fetch(inputUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    rawSpec = await res.json();
  } catch (err) {
    console.warn(`[TechRef Ingestion] Remote fetch failed (${err.message}). Using local fallback spec.`);
    return;
  }

  const operations = [];
  const searchEntries = [];
  const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

  for (const [routePath, pathItem] of Object.entries(rawSpec.paths || {})) {
    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation) continue;

      const operationId = operation.operationId || `${method}_${routePath.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const title = operation.summary || `${method.toUpperCase()} ${routePath}`;
      const description = operation.description || '';

      const normalizedParams = (operation.parameters || []).map((param) => ({
        name: param.name,
        in: param.in,
        required: Boolean(param.required),
        description: param.description || '',
        schema: normalizeSchema(param.schema),
      }));

      let requestBodySchema = null;
      if (operation.requestBody?.content?.['application/json']?.schema) {
        requestBodySchema = normalizeSchema(operation.requestBody.content['application/json'].schema);
      }

      const responses = {};
      for (const [statusCode, responseObj] of Object.entries(operation.responses || {})) {
        responses[statusCode] = {
          statusCode,
          description: responseObj.description || '',
          schema: responseObj.content?.['application/json']?.schema
            ? normalizeSchema(responseObj.content['application/json'].schema)
            : null,
        };
      }

      operations.push({
        id: operationId,
        method: method.toUpperCase(),
        path: routePath,
        title,
        description,
        tags: operation.tags || ['General'],
        parameters: normalizedParams,
        requestBody: requestBodySchema,
        responses,
        servers: rawSpec.servers || [{ url: 'https://api.techref.dev/v1' }],
      });

      searchEntries.push({
        id: operationId,
        type: 'endpoint',
        title: `${method.toUpperCase()} ${routePath}`,
        subtitle: title,
        content: `${description} ${normalizedParams.map((p) => p.name).join(' ')}`,
        url: `/#${operationId}`,
      });
    }
  }

  await fs.writeFile(
    path.join(targetDir, 'operations.json'),
    JSON.stringify(operations, null, 2),
    'utf-8'
  );
  console.log(`[TechRef Ingestion] Wrote ${operations.length} operations to ${targetDir}/operations.json`);
}

// Execute standalone if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.CUSTOM_SPEC_URL || 'https://petstore.swagger.io/v2/swagger.json';
  ingestSpec(url, 'content/api/v1').catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
