import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  ParseIntPipe,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ProductsService } from './products.service';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  CreateProductVariantDto,
  UpdateProductVariantDto,
  CreateProductSizeDto,
  UpdateProductSizeDto,
  ProductResponseDto,
} from './dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @ApiOperation({
    summary: 'List the products on sale',
    description:
      'Only `ACTIVE` products; drafts and archived products are admin-only.',
  })
  @ApiOkResponse({ type: ProductResponseDto, isArray: true })
  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @ApiOperation({ summary: 'Read a product on sale by id' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'No `ACTIVE` product with that id' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @ApiOperation({ summary: 'Read a product on sale by slug' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'No `ACTIVE` product with that slug' })
  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  // VARIANTS
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(201)
  @Post(':productId/variants')
  async addVariant(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: CreateProductVariantDto,
  ) {
    return this.productsService.addVariant(productId, dto);
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put('/variants/:variantId')
  async updateVariant(
    @Param('variantId', ParseIntPipe) variantId: number,
    @Body() dto: UpdateProductVariantDto,
  ) {
    return this.productsService.updateVariant(variantId, dto);
  }

  // SIZES
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('/variants/:variantId/sizes')
  async addSize(
    @Param('variantId', ParseIntPipe) variantId: number,
    @Body() dto: CreateProductSizeDto,
  ) {
    return this.productsService.addSize(variantId, dto);
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put('/sizes/:sizeId')
  async updateSize(
    @Param('sizeId', ParseIntPipe) sizeId: number,
    @Body() dto: UpdateProductSizeDto,
  ) {
    return this.productsService.updateSize(sizeId, dto);
  }
}
