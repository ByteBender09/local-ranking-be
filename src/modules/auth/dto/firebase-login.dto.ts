import { IsString, MinLength } from 'class-validator';

export class FirebaseLoginDto {
  @IsString()
  @MinLength(20)
  idToken: string;
}
