import base from '@medicos/config/eslint';
export default [
  ...base,
  // Nest injects by constructor parameter type; type-only imports would break DI.
  { rules: { '@typescript-eslint/consistent-type-imports': 'off' } },
];
