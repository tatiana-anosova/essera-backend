import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsersService } from './users.service';
import { UserProfileResponseDto } from './dto';

@ApiTags('admin/users')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: 'List the registered users',
    description:
      'Profiles only: the Supabase authentication record behind a user is never exposed. ' +
      'Newest first, and unpaginated — the admin app searches and sorts the list it is given.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description:
      'Matches the email, first name or last name, case-insensitively.',
  })
  @ApiOkResponse({ type: UserProfileResponseDto, isArray: true })
  @Get()
  findAll(@Query('search') search?: string) {
    return this.usersService.findAllForAdmin(search);
  }
}
