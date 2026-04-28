import {
  Controller,
  Get,
  Put,
  Delete,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto, UpdateSettingsDto, ChangePasswordDto, BlockUserDto, UpdateAvatarDto } from './dto/user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @CurrentUser() user: any,
    @Query('search') search?: string,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.findAll({ search, limit: limit ? Number(limit) : undefined }, user.id);
  }

  @Get('me')
  findMe(@CurrentUser() user: any) {
    return this.usersService.findOne(user.id, user.id);
  }

  @Get(':username')
  findByUsername(
    @Param('username') username: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.findByUsername(username, user.id);
  }

  @Put('me')
  updateMe(
    @CurrentUser() user: any,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(user.id, dto);
  }

  @Post('me/avatar')
  updateAvatar(
    @CurrentUser() user: any,
    @Body() dto: UpdateAvatarDto,
  ) {
    return this.usersService.updateAvatar(user.id, dto.avatarUrl);
  }

  @Put('me/settings')
  updateSettings(
    @CurrentUser() user: any,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.usersService.updateSettings(user.id, dto);
  }

  @Put('me/password')
  changePassword(
    @CurrentUser() user: any,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(user.id, dto);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  deleteMe(@CurrentUser() user: any) {
    return this.usersService.delete(user.id);
  }

  @Post('block')
  @UseGuards(JwtAuthGuard)
  blockUser(
    @CurrentUser() user: any,
    @Body() dto: BlockUserDto,
  ) {
    return this.usersService.blockUser(user.id, dto.userId);
  }

  @Post('unblock')
  @UseGuards(JwtAuthGuard)
  unblockUser(
    @CurrentUser() user: any,
    @Body() dto: BlockUserDto,
  ) {
    return this.usersService.unblockUser(user.id, dto.userId);
  }

  @Get('blocked')
  @UseGuards(JwtAuthGuard)
  getBlockedUsers(@CurrentUser() user: any) {
    return this.usersService.getBlockedUsers(user.id);
  }
}
