import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ProductStatus, UserRole } from '@prisma/client';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ProductsService } from './products.service';
import { CreateProductDto, ProductResponseDto, UpdateProductDto } from './dto';

@ApiTags('admin/products')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @ApiOperation({
    summary: 'List products of every status',
    description:
      'Unlike `GET /products`, drafts and archived products are included.',
  })
  @ApiQuery({ name: 'status', enum: ProductStatus, required: false })
  @ApiOkResponse({ type: ProductResponseDto, isArray: true })
  @Get()
  findAll(
    @Query('status', new ParseEnumPipe(ProductStatus, { optional: true }))
    status?: ProductStatus,
  ) {
    return this.productsService.findAllForAdmin(status);
  }

  @ApiOperation({ summary: 'Read a product of any status' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOneForAdmin(id);
  }

  @ApiOperation({
    summary: 'Create a product',
    description:
      'The product is always created as `DRAFT`; the status cannot be chosen.',
  })
  @ApiCreatedResponse({ type: ProductResponseDto })
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @ApiOperation({
    summary: 'Update product data',
    description:
      'The status is not updated here; use publish, archive or restore.',
  })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @ApiOperation({
    summary: 'Permanently delete a draft product',
    description: 'Published and archived products are kept; archive instead.',
  })
  @ApiOkResponse({ description: 'The deleted product' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiConflictResponse({
    description: 'Only draft products can be permanently deleted',
  })
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.remove(id);
  }

  @ApiOperation({ summary: 'Publish a draft product (DRAFT → ACTIVE)' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiConflictResponse({ description: 'Only draft products can be published' })
  @HttpCode(200)
  @Post(':id/publish')
  publish(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.publish(id);
  }

  @ApiOperation({ summary: 'Archive a published product (ACTIVE → ARCHIVED)' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiConflictResponse({ description: 'Only active products can be archived' })
  @HttpCode(200)
  @Post(':id/archive')
  archive(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.archive(id);
  }

  @ApiOperation({ summary: 'Restore an archived product (ARCHIVED → ACTIVE)' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiConflictResponse({
    description: 'Only archived products can be restored',
  })
  @HttpCode(200)
  @Post(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.restore(id);
  }
}
