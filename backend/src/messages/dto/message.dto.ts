import { IsString, IsOptional, IsUUID, IsBoolean } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  @IsUUID()
  replyToId?: string;
}

export class UpdateMessageDto {
  @IsString()
  @IsOptional()
  content?: string;

  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;
}

export class MessageQueryDto {
  @IsString()
  @IsOptional()
  before?: string;

  @IsString()
  @IsOptional()
  after?: string;

  limit?: number;
}
