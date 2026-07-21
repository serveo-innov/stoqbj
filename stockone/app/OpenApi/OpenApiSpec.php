<?php

namespace App\OpenApi;

use OpenApi\Attributes as OA;

#[OA\Info(
    title: 'Stock.one API',
    version: '1.0.0',
    description: 'API de gestion de stocks pour papeteries - Benin',
    contact: new OA\Contact(email: 'admin@stockone.test')
)]
#[OA\Server(
    url: 'http://stockone.test:81/api/v1',
    description: 'Serveur local Laragon'
)]
#[OA\SecurityScheme(
    securityScheme: 'bearerAuth',
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT'
)]
class OpenApiSpec
{
}
