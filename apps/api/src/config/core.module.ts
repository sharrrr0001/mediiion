import { Global, Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient, createFieldCrypto, type FieldCrypto } from '@medicos/db';
import { ENV, loadEnv, type Env } from './env';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}

export const CRYPTO = Symbol('CRYPTO');
export type { FieldCrypto };

/** Global singletons: validated env, Prisma client, field crypto. */
@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: (): Env => loadEnv() },
    PrismaService,
    {
      provide: CRYPTO,
      inject: [ENV],
      useFactory: (env: Env) => createFieldCrypto(env.FIELD_ENCRYPTION_KEY, env.BLIND_INDEX_KEY),
    },
  ],
  exports: [ENV, PrismaService, CRYPTO],
})
export class CoreModule {}
