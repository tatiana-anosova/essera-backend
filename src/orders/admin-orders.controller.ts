import {
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { OrderStatus, UserRole } from '@prisma/client';
import { BlankAsUnsetPipe } from '../common/blank-as-unset.pipe';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OrdersService } from './orders.service';
import { AdminOrderResponseDto, AdminOrderSummaryResponseDto } from './dto';

@ApiTags('admin/orders')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({
    summary: 'List the orders',
    description:
      'Newest first, and unpaginated — the admin app sorts and paginates the list it is given. ' +
      '`status` is the payment state of the order: fulfilment is not modelled yet.',
  })
  @ApiQuery({ name: 'status', enum: OrderStatus, required: false })
  @ApiQuery({
    name: 'search',
    required: false,
    description:
      'Matches the email or the shipping first or last name, case-insensitively.',
  })
  @ApiOkResponse({ type: AdminOrderSummaryResponseDto, isArray: true })
  @ApiBadRequestResponse({ description: 'Unknown `status`' })
  @Get()
  findAll(
    @Query(
      'status',
      new BlankAsUnsetPipe(),
      new ParseEnumPipe(OrderStatus, { optional: true }),
    )
    status?: OrderStatus,
    @Query('search') search?: string,
  ) {
    return this.ordersService.findAllForAdmin(status, search);
  }

  @ApiOperation({
    summary: 'Read an order with its purchased lines',
    description:
      'The lines are the snapshot taken at checkout, not the current catalogue data.',
  })
  @ApiOkResponse({ type: AdminOrderResponseDto })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOneForAdmin(id);
  }
}
