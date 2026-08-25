import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateDetailDto {
  @ApiPropertyOptional()
  @ApiProperty({ example: 'fit' })
  key?: string;

  @ApiPropertyOptional()
  @ApiProperty({ example: 'Fit & Sizing' })
  title?: string;

  @ApiPropertyOptional()
  @ApiProperty({
    example: `Model is 5'9" and wears size S. True to size fit. Unlined, underwire support.`,
  })
  content?: string;
}
