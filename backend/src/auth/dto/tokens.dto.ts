import { IsString, IsOptional } from 'class-validator';

export class AuthTokensDto {
  @IsString()
  accessToken: string;

  @IsString()
  refreshToken: string;
}

export class DeviceInfoDto {
  @IsString()
  @IsOptional()
  deviceInfo?: string;
}
