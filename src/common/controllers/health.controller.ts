import { Controller, Get } from '@nestjs/common';
import { Public } from '../decorators/public.decorator';

@Controller('health')
@Public()
export class HealthController {
  @Get()
  ping(): { status: 'ok'; uptime: number; timestamp: string } {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
