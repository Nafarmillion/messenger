import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ChatsService } from './chats.service';
import { CreateChatDto, AddMemberDto, UpdateGroupDto, UpdateMemberRoleDto } from './dto/chat.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ChatRoles } from '../common/decorators/chat-roles.decorator';
import { ChatRole } from '../common/constants';

@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatsController {
  constructor(private chatsService: ChatsService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.chatsService.findAll(user.id);
  }

  @Get(':id')
  findById(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.chatsService.findById(id, user.id);
  }

  @Post()
  create(
    @CurrentUser() user: any,
    @Body() dto: CreateChatDto,
  ) {
    return this.chatsService.create(user.id, dto);
  }

  @Put(':id')
  @ChatRoles(ChatRole.OWNER, ChatRole.ADMIN, ChatRole.MODERATOR)
  updateGroup(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.chatsService.updateGroup(id, user.id, dto);
  }

  @Post(':id/members')
  addMember(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: AddMemberDto,
  ) {
    return this.chatsService.addMember(id, user.id, dto);
  }

  @Delete(':id/members/:memberId')
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: any,
  ) {
    return this.chatsService.removeMember(id, user.id, memberId);
  }

  @Post(':id/leave')
  leaveGroup(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.chatsService.leaveGroup(id, user.id);
  }

  @Put(':id/members/:memberId/role')
  @ChatRoles(ChatRole.OWNER, ChatRole.ADMIN)
  updateMemberRole(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.chatsService.updateMemberRole(id, user.id, memberId, dto.role);
  }

  @Post(':id/transfer/:newOwnerId')
  @ChatRoles(ChatRole.OWNER)
  transferOwnership(
    @Param('id') id: string,
    @Param('newOwnerId') newOwnerId: string,
    @CurrentUser() user: any,
  ) {
    return this.chatsService.transferOwnership(id, user.id, newOwnerId);
  }

  @Delete(':id')
  @ChatRoles(ChatRole.OWNER)
  delete(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.chatsService.delete(id, user.id);
  }
}
