/**
 * Generates docs/API.md from docs/openapi.yaml.
 *
 * Usage: npx tsx scripts/generate-api-docs.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'yaml';

const spec = parse(readFileSync('docs/openapi.yaml', 'utf-8'));

const lines: string[] = [
	'<!-- AUTO-GENERATED from docs/openapi.yaml — do not edit manually -->',
	'<!-- Run: pnpm docs:api -->',
	'',
	`# ${spec.info.title}`,
	'',
	spec.info.description,
	'',
	`Base URL: \`${spec.servers[0].url}\``,
	'',
	'All endpoints require a `session` cookie (set by login) except where noted.',
	''
];

// Group paths by tag
const groups = new Map<string, { method: string; path: string; op: Record<string, unknown> }[]>();

for (const [path, methods] of Object.entries(spec.paths) as [string, Record<string, unknown>][]) {
	const pathParams = (methods.parameters as unknown[]) || [];
	for (const [method, op] of Object.entries(methods)) {
		if (method === 'parameters') continue;
		const operation = op as Record<string, unknown>;
		const tag = ((operation.tags as string[]) || ['Other'])[0];
		if (!groups.has(tag)) groups.set(tag, []);
		groups.get(tag)!.push({ method: method.toUpperCase(), path, op: { ...operation, _pathParams: pathParams } });
	}
}

for (const [tag, endpoints] of groups) {
	lines.push(`## ${tag}`, '');
	for (const { method, path, op } of endpoints) {
		lines.push(`### \`${method} ${path}\``, '');
		lines.push(String(op.summary || ''), '');
		if (op.description) lines.push(String(op.description), '');

		if ((op.security as unknown[])?.length === 0) {
			lines.push('> No authentication required.', '');
		}

		// Parameters
		const allParams = [...((op._pathParams as unknown[]) || []), ...((op.parameters as unknown[]) || [])];
		if (allParams.length > 0) {
			lines.push('**Parameters:**', '');
			lines.push('| Name | In | Type | Required | Description |');
			lines.push('|------|----|------|----------|-------------|');
			for (const p of allParams as Record<string, unknown>[]) {
				const schema = p.schema as Record<string, unknown> | undefined;
				const type = schema?.type || '';
				const enumVals = schema?.enum as string[] | undefined;
				let desc = String(p.description || schema?.description || '');
				if (enumVals) desc += ` (${enumVals.join(', ')})`;
				if (schema?.default !== undefined) desc += ` — default: \`${schema.default}\``;
				lines.push(`| \`${p.name}\` | ${p.in} | ${type} | ${p.required ? 'yes' : 'no'} | ${desc} |`);
			}
			lines.push('');
		}

		// Request body
		const body = op.requestBody as Record<string, unknown> | undefined;
		if (body) {
			const content = body.content as Record<string, Record<string, unknown>>;
			const contentType = Object.keys(content)[0];
			const schema = content[contentType]?.schema as Record<string, unknown> | undefined;

			if (contentType === 'multipart/form-data') {
				lines.push('**Request:** `multipart/form-data` with `file` field.', '');
			} else if (schema) {
				const example = buildExample(schema, spec.components?.schemas as Record<string, unknown>);
				if (example) {
					lines.push('**Request:**', '', '```json', JSON.stringify(example, null, 2), '```', '');
				}
			}
		}

		// Responses
		const responses = op.responses as Record<string, Record<string, unknown>> | undefined;
		if (responses) {
			const codes = Object.keys(responses);
			const successCode = codes.find(c => c.startsWith('2')) || codes[0];
			const successResp = responses[successCode];
			lines.push(`**Response:** \`${successCode}\``, '');
			const respContent = successResp?.content as Record<string, Record<string, unknown>> | undefined;
			if (respContent) {
				const schema = Object.values(respContent)[0]?.schema as Record<string, unknown>;
				if (schema) {
					const example = buildExample(schema, spec.components?.schemas as Record<string, unknown>);
					if (example) {
						lines.push('```json', JSON.stringify(example, null, 2), '```', '');
					}
				}
			}

			// Error codes
			const errors = codes.filter(c => !c.startsWith('2'));
			if (errors.length > 0) {
				lines.push(`**Errors:** ${errors.map(c => `\`${c}\` ${responses[c].description || ''}`).join(', ')}`, '');
			}
		}

		lines.push('---', '');
	}
}

writeFileSync('docs/API.md', lines.join('\n'));
console.log('Generated docs/API.md');

function buildExample(schema: Record<string, unknown>, schemas?: Record<string, unknown>): unknown {
	if (schema.$ref) {
		const refName = String(schema.$ref).split('/').pop()!;
		return schemas ? buildExample(schemas[refName] as Record<string, unknown>, schemas) : {};
	}

	if (schema.type === 'array') {
		const items = schema.items as Record<string, unknown>;
		if (!items) return [];
		if (items.$ref || items.properties || items.type === 'object') return [buildExample(items, schemas)];
		return [exampleValue('item', items, schemas)];
	}

	if (schema.type === 'object' || schema.properties) {
		const props = schema.properties as Record<string, Record<string, unknown>> | undefined;
		if (!props) return {};
		const obj: Record<string, unknown> = {};
		for (const [key, prop] of Object.entries(props)) {
			obj[key] = exampleValue(key, prop, schemas);
		}
		return obj;
	}

	return null;
}

function exampleValue(key: string, prop: Record<string, unknown>, schemas?: Record<string, unknown>): unknown {
	if (prop.$ref) return buildExample(prop, schemas);
	if (prop.type === 'array') return buildExample(prop, schemas);
	if (prop.type === 'object' || prop.properties) return buildExample(prop, schemas);

	const enumVals = prop.enum as string[] | undefined;
	if (enumVals) return enumVals[0];

	switch (prop.type) {
		case 'string':
			if (prop.format === 'uuid') return 'uuid';
			if (prop.format === 'date-time') return '2025-01-01T00:00:00.000Z';
			if (prop.format === 'binary') return '(binary)';
			return key;
		case 'integer':
		case 'number':
			return prop.default !== undefined ? prop.default : 1;
		case 'boolean':
			return prop.default !== undefined ? prop.default : true;
		default:
			return null;
	}
}
