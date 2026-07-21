<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\StationeryShop;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use OpenApi\Attributes as OA;

class AuthController extends Controller
{
    /**
     * Duree d'essai fixe pour toute boutique auto-inscrite (non modifiable par
     * l'utilisateur, contrairement a la creation manuelle par le Super Admin).
     */
    private const SELF_SIGNUP_TRIAL_DAYS = 7;

    #[OA\Post(
        path: '/auth/login',
        summary: 'Connexion utilisateur',
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['email', 'password'],
                properties: [
                    new OA\Property(property: 'email',    type: 'string', format: 'email',    example: 'superadmin@stoq.bj'),
                    new OA\Property(property: 'password', type: 'string', format: 'password', example: 'StockOne@2025'),
                ]
            )
        ),
        tags: ['Auth'],
        responses: [
            new OA\Response(response: 200, description: 'Connexion reussie'),
            new OA\Response(response: 401, description: 'Identifiants incorrects'),
            new OA\Response(response: 422, description: 'Donnees invalides'),
        ]
    )]
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Identifiants incorrects.'], 401);
        }

        if (! $user->is_active) {
            return response()->json(['message' => 'Votre compte est desactive.'], 403);
        }

        if (! $user->isSuperAdmin()) {
            $shop = $user->shop;
            if (! $shop || $shop->status === 'closed') {
                return response()->json(['message' => 'Acces impossible. La boutique est fermee.'], 403);
            }
            if ($shop->isSuspended()) {
                return response()->json(['message' => 'La boutique est suspendue.'], 403);
            }
        }

        $user->tokens()->delete();
        $expiresAt = now()->addMinutes((int) config('sanctum.expiration', 480));
        $token = $user->createToken('auth_token', ['*'], $expiresAt);

        $user->update([
            'last_login_at' => now(),
            'last_login_ip' => $request->ip(),
        ]);

        return response()->json([
            'access_token' => $token->plainTextToken,
            'token_type'   => 'Bearer',
            'expires_at'   => $expiresAt->toISOString(),
            'user'         => $this->formatUser($user),
        ]);
    }

    /**
     * Auto-inscription publique : une boutique cree son propre compte et
     * demarre une periode d'essai, sans intervention du Super Admin.
     * La duree d'essai est fixe (non pilotable par le client), pour eviter
     * tout abus via un champ trial_days manipule.
     */
    #[OA\Post(
        path: '/auth/register-shop',
        summary: 'Auto-inscription : creer sa boutique et son compte admin',
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['shop_name', 'owner_name', 'owner_firstname', 'owner_phone', 'owner_email', 'address', 'city', 'password', 'password_confirmation'],
                properties: [
                    new OA\Property(property: 'shop_name',              type: 'string', example: 'Papeterie du Marche'),
                    new OA\Property(property: 'commercial_name',        type: 'string', example: 'PapMarche'),
                    new OA\Property(property: 'owner_name',             type: 'string', example: 'Dossou'),
                    new OA\Property(property: 'owner_firstname',        type: 'string', example: 'Aime'),
                    new OA\Property(property: 'owner_phone',            type: 'string', example: '+22997000003'),
                    new OA\Property(property: 'owner_email',            type: 'string', format: 'email'),
                    new OA\Property(property: 'address',                type: 'string'),
                    new OA\Property(property: 'city',                   type: 'string', example: 'Cotonou'),
                    new OA\Property(property: 'neighborhood',           type: 'string'),
                    new OA\Property(property: 'password',               type: 'string', example: 'MotDePasse@2026'),
                    new OA\Property(property: 'password_confirmation',  type: 'string', example: 'MotDePasse@2026'),
                ]
            )
        ),
        tags: ['Auth'],
        responses: [
            new OA\Response(response: 201, description: 'Boutique et compte crees, connexion automatique'),
            new OA\Response(response: 422, description: 'Donnees invalides ou email deja utilise'),
        ]
    )]
    public function registerShop(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'shop_name'       => ['required', 'string', 'max:150'],
            'commercial_name' => ['nullable', 'string', 'max:150'],
            'owner_name'      => ['required', 'string', 'max:100'],
            'owner_firstname' => ['required', 'string', 'max:100'],
            'owner_phone'     => ['required', 'string', 'max:20'],
            'owner_email'     => ['required', 'email', 'max:150', 'unique:stationery_shops,owner_email', 'unique:users,email'],
            'address'         => ['required', 'string'],
            'city'            => ['required', 'string', 'max:80'],
            'neighborhood'    => ['nullable', 'string', 'max:100'],
            'password'        => ['required', 'string', 'min:8', 'confirmed'],
        ], [
            'owner_email.unique' => 'Cette adresse email est deja associee a un compte.',
            'password.confirmed' => 'Les mots de passe ne correspondent pas.',
            'password.min'       => 'Le mot de passe doit contenir au moins 8 caracteres.',
        ]);

        DB::beginTransaction();
        try {
            $trialDays = self::SELF_SIGNUP_TRIAL_DAYS;

            $shop = StationeryShop::create([
                'shop_name'          => $validated['shop_name'],
                'commercial_name'    => $validated['commercial_name'] ?? null,
                'owner_name'         => $validated['owner_name'],
                'owner_firstname'    => $validated['owner_firstname'],
                'owner_phone'        => $validated['owner_phone'],
                'owner_email'        => $validated['owner_email'],
                'address'            => $validated['address'],
                'city'               => $validated['city'],
                'neighborhood'       => $validated['neighborhood'] ?? null,
                'brand_color'        => '#1a73e8',
                'status'             => 'trial',
                'trial_days'         => $trialDays,
                // Calcules explicitement : sans cela, daysUntilExpiry() afficherait
                // 0 jour des l'inscription (subscription_end resterait null).
                'subscription_start' => now(),
                'subscription_end'   => now()->addDays($trialDays),
            ]);

            $admin = User::create([
                'shop_id'   => $shop->id,
                'name'      => $validated['owner_name'],
                'firstname' => $validated['owner_firstname'],
                'email'     => $validated['owner_email'],
                'phone'     => $validated['owner_phone'],
                'password'  => Hash::make($validated['password']),
                'role'      => 'admin_shop',
                'is_active' => true,
            ]);

            // Connexion automatique : le nouvel utilisateur atterrit directement
            // sur son tableau de bord, sans etape de connexion supplementaire.
            $expiresAt = now()->addMinutes((int) config('sanctum.expiration', 480));
            $token = $admin->createToken('auth_token', ['*'], $expiresAt);

            $admin->update([
                'last_login_at' => now(),
                'last_login_ip' => $request->ip(),
            ]);

            DB::commit();

            return response()->json([
                'message'      => 'Boutique creee avec succes. Bienvenue sur Stoq.bj !',
                'access_token' => $token->plainTextToken,
                'token_type'   => 'Bearer',
                'expires_at'   => $expiresAt->toISOString(),
                'user'         => $this->formatUser($admin->fresh()->load('shop')),
            ], 201);

        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    #[OA\Post(
        path: '/auth/logout',
        summary: 'Deconnexion',
        security: [['bearerAuth' => []]],
        tags: ['Auth'],
        responses: [
            new OA\Response(response: 200, description: 'Deconnexion reussie'),
            new OA\Response(response: 401, description: 'Non authentifie'),
        ]
    )]
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Deconnexion reussie.']);
    }

    #[OA\Get(
        path: '/auth/me',
        summary: 'Profil utilisateur connecte',
        security: [['bearerAuth' => []]],
        tags: ['Auth'],
        responses: [
            new OA\Response(response: 200, description: 'Profil retourne'),
            new OA\Response(response: 401, description: 'Non authentifie'),
        ]
    )]
    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load('shop');
        return response()->json(['user' => $this->formatUser($user)]);
    }

    #[OA\Post(
        path: '/auth/refresh',
        summary: 'Renouveler le token',
        security: [['bearerAuth' => []]],
        tags: ['Auth'],
        responses: [
            new OA\Response(response: 200, description: 'Nouveau token genere'),
            new OA\Response(response: 401, description: 'Non authentifie'),
        ]
    )]
    public function refresh(Request $request): JsonResponse
    {
        $user = $request->user();
        $request->user()->currentAccessToken()->delete();
        $expiresAt = now()->addMinutes((int) config('sanctum.expiration', 480));
        $token = $user->createToken('auth_token', ['*'], $expiresAt);

        return response()->json([
            'access_token' => $token->plainTextToken,
            'token_type'   => 'Bearer',
            'expires_at'   => $expiresAt->toISOString(),
        ]);
    }

    private function formatUser(User $user): array
    {
        $data = [
            'id'            => $user->id,
            'name'          => $user->name,
            'firstname'     => $user->firstname,
            'email'         => $user->email,
            'phone'         => $user->phone,
            'role'          => $user->role,
            'is_active'     => $user->is_active,
            'last_login_at' => $user->last_login_at?->toISOString(),
            'permissions'   => [
                'can_manage_catalogue'     => $user->canManageCatalogue(),
                'can_view_full_reports'    => $user->canViewFullReports(),
                'can_adjust_prices'        => $user->canAdjustPrices(),
                'can_manage_users'         => $user->canManageUsers(),
                'can_manage_shop_settings' => $user->canManageShopSettings(),
                'can_validate_stock_adj'   => $user->canValidateStockAdjustments(),
                'can_manage_shops'         => $user->canManageShops(),
            ],
        ];

        if ($user->shop) {
            $data['shop'] = [
                'id'                => $user->shop->id,
                'shop_name'         => $user->shop->shop_name,
                'commercial_name'   => $user->shop->commercial_name,
                'logo_path'         => $user->shop->logo_path,
                'brand_color'       => $user->shop->brand_color,
                'status'            => $user->shop->status,
                'days_until_expiry' => $user->shop->daysUntilExpiry(),
            ];
        }

        return $data;
    }
}
