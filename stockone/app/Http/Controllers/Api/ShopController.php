<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Sale;
use App\Models\StationeryShop;
use App\Models\SubscriptionPayment;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Super Admin', description: 'Gestion plateforme Stock.one')]
class ShopController extends Controller
{
    /**
     * Liste toutes les boutiques
     */
    #[OA\Get(
        path: '/admin/shops',
        summary: 'Liste toutes les boutiques',
        security: [['bearerAuth' => []]],
        tags: ['Super Admin'],
        parameters: [
            new OA\Parameter(name: 'status', in: 'query', schema: new OA\Schema(type: 'string', enum: ['trial', 'active', 'suspended', 'closed'])),
            new OA\Parameter(name: 'search', in: 'query', schema: new OA\Schema(type: 'string')),
        ],
        responses: [new OA\Response(response: 200, description: 'Liste retournee')]
    )]
    public function index(Request $request): JsonResponse
    {
        $query = StationeryShop::withCount('users')
            ->orderByDesc('created_at');

        if ($request->filled('status')) $query->where('status', $request->status);
        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('shop_name', 'like', "%{$s}%")
                  ->orWhere('owner_name', 'like', "%{$s}%")
                  ->orWhere('owner_email', 'like', "%{$s}%")
                  ->orWhere('city', 'like', "%{$s}%");
            });
        }

        $shops = $query->paginate(20);

        // Stats globales plateforme
        $stats = [
            'total_shops'     => StationeryShop::count(),
            'active_shops'    => StationeryShop::where('status', 'active')->count(),
            'trial_shops'     => StationeryShop::where('status', 'trial')->count(),
            'suspended_shops' => StationeryShop::where('status', 'suspended')->count(),
            'expiring_soon'   => StationeryShop::where('status', 'active')
                                    ->where('subscription_end', '<=', now()->addDays(30))
                                    ->count(),
        ];

        return response()->json(['stats' => $stats, 'data' => $shops]);
    }

    /**
     * Créer une boutique avec son Admin
     */
    #[OA\Post(
        path: '/admin/shops',
        summary: 'Creer une boutique',
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['shop_name', 'owner_name', 'owner_firstname', 'owner_phone', 'owner_email', 'address', 'city'],
                properties: [
                    new OA\Property(property: 'shop_name',        type: 'string', example: 'Papeterie du Sud'),
                    new OA\Property(property: 'commercial_name',  type: 'string', example: 'PDS'),
                    new OA\Property(property: 'owner_name',       type: 'string', example: 'Hounkpe'),
                    new OA\Property(property: 'owner_firstname',  type: 'string', example: 'Marcel'),
                    new OA\Property(property: 'owner_phone',      type: 'string', example: '+22997000010'),
                    new OA\Property(property: 'owner_email',      type: 'string', example: 'hounkpe@pds.bj'),
                    new OA\Property(property: 'address',          type: 'string', example: 'Rue du Commerce'),
                    new OA\Property(property: 'city',             type: 'string', example: 'Porto-Novo'),
                    new OA\Property(property: 'neighborhood',     type: 'string'),
                    new OA\Property(property: 'ifu_number',       type: 'string'),
                    new OA\Property(property: 'rccm_number',      type: 'string'),
                    new OA\Property(property: 'brand_color',      type: 'string', example: '#1a73e8'),
                    new OA\Property(property: 'trial_days',       type: 'integer', example: 14),
                    new OA\Property(property: 'admin_password',   type: 'string', example: 'Password@123', description: 'Mot de passe du compte Admin Shop'),
                ]
            )
        ),
        tags: ['Super Admin'],
        responses: [
            new OA\Response(response: 201, description: 'Boutique creee'),
            new OA\Response(response: 422, description: 'Donnees invalides'),
        ]
    )]
    public function store(Request $request): JsonResponse
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
            'ifu_number'      => ['nullable', 'string', 'max:30'],
            'rccm_number'     => ['nullable', 'string', 'max:30'],
            'brand_color'     => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'trial_days'      => ['sometimes', 'integer', 'min:1', 'max:90'],
            'admin_password'  => ['required', 'string', 'min:8'],
        ]);

        DB::beginTransaction();
        try {
            $shop = StationeryShop::create([
                'shop_name'       => $validated['shop_name'],
                'commercial_name' => $validated['commercial_name'] ?? null,
                'owner_name'      => $validated['owner_name'],
                'owner_firstname' => $validated['owner_firstname'],
                'owner_phone'     => $validated['owner_phone'],
                'owner_email'     => $validated['owner_email'],
                'address'         => $validated['address'],
                'city'            => $validated['city'],
                'neighborhood'    => $validated['neighborhood'] ?? null,
                'ifu_number'      => $validated['ifu_number'] ?? null,
                'rccm_number'     => $validated['rccm_number'] ?? null,
                'brand_color'     => $validated['brand_color'] ?? '#1a73e8',
                'status'          => 'trial',
                'trial_days'      => $validated['trial_days'] ?? 14,
            ]);

            // Créer le compte Admin Shop
            $admin = User::create([
                'shop_id'   => $shop->id,
                'name'      => $validated['owner_name'],
                'firstname' => $validated['owner_firstname'],
                'email'     => $validated['owner_email'],
                'phone'     => $validated['owner_phone'],
                'password'  => Hash::make($validated['admin_password']),
                'role'      => 'admin_shop',
                'is_active' => true,
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Boutique creee avec succes.',
                'data'    => [
                    'shop'  => $shop,
                    'admin' => [
                        'id'    => $admin->id,
                        'email' => $admin->email,
                        'role'  => $admin->role,
                    ],
                ],
            ], 201);

        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Détail d'une boutique
     */
    #[OA\Get(
        path: '/admin/shops/{id}',
        summary: 'Detail boutique',
        security: [['bearerAuth' => []]],
        tags: ['Super Admin'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'OK')]
    )]
    public function show(int $id): JsonResponse
    {
        $shop = StationeryShop::withCount('users')->findOrFail($id);

        // Stats de la boutique
        $stats = [
            'ca_total'        => Sale::where('shop_id', $id)->completed()->sum('net_amount'),
            'ca_month'        => Sale::where('shop_id', $id)->completed()->whereMonth('sold_at', now()->month)->sum('net_amount'),
            'nb_sales_total'  => Sale::where('shop_id', $id)->completed()->count(),
            'nb_users'        => User::where('shop_id', $id)->count(),
            'days_until_expiry' => $shop->daysUntilExpiry(),
        ];

        return response()->json(['data' => $shop, 'stats' => $stats]);
    }

    /**
     * Modifier une boutique
     */
    #[OA\Put(
        path: '/admin/shops/{id}',
        summary: 'Modifier une boutique',
        security: [['bearerAuth' => []]],
        tags: ['Super Admin'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'OK')]
    )]
    public function update(Request $request, int $id): JsonResponse
    {
        $shop = StationeryShop::findOrFail($id);

        $validated = $request->validate([
            'shop_name'            => ['sometimes', 'string', 'max:150'],
            'commercial_name'      => ['nullable', 'string', 'max:150'],
            'owner_phone'          => ['sometimes', 'string', 'max:20'],
            'owner_phone_secondary'=> ['nullable', 'string', 'max:20'],
            'address'              => ['sometimes', 'string'],
            'city'                 => ['sometimes', 'string', 'max:80'],
            'neighborhood'         => ['nullable', 'string', 'max:100'],
            'ifu_number'           => ['nullable', 'string', 'max:30'],
            'rccm_number'          => ['nullable', 'string', 'max:30'],
            'brand_color'          => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'slogan'               => ['nullable', 'string', 'max:255'],
            'default_credit_days'  => ['sometimes', 'integer', 'min:1', 'max:365'],
        ]);

        $shop->update($validated);

        return response()->json(['data' => $shop, 'message' => 'Boutique modifiee.']);
    }

    /**
     * Activer l'abonnement d'une boutique
     */
    #[OA\Post(
        path: '/admin/shops/{id}/activate',
        summary: 'Activer abonnement boutique',
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['payment_method', 'payment_date', 'period_start', 'period_end'],
                properties: [
                    new OA\Property(property: 'amount',         type: 'number',  example: 35000),
                    new OA\Property(property: 'payment_method', type: 'string',  enum: ['mobile_money_mtn', 'mobile_money_moov', 'virement', 'especes']),
                    new OA\Property(property: 'transaction_ref', type: 'string', example: 'TXN-2025-001'),
                    new OA\Property(property: 'payment_date',   type: 'string',  format: 'date', example: '2025-01-01'),
                    new OA\Property(property: 'period_start',   type: 'string',  format: 'date', example: '2025-01-01'),
                    new OA\Property(property: 'period_end',     type: 'string',  format: 'date', example: '2025-12-31'),
                    new OA\Property(property: 'notes',          type: 'string'),
                ]
            )
        ),
        tags: ['Super Admin'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Abonnement active')]
    )]
    public function activate(Request $request, int $id): JsonResponse
    {
        $shop = StationeryShop::findOrFail($id);

        $validated = $request->validate([
            'amount'          => ['sometimes', 'numeric', 'min:0'],
            'payment_method'  => ['required', 'in:mobile_money_mtn,mobile_money_moov,virement,especes'],
            'transaction_ref' => ['nullable', 'string', 'max:100'],
            'payment_date'    => ['required', 'date'],
            'period_start'    => ['required', 'date'],
            'period_end'      => ['required', 'date', 'after:period_start'],
            'notes'           => ['nullable', 'string'],
        ]);

        DB::beginTransaction();
        try {
            SubscriptionPayment::create([
                'shop_id'         => $shop->id,
                'validated_by'    => $request->user()->id,
                'amount'          => $validated['amount'] ?? config('app.subscription_price', 35000),
                'payment_method'  => $validated['payment_method'],
                'transaction_ref' => $validated['transaction_ref'] ?? null,
                'payment_date'    => $validated['payment_date'],
                'period_start'    => $validated['period_start'],
                'period_end'      => $validated['period_end'],
                'status'          => 'validated',
                'notes'           => $validated['notes'] ?? null,
            ]);

            $shop->update([
                'status'             => 'active',
                'subscription_start' => $validated['period_start'],
                'subscription_end'   => $validated['period_end'],
            ]);

            DB::commit();

            return response()->json([
                'message' => "Abonnement active jusqu'au {$validated['period_end']}.",
                'data'    => $shop->fresh(),
            ]);

        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Suspendre une boutique
     */
    #[OA\Post(
        path: '/admin/shops/{id}/suspend',
        summary: 'Suspendre une boutique',
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [new OA\Property(property: 'reason', type: 'string')]
            )
        ),
        tags: ['Super Admin'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Boutique suspendue')]
    )]
    public function suspend(Request $request, int $id): JsonResponse
    {
        $shop = StationeryShop::findOrFail($id);
        $shop->update(['status' => 'suspended']);

        // Révoquer tous les tokens des utilisateurs de cette boutique
        User::where('shop_id', $id)->each(fn($u) => $u->tokens()->delete());

        return response()->json(['message' => 'Boutique suspendue. Tous les utilisateurs ont ete deconnectes.']);
    }

    /**
     * Réactiver une boutique suspendue
     */
    #[OA\Post(
        path: '/admin/shops/{id}/reactivate',
        summary: 'Reactiver une boutique',
        security: [['bearerAuth' => []]],
        tags: ['Super Admin'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Boutique reactivee')]
    )]
    public function reactivate(int $id): JsonResponse
    {
        $shop = StationeryShop::findOrFail($id);

        $status = $shop->subscription_end && $shop->subscription_end->isFuture()
            ? 'active' : 'trial';

        $shop->update(['status' => $status]);

        return response()->json([
            'message' => 'Boutique reactivee.',
            'status'  => $status,
            'data'    => $shop,
        ]);
    }

    /**
     * Statistiques globales de la plateforme
     */
    #[OA\Get(
        path: '/admin/stats',
        summary: 'Statistiques globales plateforme',
        security: [['bearerAuth' => []]],
        tags: ['Super Admin'],
        responses: [new OA\Response(response: 200, description: 'Stats retournees')]
    )]
    public function platformStats(): JsonResponse
    {
        $stats = [
            'shops' => [
                'total'     => StationeryShop::count(),
                'active'    => StationeryShop::where('status', 'active')->count(),
                'trial'     => StationeryShop::where('status', 'trial')->count(),
                'suspended' => StationeryShop::where('status', 'suspended')->count(),
                'expiring_30days' => StationeryShop::where('status', 'active')
                    ->where('subscription_end', '<=', now()->addDays(30))
                    ->count(),
            ],
            'users' => [
                'total'      => User::whereNotNull('shop_id')->count(),
                'admin_shop' => User::where('role', 'admin_shop')->count(),
                'gerant'     => User::where('role', 'gerant')->count(),
                'caissier'   => User::where('role', 'caissier')->count(),
                'active'     => User::whereNotNull('shop_id')->where('is_active', true)->count(),
            ],
            'revenue' => [
                'subscriptions_total' => SubscriptionPayment::where('status', 'validated')->sum('amount'),
                'subscriptions_year'  => SubscriptionPayment::where('status', 'validated')
                    ->whereYear('payment_date', now()->year)->sum('amount'),
                'subscriptions_month' => SubscriptionPayment::where('status', 'validated')
                    ->whereMonth('payment_date', now()->month)->sum('amount'),
            ],
            'activity' => [
                'total_sales'      => Sale::completed()->count(),
                'sales_today'      => Sale::completed()->whereDate('sold_at', today())->count(),
                'sales_this_month' => Sale::completed()->whereMonth('sold_at', now()->month)->count(),
                'top_shops'        => Sale::completed()
                    ->whereMonth('sold_at', now()->month)
                    ->select('shop_id', DB::raw('SUM(net_amount) as ca'), DB::raw('COUNT(*) as nb'))
                    ->groupBy('shop_id')
                    ->orderByDesc('ca')
                    ->limit(5)
                    ->with('shop:id,shop_name,commercial_name')
                    ->get(),
            ],
        ];

        return response()->json(['data' => $stats]);
    }

    /**
     * Historique des paiements d'abonnement
     */
    #[OA\Get(
        path: '/admin/shops/{id}/payments',
        summary: 'Historique abonnements boutique',
        security: [['bearerAuth' => []]],
        tags: ['Super Admin'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Historique retourne')]
    )]
    public function paymentHistory(int $id): JsonResponse
    {
        $shop     = StationeryShop::findOrFail($id);
        $payments = SubscriptionPayment::where('shop_id', $id)
            ->with('validatedBy:id,name,firstname')
            ->orderByDesc('payment_date')
            ->get();

        return response()->json([
            'shop'     => $shop->only(['id', 'shop_name', 'status', 'subscription_end']),
            'payments' => $payments,
        ]);
    }
}
