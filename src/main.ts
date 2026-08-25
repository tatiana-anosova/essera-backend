import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  console.log('DB host:', new URL(process.env.DATABASE_URL!).host);
  // `rawBody` keeps the untouched request body around, which the Stripe webhook
  // needs: the signature is computed over the exact bytes Stripe sent.
  const app = await NestFactory.create(AppModule, {
    cors: true,
    rawBody: true,
  });
  app.useGlobalPipes(new ValidationPipe());

  const config = new DocumentBuilder()
    .setTitle('Essera API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
