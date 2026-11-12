import { dermatologyV1 } from './dermatology';
import { generalMedicineV1 } from './general-medicine';
import { IntakeTemplate } from './schema';

export * from './schema';

/** Built-in v1 templates. They are seeded into the DB; the DB copy is what sessions use. */
export const BUILTIN_TEMPLATES: IntakeTemplate[] = [generalMedicineV1, dermatologyV1].map((t) => IntakeTemplate.parse(t));

export function builtinTemplate(key: string): IntakeTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.key === key);
}
