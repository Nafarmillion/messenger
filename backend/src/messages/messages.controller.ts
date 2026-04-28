import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto, UpdateMessageDto, MessageQueryDto } from './dto/message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('chats/:chatId/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Get()
  findAll(
    @Param('chatId') chatId: string,
    @CurrentUser() user: any,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('before') before?: string,
    @Query('after') after?: string,
  ) {
    const options: any = { limit };
    if (before) options.before = new Date(before);
    if (after) options.after = new Date(after);
    
    return this.messagesService.findAll(chatId, user.id, options);
  }

  @Post()
  create(
    @Param('chatId') chatId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateMessageDto,
  ) {
    return this.messagesService.create(chatId, user.id, dto);
  }

  @Get(':id')
  findOne(
    @Param('chatId') chatId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.messagesService.findOne(id, user.id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.messagesService.update(id, user.id, dto);
  }

  @Delete(':id')
  delete(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.messagesService.delete(id, user.id);
  }

  @Post(':id/pin')
  togglePin(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.messagesService.togglePin(id, user.id);
  }
}
