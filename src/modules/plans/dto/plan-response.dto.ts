import { ApiProperty } from "@nestjs/swagger";

export class PlanResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ example: 99.99 })
  price!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  intervalDays!: number;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
