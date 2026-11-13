import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Module, Param, ParseUUIDPipe, Post, Req, type RawBodyRequest } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { ApplyCoupon, Checkout } from '@medicos/shared';
import { CurrentUser, Public, Roles, type AuthUser } from '../auth/decorators';
import { AppError } from '../common/errors';
import { ZodBody, ZodPipe } from '../common/zod';
import { BillingService } from './billing.service';

@ApiTags('billing')
@Roles('doctor')
@Controller('doctor/billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  overview(@CurrentUser() user: AuthUser) {
    return this.billing.overview(user);
  }

  @Post('coupon')
  @HttpCode(HttpStatus.OK)
  @ZodBody(ApplyCoupon)
  coupon(@CurrentUser() user: AuthUser, @Body(new ZodPipe(ApplyCoupon)) body: ApplyCoupon, @Req() req: Request) {
    return this.billing.applyCoupon(user, body.code, req);
  }

  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  @ZodBody(Checkout)
  checkout(@CurrentUser() user: AuthUser, @Body(new ZodPipe(Checkout)) body: Checkout, @Req() req: Request) {
    return this.billing.checkout(user, body, req);
  }

  @Get('invoices/:id')
  invoice(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.billing.invoice(user, id);
  }
}

/** Razorpay → us. Public, but every call must carry a valid HMAC signature over the raw body. */
@ApiTags('billing')
@Public()
@SkipThrottle()
@Controller('webhooks/razorpay')
export class RazorpayWebhookController {
  constructor(private readonly billing: BillingService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handle(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature: string | undefined, @Body() body: unknown) {
    if (!this.billing.verifyWebhook(req.rawBody, signature)) throw new AppError(HttpStatus.UNAUTHORIZED, 'BAD_SIGNATURE', 'Invalid signature.');
    return this.billing.handleWebhook(body as Parameters<BillingService['handleWebhook']>[0]);
  }
}

@Module({ controllers: [BillingController, RazorpayWebhookController], providers: [BillingService] })
export class BillingModule {}
