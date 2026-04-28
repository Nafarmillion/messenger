import { IsString, IsOptional, IsBoolean, MinLength, MaxLength, Matches, IsUUID } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(50)
  firstName?: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(50)
  lastName?: string;

  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain letters, numbers, and underscores' })
  username?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10000)
  avatarUrl?: string;
}

export class UpdateAvatarDto {
  @IsString()
  avatarUrl: string;
}

export class UpdateSettingsDto {
  @IsBoolean()
  @IsOptional()
  settingShowStatus?: boolean;

  @IsBoolean()
  @IsOptional()
  settingShowLastSeen?: boolean;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class BlockUserDto {
  @IsString()
  @IsUUID()
  userId: string;
}
