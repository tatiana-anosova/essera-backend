import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { DetailsService } from './details.service';
import { plainToInstance } from 'class-transformer';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateDetailDto, UpdateDetailDto, DetailsResponseDto } from './dto';

@ApiTags('Details')
@Controller('products')
export class DetailsController {
  constructor(private readonly detailsService: DetailsService) {}

  @ApiOperation({ summary: 'Details of a product on sale, by product id' })
  @ApiOkResponse({ type: DetailsResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No `ACTIVE` product with that id' })
  @Get(':productId/details')
  async getByProductId(@Param('productId', ParseIntPipe) productId: number) {
    const details = await this.detailsService.getByProductId(productId);
    return plainToInstance(DetailsResponseDto, details, {
      excludeExtraneousValues: true,
    });
  }

  @ApiOperation({ summary: 'Details of a product on sale, by slug' })
  @ApiOkResponse({ type: DetailsResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No `ACTIVE` product with that slug' })
  @Get('slug/:slug/details')
  async getBySlug(@Param('slug') slug: string) {
    const details = await this.detailsService.getBySlug(slug);
    return plainToInstance(DetailsResponseDto, details, {
      excludeExtraneousValues: true,
    });
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':productId/details')
  add(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: CreateDetailDto,
  ) {
    return this.detailsService.add(productId, dto);
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put('/details/:detailId')
  update(
    @Param('detailId', ParseIntPipe) detailId: number,
    @Body() dto: UpdateDetailDto,
  ) {
    return this.detailsService.update(detailId, dto);
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('/details/:detailId')
  remove(@Param('detailId', ParseIntPipe) detailId: number) {
    return this.detailsService.remove(detailId);
  }
}
