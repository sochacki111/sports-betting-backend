import { Module, Global } from '@nestjs/common';
import { OddsClientService } from './odds-client.service';

@Global()
@Module({
  providers: [OddsClientService],
  exports: [OddsClientService],
})
export class OddsClientModule {}
