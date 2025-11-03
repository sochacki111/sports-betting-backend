import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('GamesController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/games (GET)', () => {
    it('should return an array of games', () => {
      return request(app.getHttpServer())
        .get('/games')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should filter games by status', () => {
      return request(app.getHttpServer())
        .get('/games?status=UPCOMING')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          if (res.body.length > 0) {
            expect(res.body[0]).toHaveProperty('status', 'UPCOMING');
          }
        });
    });
  });

  describe('/games/:id (GET)', () => {
    it('should return 404 for non-existent game', () => {
      return request(app.getHttpServer())
        .get('/games/non-existent-id')
        .expect(404);
    });
  });
});
