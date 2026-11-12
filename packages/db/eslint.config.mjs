import base from '@medicos/config/eslint';
export default [...base, { files: ['prisma/**'], rules: { 'no-console': 'off' } }];
