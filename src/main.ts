import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true, bodyParser: false });
  app.use(express.json({ limit: '2mb', verify: (req: any, _res, buffer) => { req.rawBody = Buffer.from(buffer); } }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(helmet());
  const allowedOrigins = new Set([
    'https://ara-dashboard-one.vercel.app',
    'https://ara-dashboard-princezdavidz-6985.vercel.app',
    'https://ara-public-website.onrender.com',
    ...(process.env.DASHBOARD_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean),
    ...(process.env.ARA_CRM_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean),
    ...(process.env.ARA_ADMIN_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean),
  ]);
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed by CORS'));
    },
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.listen(Number(process.env.PORT || 3000), '0.0.0.0');
}
void bootstrap();
