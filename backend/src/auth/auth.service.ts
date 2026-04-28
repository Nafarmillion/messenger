import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginWithEmailDto, LoginWithPhoneDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, JWT_ACCESS_EXPIRATION, JWT_REFRESH_EXPIRATION } from '../common/constants';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    // Validate that at least one contact method is provided
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Either email or phone must be provided');
    }

    // Check if username is taken
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    // Check if email is taken
    if (dto.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    // Check if phone is taken
    if (dto.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });

      if (existingPhone) {
        throw new ConflictException('Phone number already exists');
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        settingShowStatus: true,
        settingShowLastSeen: true,
        createdAt: true,
      },
    });

    return user;
  }

  async loginWithEmail(dto: LoginWithEmailDto, deviceInfo?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user.id, deviceInfo);
  }

  async loginWithPhone(dto: LoginWithPhoneDto, deviceInfo?: string) {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user.id, deviceInfo);
  }

  async validateUserWithEmail(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return null;
    }

    return { id: user.id, username: user.username, email: user.email };
  }

  async refreshTokens(refreshToken: string, deviceInfo?: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>(JWT_REFRESH_SECRET),
      });

      const sessionId = payload.sessionId as string;

      // Find the session
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        include: { user: true },
      });

      if (!session) {
        throw new UnauthorizedException('Session not found');
      }

      if (session.expiresAt < new Date()) {
        throw new UnauthorizedException('Session expired');
      }

      if (session.tokenHash !== await this.hashToken(refreshToken)) {
        throw new UnauthorizedException('Invalid token');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(session.userId, deviceInfo);
      
      // Delete old session after successful rotation to prevent DB bloat
      await this.prisma.session.delete({
        where: { id: sessionId },
      });

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>(JWT_REFRESH_SECRET),
      });

      const sessionId = payload.sessionId as string;

      await this.prisma.session.delete({
        where: { id: sessionId },
      });

      return true;
    } catch (error) {
      return false;
    }
  }

  async logoutAllDevices(userId: string) {
    await this.prisma.session.deleteMany({
      where: { userId },
    });

    return true;
  }

  private async generateTokens(userId: string, deviceInfo?: string) {
    const accessSecret = this.configService.get<string>(JWT_ACCESS_SECRET);
    const refreshSecret = this.configService.get<string>(JWT_REFRESH_SECRET);

    if (!accessSecret || !refreshSecret) {
      throw new Error('FATAL: JWT secrets are not configured in the environment');
    }

    const accessExpiration = this.configService.get<string>('JWT_ACCESS_EXPIRATION') || '15m';
    const refreshExpiration = this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d';

    const sessionId = uuidv4();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({ sub: userId }, {
        secret: accessSecret,
        expiresIn: accessExpiration as any,
      }),
      this.jwtService.signAsync({ sub: userId, sessionId }, {
        secret: refreshSecret,
        expiresIn: refreshExpiration as any,
      }),
    ]);
    const tokenHash = await this.hashToken(refreshToken);
    const expiresAt = this.jwtService.decode(refreshToken) as any;

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId,
        tokenHash,
        expiresAt: new Date(expiresAt.exp * 1000),
        deviceInfo: deviceInfo || null,
      },
    });

    return { accessToken, refreshToken };
  }

  private async hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, 10);
  }
}
