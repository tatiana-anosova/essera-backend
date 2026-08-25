import { ApiProperty } from '@nestjs/swagger';

export class CreateDetailDto {
  @ApiProperty()
  @ApiProperty({ example: 'fit' })
  key: string;

  @ApiProperty()
  @ApiProperty({ example: 'Fit & Sizing' })
  title: string;

  @ApiProperty()
  @ApiProperty({
    example: `Model is 5'9" and wears size S. True to size fit. Unlined, underwire support.`,
  })
  content: string;
}
