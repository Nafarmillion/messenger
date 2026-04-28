import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Headers,
  UseGuards,
  Res,
  Req,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginWithEmailDto, LoginWithPhoneDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { getCookieConfig, getClearCookieConfig } from './auth.cookie';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login/email')
  @HttpCode(HttpStatus.OK)
  async loginWithEmail(
    @Res({ passthrough: true }) res: Response,
    @Body() dto: LoginWithEmailDto,
    @Headers('x-device-info') deviceInfo?: string,
  ) {
    const tokens = await this.authService.loginWithEmail(dto, deviceInfo);

    // Set tokens as HttpOnly cookies
    const { accessTokenCookie, refreshTokenCookie } = getCookieConfig(tokens.accessToken, tokens.refreshToken);
    res.setHeader('Set-Cookie', [accessTokenCookie, refreshTokenCookie]);

    console.log('Login cookies set:', accessTokenCookie.substring(0, 50) + '...');

    // Return access token only for WebSocket connection (not for storage)
    return { success: true, accessToken: tokens.accessToken };
  }

  @Post('login/phone')
  @HttpCode(HttpStatus.OK)
  async loginWithPhone(
    @Res({ passthrough: true }) res: Response,
    @Body() dto: LoginWithPhoneDto,
    @Headers('x-device-info') deviceInfo?: string,
  ) {
    const tokens = await this.authService.loginWithPhone(dto, deviceInfo);

    // Set tokens as HttpOnly cookies
    const { accessTokenCookie, refreshTokenCookie } = getCookieConfig(tokens.accessToken, tokens.refreshToken);
    res.setHeader('Set-Cookie', [accessTokenCookie, refreshTokenCookie]);

    // Return access token only for WebSocket connection (not for storage)
    return { success: true, accessToken: tokens.accessToken };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
    @Headers('x-device-info') deviceInfo?: string,
  ) {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return { success: false };
    }

    const tokens = await this.authService.refreshTokens(refreshToken, deviceInfo);

    // Set new tokens as HttpOnly cookies
    const { accessTokenCookie, refreshTokenCookie } = getCookieConfig(tokens.accessToken, tokens.refreshToken);
    res.setHeader('Set-Cookie', [accessTokenCookie, refreshTokenCookie]);

    return { success: true };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
    @CurrentUser() user: any,
  ) {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    // Clear cookies
    const clearCookies = getClearCookieConfig();
    res.setHeader('Set-Cookie', clearCookies);

    return { success: true };
  }

  @Post('logout/all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logoutAllDevices(
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: any,
  ) {
    await this.authService.logoutAllDevices(user.id);

    // Clear cookies
    const clearCookies = getClearCookieConfig();
    res.setHeader('Set-Cookie', clearCookies);

    return { success: true };
  }
}
