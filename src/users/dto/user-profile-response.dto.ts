import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

/**
 * A profile as the admin app lists it. Authentication lives in Supabase's `auth.users`, and none of
 * it — providers, tokens, confirmation state — is part of this: the API only ever reads `profiles`.
 */
export class UserProfileResponseDto {
  @ApiProperty({
    example: 'f7b3a5c4-1f2e-4a6b-8c9d-0e1f2a3b4c5d',
    description: 'The Supabase user id the profile belongs to.',
  })
  userId: string;

  @ApiProperty({ example: 'Tatiana', nullable: true })
  firstName: string | null;

  @ApiProperty({ example: 'Anosova', nullable: true })
  lastName: string | null;

  @ApiProperty({ example: 'tatiana@essera.example', nullable: true })
  email: string | null;

  @ApiProperty({ example: 'CUSTOMER', enum: UserRole })
  role: UserRole;

  @ApiProperty({ example: '2026-01-31T12:00:00.000Z' })
  createdAt: Date;
}
