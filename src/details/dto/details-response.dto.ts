import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class DetailsResponseDto {
  @Expose()
  @ApiProperty({ example: 1 })
  id: number;

  @Expose()
  @ApiProperty({ example: 'fit' })
  key: string;

  @Expose()
  @ApiProperty({ example: 'Fit & Sizing' })
  title: string;

  @Expose()
  @ApiProperty({
    example: `Model is 5'9" and wears size S. True to size fit. Unlined, underwire support.`,
  })
  content: string;
}
