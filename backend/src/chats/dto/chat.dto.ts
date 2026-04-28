import { IsString, IsBoolean, IsOptional, IsArray, IsEnum } from 'class-validator';
import { ChatRole } from '../../common/constants';

export class CreateChatDto {
  @IsBoolean()
  @IsOptional()
  isGroup?: boolean;

  @IsString()
  @IsOptional()
  name?: string;

  @IsArray()
  @IsOptional()
  memberIds?: string[];
}

export class AddMemberDto {
  @IsString()
  userId: string;

  @IsEnum(ChatRole)
  @IsOptional()
  role?: ChatRole;
}

export class UpdateGroupDto {
  @IsString()
  @IsOptional()
  name?: string;
}

export class UpdateMemberRoleDto {
  @IsEnum(ChatRole)
  role: ChatRole;
}
