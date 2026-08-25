import {
  Controller,
  Get,
  ParseEnumPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { BlankAsUnsetPipe } from '../common/blank-as-unset.pipe';
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
      'Newest first, and unpaginated — the admin app sorts and paginates the list it is given.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description:
      'Matches the email, first name or last name, case-insensitively.',
  })
  @ApiQuery({ name: 'role', enum: UserRole, required: false })
  @ApiOkResponse({ type: UserProfileResponseDto, isArray: true })
  @ApiBadRequestResponse({ description: 'Unknown `role`' })
  @Get()
  findAll(
    @Query('search') search?: string,
    @Query(
      'role',
      new BlankAsUnsetPipe(),
      new ParseEnumPipe(UserRole, { optional: true }),
    )
    role?: UserRole,
  ) {
    return this.usersService.findAllForAdmin(search, role);
  }
}
