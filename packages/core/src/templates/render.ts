import { TEMPLATE_VARIABLES } from '@app/types';

export interface TemplateVars {
  studentName: string;
  className: string;
  installmentNumber: number | string;
  amount: string;
  dueDate: string;
  parentName: string;
}

/**
 * Replaces `{variable}` tokens with their values. Only the whitelisted
 * TEMPLATE_VARIABLES are substituted; any other braces are left untouched so a
 * stray `{}` never blows up rendering.
 */
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    if ((TEMPLATE_VARIABLES as readonly string[]).includes(key)) {
      const value = (vars as unknown as Record<string, unknown>)[key];
      return value === undefined || value === null ? '' : String(value);
    }
    return match;
  });
}

/** Lists the variables referenced in a template (for editor validation/help). */
export function usedVariables(template: string): string[] {
  const found = new Set<string>();
  for (const m of template.matchAll(/\{(\w+)\}/g)) {
    if ((TEMPLATE_VARIABLES as readonly string[]).includes(m[1])) found.add(m[1]);
  }
  return [...found];
}
