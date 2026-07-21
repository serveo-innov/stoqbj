<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Cache\RateLimiter;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RateLimitLogin
{
    public function __construct(protected RateLimiter $limiter) {}

    public function handle(Request $request, Closure $next): Response
    {
        $key = 'login:' . $request->ip() . '|' . strtolower($request->input('email', ''));

        // 5 tentatives max par minute
        if ($this->limiter->tooManyAttempts($key, 5)) {
            $seconds = $this->limiter->availableIn($key);

            return response()->json([
                'message'     => "Trop de tentatives de connexion. Reessayez dans {$seconds} secondes.",
                'retry_after' => $seconds,
            ], 429);
        }

        $response = $next($request);

        // Si echec d'authentification (401), incrementer le compteur
        if ($response->getStatusCode() === 401) {
            $this->limiter->hit($key, 60);
            $remaining = 5 - $this->limiter->attempts($key);

            $data = json_decode($response->getContent(), true);
            $data['attempts_remaining'] = max(0, $remaining);
            return response()->json($data, 401);
        }

        // Succes : remettre le compteur a zero
        if ($response->getStatusCode() === 200) {
            $this->limiter->clear($key);
        }

        return $response;
    }
}
