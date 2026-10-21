export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export interface SchemaNode {
  type: string;
  description?: string;
  format?: string;
  required?: string[];
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  enum?: (string | number)[];
  example?: unknown;
  $ref?: string;
}

export interface ApiParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  required: boolean;
  description: string;
  schema: SchemaNode;
}

export interface ApiResponseSpec {
  statusCode: string;
  description: string;
  schema: SchemaNode | null;
  example?: unknown;
}

export interface OperationSpec {
  id: string;
  method: HttpMethod;
  path: string;
  title: string;
  description: string;
  tags: string[];
  parameters: ApiParameter[];
  requestBody: SchemaNode | null;
  responses: Record<string, ApiResponseSpec>;
  servers: Array<{ url: string; description?: string }>;
}

export interface SearchDocEntry {
  id: string;
  type: 'guide' | 'endpoint' | 'sdk' | 'changelog';
  title: string;
  subtitle: string;
  content: string;
  url: string;
  tags?: string[];
}

export interface GuideDoc {
  slug: string;
  title: string;
  description: string;
  category: string;
  readTime: string;
  headings: { id: string; text: string; level: number }[];
  content: string;
}
