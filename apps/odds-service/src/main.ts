import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { resolve } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use Pino logger
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable CORS
  app.enableCors();

  // Setup Swagger
  const config = new DocumentBuilder()
    .setTitle('Odds Service API')
    .setDescription('Sports betting odds management service')
    .setVersion('1.0')
    .addTag('odds')
    .addTag('games')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Setup gRPC microservice
  const grpcPort = configService.get<number>('grpcPort', 5001);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'odds',
      protoPath: resolve(process.cwd(), 'proto/odds.proto'),
      url: `0.0.0.0:${grpcPort}`,
    },
  });

  // Setup RabbitMQ microservice for event listening
  const rabbitmqUrl = configService.get<string>(
    'rabbitmq.url',
    'amqp://guest:guest@localhost:5672',
  );
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: 'game_events',
      queueOptions: {
        durable: true,
      },
    },
  });

  await app.startAllMicroservices();

  const port = configService.get<number>('port', 3001);
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`🚀 Odds Service REST API running on: http://localhost:${port}`);
  logger.log(
    `📚 Swagger documentation available at: http://localhost:${port}/api/docs`,
  );
  logger.log(`🔌 gRPC server running on: localhost:${grpcPort}`);
  logger.log(`🐰 RabbitMQ consumer connected to: ${rabbitmqUrl}`);
}

bootstrap();
