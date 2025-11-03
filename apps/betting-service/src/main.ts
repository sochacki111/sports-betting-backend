import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use Pino logger
  app.useLogger(app.get(Logger));

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
    .setTitle('Betting Service API')
    .setDescription('Sports betting service for placing and managing bets')
    .setVersion('1.0')
    .addTag('bets')
    .addTag('users')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Setup RabbitMQ microservice for event listening
  const rabbitmqUrl =
    process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
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

  const port = process.env.BETTING_SERVICE_PORT || 3002;
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(
    `🚀 Betting Service REST API running on: http://localhost:${port}`,
  );
  logger.log(
    `📚 Swagger documentation available at: http://localhost:${port}/api/docs`,
  );
  logger.log(`🐰 RabbitMQ consumer connected to: ${rabbitmqUrl}`);
}

bootstrap();
