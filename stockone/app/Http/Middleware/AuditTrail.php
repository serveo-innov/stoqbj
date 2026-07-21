<?php

namespace App\Http\Middleware;

use App\Models\AuditLog;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuditTrail
{
    // Actions à auditer selon méthode HTTP + route
    const AUDITABLE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

    // Routes à exclure de l'audit
    const EXCLUDED_PATHS = [
        'api/v1/auth/refresh',
        'api/v1/auth/logout',
        'api/v1/health',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Auditer seulement les mutations réussies
        if (
            in_array($request->method(), self::AUDITABLE_METHODS) &&
            $response->getStatusCode() < 400 &&
            ! $this->isExcluded($request)
        ) {
            $this->log($request, $response);
        }

        return $response;
    }

    private function isExcluded(Request $request): bool
    {
        foreach (self::EXCLUDED_PATHS as $path) {
            if ($request->is($path)) return true;
        }
        return false;
    }

    private function log(Request $request, Response $response): void
    {
        try {
            $user   = $request->user();
            $action = $this->resolveAction($request);

            \App\Models\AuditLog::create([
                'shop_id'      => $user?->shop_id,
                'user_id'      => $user?->id,
                'action'       => $action,
                'model_type'   => null,
                'model_id'     => null,
                'old_values'   => null,
                'new_values'   => $this->sanitizeInput($request->all()),
                'ip_address'   => $request->ip(),
                'user_agent'   => $request->userAgent(),
                'performed_at' => now(),
            ]);
        } catch (\Throwable $e) {
            // Ne jamais bloquer la requête si l'audit échoue
            \Illuminate\Support\Facades\Log::warning("Audit trail error: {$e->getMessage()}");
        }
    }

    private function resolveAction(Request $request): string
    {
        $method = $request->method();
        $path   = $request->path();

        return match($method) {
            'POST'   => "created:{$path}",
            'PUT',
            'PATCH'  => "updated:{$path}",
            'DELETE' => "deleted:{$path}",
            default  => "{$method}:{$path}",
        };
    }

    private function sanitizeInput(array $input): array
    {
        // Masquer les champs sensibles
        $sensitive = ['password', 'password_confirmation', 'current_password', 'token', 'api_key'];
        foreach ($sensitive as $field) {
            if (isset($input[$field])) {
                $input[$field] = '***';
            }
        }
        return $input;
    }
}
