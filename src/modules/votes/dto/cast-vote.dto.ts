import { Type } from 'class-transformer';
import { IsIn } from 'class-validator';

export class CastVoteDto {
  @Type(() => Number)
  @IsIn([1, -1])
  value: 1 | -1;
}
