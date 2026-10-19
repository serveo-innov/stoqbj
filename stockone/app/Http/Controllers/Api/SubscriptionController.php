<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\PaymentIntent;
use App\Models\StationeryShop;
use App\Models\SubscriptionPayment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Abonnement', description: 'Paiement d\'abonnement self-service via PayDunya')]
class SubscriptionController extends Controller
{
    private const INTENT_EXPIRY_MINUTES = 30;

    /**
     * PayDunya utilise une URL DE BASE DIFFERENTE entre test et live
     * (sandbox-api vs api), pas juste des cles differentes sur la meme URL.
     * Se tromper ici enverrait des appels live en mode test ou vice-versa.
     */
    private function baseUrl(): string
    {
        $sandbox = (bool) config('services.paydunya.sandbox', true);
        return $sandbox
            ? 'https://app.paydunya.com/sandbox-api/v1'
            : 'https://app.paydunya.com/api/v1';
    }

    private function headers(): array
    {
        $sandbox = (bool) config('services.paydunya.sandbox', true);
        return [
            'Content-Type'          => 'application/json',
            'PAYDUNYA-MASTER-KEY'   => config('services.paydunya.master_key'),
            'PAYDUNYA-PRIVATE-KEY'  => $sandbox
                ? config('services.paydunya.test_private_key')
                : config('services.paydunya.live_private_key'),
            'PAYDUNYA-TOKEN'        => $sandbox
                ? config('services.paydunya.test_token')
                : config('services.paydunya.live_token'),
        ];
    }

    private function resolveOwnShopId(Request $request): int
    {
        $shopId = $request->user()->shop_id;

        if (! $shopId) {
            abort(response()->json([
                'message' => "Vous n'etes rattache a aucune boutique.",
            ], 422));
        }

        return $shopId;
    }

    #[OA\Get(
        path: '/subscription',
        summary: 'Statut abonnement',
        security: [['bearerAuth' => []]],
        tags: ['Abonnement'],
        responses: [new OA\Response(response: 200, description: 'Statut retourne')]
    )]
    public function status(Request $request): JsonResponse
    {
        $shopId = $this->resolveOwnShopId($request);
        $shop   = StationeryShop::findOrFail($shopId);

        return response()->json([
            'data' => [
                'status'             => $shop->status,
                'subscription_start' => $shop->subscription_start,
                'subscription_end'   => $shop->subscription_end,
                'days_until_expiry'  => $shop->daysUntilExpiry(),
                'amount'             => (int) config('services.paydunya.subscription_price', 35000),
                'paydunya_sandbox'   => (bool) config('services.paydunya.sandbox', true),
            ],
        ]);
    }

    #[OA\Post(
        path: '/subscription/paydunya/initiate',
        summary: 'Creer une facture PayDunya et obtenir l\'URL de paiement',
        security: [['bearerAuth' => []]],
        tags: ['Abonnement'],
        responses: [new OA\Response(response: 200, description: 'Facture creee, redirection vers checkout_url')]
    )]
    public function initiate(Request $request): JsonResponse
    {
        $shopId = $this->resolveOwnShopId($request);
        $shop   = StationeryShop::findOrFail($shopId);

        PaymentIntent::where('shop_id', $shopId)
            ->where('status', 'pending')
            ->update(['status' => 'expired']);

        $intent = PaymentIntent::create([
            'shop_id'    => $shopId,
            'created_by' => $request->user()->id,
            'reference'  => 'sub_' . Str::random(32),
            'status'     => 'pending',
            'expires_at' => now()->addMinutes(self::INTENT_EXPIRY_MINUTES),
        ]);

        $amount      = (int) config('services.paydunya.subscription_price', 35000);
        $frontendUrl = rtrim(config('app.frontend_url'), '/');

        try {
            $response = Http::withHeaders($this->headers())
                ->post($this->baseUrl() . '/checkout-invoice/create', [
                    'invoice' => [
                        'total_amount' => $amount,
                        'description'  => "Abonnement Stoq.bj - 30 jours - {$shop->shop_name}",
                    ],
                    'store' => [
                        'name' => 'Stoq.bj',
                    ],
                    'actions' => [
                        // CORRECTIF : le vrai chemin (all_routes.tsx) est
                        // /abonnement, pas /settings/subscription.
                        'cancel_url'   => "{$frontendUrl}/abonnement?paydunya=cancelled",
                        'return_url'   => "{$frontendUrl}/abonnement?paydunya=return",
                        'callback_url' => rtrim(config('app.url'), '/') . '/api/v1/webhooks/paydunya',
                    ],
                    'custom_data' => [
                        'intent_reference' => $intent->reference,
                        'shop_id'          => $shopId,
                    ],
                ]);
        } catch (\Throwable $e) {
            Log::error('PayDunya : appel create-invoice a echoue', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Impossible de contacter PayDunya. Reessayez dans un instant.'], 422);
        }

        $body = $response->json();

        if (($body['response_code'] ?? null) !== '00') {
            Log::error('PayDunya : create-invoice a refuse la demande', ['response' => $body]);
            return response()->json(['message' => $body['response_text'] ?? 'PayDunya a refuse la creation de la facture.'], 422);
        }

        return response()->json([
            'data' => [
                'checkout_url' => $body['response_text'],
                'token'        => $body['token'],
            ],
        ]);
    }

    /**
     * Verifie une facture aupres de PayDunya et active l'abonnement si tout
     * concorde. Appelee par confirm() (retour navigateur) ET par webhook()
     * (notification serveur-a-serveur) — jamais sur la seule foi d'un appel,
     * toujours re-verifiee aupres de PayDunya elle-meme.
     *
     * Retourne [success: bool, message: string, shop: ?StationeryShop].
     */
    /**
     * Retourne [success, message, shop|null, shop_id|null]. Le 4e element
     * est renseigne des que l'intention est identifiee, meme en cas
     * d'echec ensuite — utilise par le webhook pour rattacher une alerte
     * a la bonne boutique plutot qu'a aucune (shop_id est NOT NULL sur
     * la table alerts).
     */
    private function verifyAndActivate(string $token, ?int $expectedShopId = null): array
    {
        try {
            $response = Http::withHeaders($this->headers())
                ->get($this->baseUrl() . "/checkout-invoice/confirm/{$token}");
        } catch (\Throwable $e) {
            Log::error('PayDunya : appel confirm a echoue', ['error' => $e->getMessage()]);
            return [false, 'Impossible de verifier la transaction aupres de PayDunya.', null, null];
        }

        $body = $response->json();

        if (($body['response_code'] ?? null) !== '00') {
            return [false, $body['response_text'] ?? 'Facture introuvable aupres de PayDunya.', null, null];
        }

        $status       = $body['status'] ?? null;
        $amount       = $body['invoice']['total_amount'] ?? null;
        $customData   = $body['custom_data'] ?? [];
        $intentRef    = $customData['intent_reference'] ?? null;
        $customShopId = $customData['shop_id'] ?? null;

        if (! $intentRef) {
            Log::warning('PayDunya : custom_data.intent_reference absent de la reponse confirm.', ['token' => $token]);
            return [false, 'Cette transaction ne contient pas les informations attendues.', null, null];
        }

        $intent = PaymentIntent::where('reference', $intentRef)->first();

        if (! $intent) {
            Log::warning('PayDunya : intention introuvable pour ce token.', ['token' => $token, 'reference' => $intentRef]);
            return [false, 'Intention de paiement invalide.', null, null];
        }

        if ($expectedShopId !== null && $intent->shop_id !== $expectedShopId) {
            Log::warning('PayDunya : intention n\'appartient pas a la boutique appelante.', [
                'shop_id_attendu' => $expectedShopId,
                'shop_id_intent'  => $intent->shop_id,
            ]);
            return [false, 'Cette transaction ne correspond pas a votre boutique.', null, $intent->shop_id];
        }

        if ((int) $customShopId !== $intent->shop_id) {
            Log::warning('PayDunya : shop_id dans custom_data different de celui de l\'intention.', [
                'token' => $token,
            ]);
            return [false, 'Cette transaction ne correspond pas a votre demande de paiement.', null, $intent->shop_id];
        }

        $shop = StationeryShop::find($intent->shop_id);
        if (! $shop) {
            return [false, 'Boutique introuvable.', null, $intent->shop_id];
        }

        $alreadyProcessed = SubscriptionPayment::where('transaction_ref', $token)->exists();
        if ($alreadyProcessed) {
            return [true, "Cette transaction a deja ete traitee.", $shop->fresh(), $shop->id];
        }

        if (! $intent->isUsable()) {
            return [false, 'Cette intention de paiement a expire ou a deja ete utilisee. Relancez un paiement.', null, $shop->id];
        }

        if ($status !== 'completed') {
            return [false, "La transaction n'a pas ete confirmee comme reussie (statut : {$status}).", null, $shop->id];
        }

        $expectedAmount = (int) config('services.paydunya.subscription_price', 35000);
        if ((int) $amount !== $expectedAmount) {
            Log::warning('PayDunya : montant transaction different du prix attendu', [
                'token'          => $token,
                'amount_recu'    => $amount,
                'amount_attendu' => $expectedAmount,
            ]);
            return [false, 'Le montant de la transaction ne correspond pas au prix de l\'abonnement.', null, $shop->id];
        }

        $periodStart = ($shop->subscription_end && $shop->subscription_end->isFuture())
            ? $shop->subscription_end->copy()
            : now();
        $periodEnd = $periodStart->copy()->addDays(30);

        SubscriptionPayment::create([
            'shop_id'         => $shop->id,
            'validated_by'    => $intent->created_by,
            'amount'          => $expectedAmount,
            'payment_method'  => 'paydunya',
            'transaction_ref' => $token,
            'payment_date'    => now(),
            'period_start'    => $periodStart,
            'period_end'      => $periodEnd,
            'status'          => 'validated',
            'notes'           => 'Paiement automatique via PayDunya (self-service).',
        ]);

        $shop->update([
            'status'             => 'active',
            'subscription_start' => $shop->subscription_start ?? $periodStart,
            'subscription_end'   => $periodEnd,
        ]);

        $intent->update([
            'status'                   => 'consumed',
            'consumed_transaction_ref' => $token,
        ]);

        return [true, "Abonnement active jusqu'au {$periodEnd->toDateString()}.", $shop->fresh(), $shop->id];
    }

    #[OA\Post(
        path: '/subscription/paydunya/confirm',
        summary: 'Confirmer une facture PayDunya et activer l\'abonnement',
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['token'],
                properties: [new OA\Property(property: 'token', type: 'string', example: 'hskjdjkqjkdqskdsq')]
            )
        ),
        tags: ['Abonnement'],
        responses: [
            new OA\Response(response: 200, description: 'Abonnement active'),
            new OA\Response(response: 422, description: 'Transaction invalide'),
        ]
    )]
    public function confirm(Request $request): JsonResponse
    {
        $shopId    = $this->resolveOwnShopId($request);
        $validated = $request->validate(['token' => ['required', 'string', 'max:150']]);

        [$success, $message, $shop, ] = $this->verifyAndActivate($validated['token'], $shopId);

        return response()->json(['message' => $message, 'data' => $shop], $success ? 200 : 422);
    }

    /**
     * Notification serveur-a-serveur PayDunya (IPN), recue sur
     * actions.callback_url. Contrairement au webhook Kkiapay (qui ne
     * faisait que journaliser/alerter faute de pouvoir re-verifier la
     * transaction), celui-ci peut activer l'abonnement lui-meme : on ne
     * fait jamais confiance au contenu du POST, on rappelle PayDunya en
     * GET /confirm/{token} pour verifier la verite avant d'agir — c'est ce
     * qui rend la verification fiable sans dependre d'un secret partage.
     */
    #[OA\Post(
        path: '/webhooks/paydunya',
        summary: 'Webhook PayDunya (IPN) — verifie et active si necessaire',
        tags: ['Abonnement'],
        responses: [new OA\Response(response: 200, description: 'Recu')]
    )]
    public function webhook(Request $request): Response
    {
        Log::info('Webhook PayDunya recu', $request->all());

        $data = $request->input('data');
        if (is_string($data)) {
            $data = json_decode($data, true) ?? [];
        }
        $token = $data['invoice']['token'] ?? $request->input('token');

        if (! $token) {
            Log::warning('Webhook PayDunya recu sans token exploitable.', $request->all());
            return response('OK', 200);
        }

        [$success, $message, , $resolvedShopId] = $this->verifyAndActivate($token);

        if (! $success) {
            Log::warning('Webhook PayDunya : verification non concluante.', ['token' => $token, 'message' => $message]);

            // On ne peut rattacher une alerte qu'a une boutique connue
            // (shop_id est obligatoire sur la table alerts). Si on n'a
            // meme pas pu identifier l'intention, il n'y a nulle part ou
            // l'afficher — seul le log ci-dessus garde une trace.
            if ($resolvedShopId) {
                Alert::firstOrCreate(
                    [
                        'shop_id'         => $resolvedShopId,
                        'product_unit_id' => null,
                        'type'            => 'payment_unconfirmed',
                    ],
                    [
                        'triggered_at' => now(),
                        'meta' => [
                            'token'   => $token,
                            'message' => "Un paiement PayDunya a ete recu mais n'a pas pu etre confirme automatiquement. Verification manuelle requise.",
                        ],
                    ]
                );
            }
        }

        // PayDunya attend 200, quel que soit le resultat de notre
        // verification — sinon il reessaiera indefiniment.
        return response('OK', 200);
    }
}
