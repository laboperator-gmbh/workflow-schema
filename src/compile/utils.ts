import fs from 'fs';
import path from 'path';

import { isPlainObject, last, startCase } from 'lodash';
import yaml from 'yaml';

// Schemas are traversed generically, so nested values stay `unknown` until a
// type guard narrows them.
export type Schema = Record<string, unknown>;

// e.g. '#/definitions/flow/loop' => 'definitions.flow.loop'
// e.g. 'definitions/flow/loop.yml' => 'definitions.flow.loop'
export const getPropertyPath = (pathname: string) =>
  pathname
    .replace('#/', '')
    .replace(/\.\w+$/, '')
    .split('/')
    .join('.');

export const parseSchema = (contents: string) => yaml.parse(contents) as Schema;

export const readFile = (filename: string) => {
  return parseSchema(
    fs.readFileSync(path.join(__dirname, `../schemata/${filename}`), 'utf8'),
  );
};

export const writeFile = (schema: Schema, name: string) => {
  const filename = name.replace('yml', 'json');
  const target = path.join(__dirname, `../${filename}`);

  fs.writeFileSync(target, JSON.stringify(schema, null, 2));
};

/**
 * Returns a string with a markdown link to a schema's documentation.
 */
export const prepareLink = (pathname: string) => {
  const urlPath = pathname.replace('.yml', '');
  const schemaName = startCase(last(urlPath.split('/')));
  const link = `\n\nSee more: [${schemaName} Schema](https://schema.laboperator.com/schemas/${urlPath}) `;

  return link;
};

export const forEachDeep = (
  obj: Schema,
  cb: (key: string, value: unknown) => void,
) => {
  // The `obj` param can be an array for nested schemas, e.g. `allOf` field,
  // but we for..in iterate over it anyway until it breaks 🙃
  for (const key in obj) {
    const value = obj[key];

    if (isPlainObject(value) || Array.isArray(value)) {
      forEachDeep(value as Schema, cb);
    } else {
      cb(key, value);
    }
  }
};

/**
 * On hover documentation is based on the standard `description` field. In order
 * to provide rich text formatting within VS Code we can add a custom field.
 *
 * https://code.visualstudio.com/docs/languages/json#_use-rich-formatting-in-hovers
 */
export const addMarkdownDescription = (pathname: string, obj: Schema) => {
  // The `obj` param can be an array for nested schemas, e.g. `allOf` field,
  // but we for..in iterate over it anyway until it breaks 🙃
  for (const key in obj) {
    const value = obj[key];

    if (key === 'description' && typeof value === 'string') {
      const parsedDescription = value
        .replace(/\]\(\/schemas/, '](https://schema.laboperator.com/schemas')
        // In nested code blocks spaces are sometimes rendered as their HTML
        // entity string value of `&emsp`. To fix that we replace them with
        // the invisible U+2003 unicode character.
        .replace(/ {2}/g, '  ')
        // Adding language identifiers interferes with syntax highlighting.
        .replace(/```yml/g, '```');
      // For nested properties this will link to the parent schema.
      const link = prepareLink(pathname);

      // eslint-disable-next-line no-param-reassign
      obj.markdownDescription = parsedDescription + link;
    } else if (isPlainObject(value) || Array.isArray(value)) {
      addMarkdownDescription(pathname, value as Schema);
    }
  }
};
