import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiSearchCache, City, Venue } from '../../database/entities';
import { VenuesModule } from '../venues/venues.module';
import { AiSearchController } from './ai-search.controller';
import { AiSearchService } from './ai-search.service';
import { AiParserService } from './ai-parser.service';
import { AiRerankerService } from './ai-reranker.service';
import { AiCacheService } from './ai-cache.service';
import { OpenRouterClient } from './openrouter.client';

@Module({
  imports: [
    TypeOrmModule.forFeature([Venue, City, AiSearchCache]),
    // Pulls in WardNormalizerService for "Quận 3" → wards expansion in
    // the filter step. VenuesModule already exports it.
    VenuesModule,
  ],
  controllers: [AiSearchController],
  providers: [
    OpenRouterClient,
    AiParserService,
    AiRerankerService,
    AiCacheService,
    AiSearchService,
  ],
})
export class AiSearchModule {}
