import { SetMetadata } from '@nestjs/common';
import { ChatRole } from '../constants';

export const CHAT_ROLES_KEY = 'chatRoles';
export const ChatRoles = (...roles: ChatRole[]) => SetMetadata(CHAT_ROLES_KEY, roles);
