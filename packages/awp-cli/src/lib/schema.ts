import { readFile } from "node:fs/promises";
import { SCHEMA_MAP, getSchemaPath } from "@awp/core";

// Dynamic import to handle CJS/ESM interop
let ajvInstance: any = null;
const schemaCache = new Map<string, object>();

async function getAjv(): Promise<any> {
  if (!ajvInstance) {
    const AjvModule = await import("ajv");
    const AjvFormatsModule = await import("ajv-formats");
    const Ajv = AjvModule.default?.default ?? AjvModule.default ?? AjvModule;
    const addFormats =
      AjvFormatsModule.default?.default ??
      AjvFormatsModule.default ??
      AjvFormatsModule;
    ajvInstance = new Ajv({ allErrors: true, strict: false });
    addFormats(ajvInstance);
  }
  return ajvInstance;
}

/**
 * Load a schema file from @awp/core's bundled schemas
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

    const errors = (validate.errors || []).map(
      (e: any) => `${e.instancePath || "/"}: ${e.message}`
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
export async function validateManifest(
  data: Record<string, unknown>
): Promise<ValidationResult> {
  try {
    const schema = await loadSchema("workspace.schema.json");
    const ajv = await getAjv();
    const validate = ajv.compile(schema);
    const valid = validate(data);

    if (valid) {
      return { valid: true, errors: [] };
    }

    const errors = (validate.errors || []).map(
      (e: any) => `${e.instancePath || "/"}: ${e.message}`
    );
    return { valid: false, errors };
  } catch (err) {
    return {
      valid: false,
      errors: [`Schema loading error: ${err}`],
    };
  }
}
