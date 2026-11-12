import base from '@medicos/config/eslint';
export default [...base, { files: ['evals/**'], rules: { 'no-console': 'off' } }];
