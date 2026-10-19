<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // PayDunya remplace Kkiapay. Cle unique (master_key) commune aux deux
    // modes ; cle privee et token different entre test et live (voir
    // PAYDUNYA-TEST-PRIVATE-KEY vs PAYDUNYA-LIVE-PRIVATE-KEY sur leur
    // tableau de bord). 'sandbox' choisit la paire a utiliser ET change
    // l'URL de base de l'API (sandbox-api vs api) — gere dans le controleur.
    'paydunya' => [
        'master_key'          => env('PAYDUNYA_MASTER_KEY'),
        'test_private_key'    => env('PAYDUNYA_TEST_PRIVATE_KEY'),
        'test_token'          => env('PAYDUNYA_TEST_TOKEN'),
        'live_private_key'    => env('PAYDUNYA_LIVE_PRIVATE_KEY'),
        'live_token'          => env('PAYDUNYA_LIVE_TOKEN'),
        'sandbox'             => env('PAYDUNYA_SANDBOX', true),
        'subscription_price'  => env('PAYDUNYA_SUBSCRIPTION_PRICE', 35000),
    ],

];
