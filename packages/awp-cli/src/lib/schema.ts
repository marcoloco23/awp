import { readFile } from "node:fs/promises";
import { SCHEMA_MAP, getSchemaPath } from "@agent-workspace/core";

/** AJV error object shape */
interface AjvError {
  instancePath: string;
  message?: string;
}

/** AJV validate function with errors property */
interface ValidateFunction {
  (data: unknown): boolean;
  errors?: AjvError[] | null;
}

/** AJV instance interface */
interface AjvInstance {
  compile: (schema: object) => ValidateFunction;
}

let ajvInstance: AjvInstance | null = null;
const schemaCache = new Map<string, object>();

async function getAjv(): Promise<AjvInstance> {
  if (!ajvInstance) {
    const AjvModule = await import("ajv");
    const AjvFormatsModule = await import("ajv-formats");

    // Handle ESM/CJS interop
    const AjvClass =
      (AjvModule as { default?: { default?: unknown } }).default?.default ??
      (AjvModule as { default?: unknown }).default ??
      AjvModule;
    const addFormats =
      (AjvFormatsModule as { default?: { default?: unknown } }).default?.default ??
      (AjvFormatsModule as { default?: unknown }).default ??
      AjvFormatsModule;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ajvInstance = new (AjvClass as any)({ allErrors: true, strict: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (addFormats as any)(ajvInstance);
  }
  return ajvInstance as AjvInstance;
}

/**
 * Load a schema file from @agent-workspace/core's bundled schemas
 */
async function loadSchema(schemaFileName: string): Promise<object> {
  if (schemaCache.has(schemaFileName)) {
    return schemaCache.get(schemaFileName)!;
  }

  const schemaPath = getSchemaPath(schemaFileName);
  const raw = await readFile(schemaPath, "utf-8");
  const schema = JSON.parse(raw);
  // Strip $schema and $id fields — Ajv doesn't handle draft-2020-12 by default
  delete schema.$schema;
  delete schema.$id;
  schemaCache.set(schemaFileName, schema);
  return schema;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate frontmatter against its schema
 */
export async function validateFrontmatter(
  type: string,
  data: Record<string, unknown>
): Promise<ValidationResult> {
  const schemaFileName = SCHEMA_MAP[type];
  if (!schemaFileName) {
    return { valid: true, errors: [] };
  }

  try {
    const schema = await loadSchema(schemaFileName);
    const ajv = await getAjv();
    const validate = ajv.compile(schema);
    const valid = validate(data);

    if (valid) {
      return { valid: true, errors: [] };
    }

    const errors = (validate.errors ?? []).map(
      (e: AjvError) => `${e.instancePath || "/"}: ${e.message}`
    );
    return { valid: false, errors };
  } catch (err) {
    return {
      valid: false,
      errors: [`Schema loading error: ${err}`],
    };
  }
}

/**
 * Validate workspace manifest against its schema
 */
export async function validateManifest(data: Record<string, unknown>): Promise<ValidationResult> {
  try {
    const schema = await loadSchema("workspace.schema.json");
    const ajv = await getAjv();
    const validate = ajv.compile(schema);
    const valid = validate(data);

    if (valid) {
      return { valid: true, errors: [] };
    }

    const errors = (validate.errors ?? []).map(
      (e: AjvError) => `${e.instancePath || "/"}: ${e.message}`
    );
    return { valid: false, errors };
  } catch (err) {
    return {
      valid: false,
      errors: [`Schema loading error: ${err}`],
    };
  }
}
