<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KkiapayPaymentIntent;
use App\Models\StationeryShop;
use App\Models\SubscriptionPayment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Kkiapay\Kkiapay;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Abonnement', description: 'Paiement d\'abonnement self-service via Kkiapay')]
class SubscriptionController extends Controller
{
    /**
     * Duree de validite d'une intention de paiement avant expiration.
     */
    private const INTENT_EXPIRY_MINUTES = 30;

    /**
     * Client Kkiapay configure depuis les cles .env
     */
    private function kkiapayClient(): Kkiapay
    {
        return new Kkiapay(
            config('services.kkiapay.public_key'),
            config('services.kkiapay.private_key'),
            config('services.kkiapay.secret'),
            (bool) config('services.kkiapay.sandbox', true)
        );
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

    /**
     * Statut de l'abonnement de sa propre boutique + infos pour le widget de paiement
     */
    #[OA\Get(
        path: '/subscription',
        summary: 'Statut abonnement et config du widget de paiement',
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
                'status'              => $shop->status,
                'subscription_start'  => $shop->subscription_start,
                'subscription_end'    => $shop->subscription_end,
                'days_until_expiry'   => $shop->daysUntilExpiry(),
                'amount'              => (int) config('services.kkiapay.subscription_price', 35000),
                'kkiapay_public_key'  => config('services.kkiapay.public_key'),
                'kkiapay_sandbox'     => (bool) config('services.kkiapay.sandbox', true),
            ],
        ]);
    }

    /**
     * Initier une intention de paiement : genere une reference unique liee a la
     * boutique, a transmettre au widget Kkiapay (champ "data"), puis a renvoyer
     * telle quelle lors de la confirmation. Ceci lie la demande de paiement a la
     * boutique qui l'a initiee, independamment de ce que Kkiapay renvoie ou non
     * dans verifyTransaction().
     */
    #[OA\Post(
        path: '/subscription/kkiapay/initiate',
        summary: 'Initier une intention de paiement Kkiapay',
        security: [['bearerAuth' => []]],
        tags: ['Abonnement'],
        responses: [new OA\Response(response: 200, description: 'Intention creee')]
    )]
    public function initiate(Request $request): JsonResponse
    {
        $shopId = $this->resolveOwnShopId($request);

        // Invalide les intentions pending precedentes de cette boutique pour eviter
        // l'accumulation (une seule intention active a la fois par boutique).
        KkiapayPaymentIntent::where('shop_id', $shopId)
            ->where('status', 'pending')
            ->update(['status' => 'expired']);

        $intent = KkiapayPaymentIntent::create([
            'shop_id'    => $shopId,
            'created_by' => $request->user()->id,
            'reference'  => 'sub_' . Str::random(32),
            'status'     => 'pending',
            'expires_at' => now()->addMinutes(self::INTENT_EXPIRY_MINUTES),
        ]);

        return response()->json([
            'data' => [
                'intent_reference' => $intent->reference,
                'expires_at'       => $intent->expires_at,
            ],
        ]);
    }

    /**
     * Confirmer un paiement Kkiapay et activer/prolonger l'abonnement.
     *
     * Double verification :
     * 1. L'intention de paiement (generee par /initiate) doit exister, appartenir
     *    a la boutique du demandeur, etre encore valide (non expiree, non deja
     *    consommee). C'est la garantie principale, independante de Kkiapay.
     * 2. La transaction elle-meme est revérifiee aupres de Kkiapay via la cle
     *    privee (statut + montant). Si la reponse de Kkiapay contient un champ
     *    permettant de recouper la reference d'intention (selon version d'API),
     *    on l'exploite en verification complementaire stricte ; sinon on se
     *    contente de (1) + (2) sans bloquer, mais on logue l'absence de
     *    corroboration pour audit.
     */
    #[OA\Post(
        path: '/subscription/kkiapay/confirm',
        summary: 'Confirmer un paiement Kkiapay et activer l\'abonnement',
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['transaction_id', 'intent_reference'],
                properties: [
                    new OA\Property(property: 'transaction_id',  type: 'string', example: '3iH6wjHJ3'),
                    new OA\Property(property: 'intent_reference', type: 'string', example: 'sub_aZ9...'),
                ]
            )
        ),
        tags: ['Abonnement'],
        responses: [
            new OA\Response(response: 200, description: 'Abonnement active'),
            new OA\Response(response: 422, description: 'Transaction ou intention invalide'),
        ]
    )]
    public function confirm(Request $request): JsonResponse
    {
        $shopId = $this->resolveOwnShopId($request);
        $shop   = StationeryShop::findOrFail($shopId);

        $validated = $request->validate([
            'transaction_id'   => ['required', 'string', 'max:100'],
            'intent_reference' => ['required', 'string', 'max:64'],
        ]);

        // ── Verification 1 : l'intention doit etre valide ET appartenir a CETTE boutique ──
        $intent = KkiapayPaymentIntent::where('reference', $validated['intent_reference'])
            ->where('shop_id', $shopId)
            ->first();

        if (! $intent) {
            Log::warning('Kkiapay confirm : intention introuvable ou n\'appartenant pas a la boutique.', [
                'shop_id'   => $shopId,
                'reference' => $validated['intent_reference'],
            ]);
            return response()->json(['message' => 'Intention de paiement invalide.'], 422);
        }

        if (! $intent->isUsable()) {
            return response()->json(['message' => 'Cette intention de paiement a expire ou a deja ete utilisee. Relancez un paiement.'], 422);
        }

        // ── Idempotence : si cette transaction a deja ete traitee, ne pas la rejouer ──
        $alreadyProcessed = SubscriptionPayment::where('transaction_ref', $validated['transaction_id'])->exists();
        if ($alreadyProcessed) {
            return response()->json([
                'message' => 'Cette transaction a deja ete traitee.',
                'data'    => $shop->fresh(),
            ]);
        }

        // ── Verification 2 : revalidation autoritative aupres de Kkiapay ──
        try {
            $transaction = $this->kkiapayClient()->verifyTransaction($validated['transaction_id']);
        } catch (\Throwable $e) {
            Log::error('Kkiapay verifyTransaction a echoue', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Impossible de verifier la transaction aupres de Kkiapay.'], 422);
        }

        $status = $transaction->status ?? ($transaction['status'] ?? null);
        $amount = $transaction->amount ?? ($transaction['amount'] ?? null);

        // Recuperation best-effort du champ "data" passe au widget, s'il est
        // renvoye par cette version de l'API Kkiapay (non garanti).
        $returnedData = $transaction->data
            ?? ($transaction['data'] ?? null)
            ?? ($transaction->requestData['data'] ?? null)
            ?? ($transaction['requestData']['data'] ?? null);

        if ($returnedData !== null) {
            if ($returnedData !== $intent->reference) {
                Log::warning('Kkiapay confirm : le champ data de la transaction ne correspond pas a l\'intention declaree.', [
                    'shop_id'            => $shopId,
                    'transaction_id'     => $validated['transaction_id'],
                    'data_recu'          => $returnedData,
                    'intention_attendue' => $intent->reference,
                ]);
                return response()->json(['message' => 'Cette transaction ne correspond pas a votre demande de paiement.'], 422);
            }
        } else {
            // L'API ne renvoie pas ce champ dans cette version/config : on le note
            // pour audit, sans bloquer (on reste protege par l'intention + l'idempotence).
            Log::info('Kkiapay confirm : champ data absent de la reponse verifyTransaction, corroboration non disponible pour cette transaction.', [
                'transaction_id' => $validated['transaction_id'],
            ]);
        }

        if ($status !== 'SUCCESS') {
            return response()->json(['message' => "La transaction n'a pas ete confirmee comme reussie (statut : {$status})."], 422);
        }

        $expectedAmount = (int) config('services.kkiapay.subscription_price', 35000);
        if ((int) $amount !== $expectedAmount) {
            Log::warning('Kkiapay : montant transaction different du prix attendu', [
                'transaction_id' => $validated['transaction_id'],
                'amount_recu'    => $amount,
                'amount_attendu' => $expectedAmount,
            ]);
            return response()->json(['message' => 'Le montant de la transaction ne correspond pas au prix de l\'abonnement.'], 422);
        }

        // Periode : prolonge a partir de la fin d'abonnement actuelle si encore active,
        // sinon a partir d'aujourd'hui.
        $periodStart = ($shop->subscription_end && $shop->subscription_end->isFuture())
            ? $shop->subscription_end->copy()
            : now();
        $periodEnd = $periodStart->copy()->addDays(30);

        SubscriptionPayment::create([
            'shop_id'         => $shop->id,
            'validated_by'    => $request->user()->id,
            'amount'          => $expectedAmount,
            'payment_method'  => 'kkiapay',
            'transaction_ref' => $validated['transaction_id'],
            'payment_date'    => now(),
            'period_start'    => $periodStart,
            'period_end'      => $periodEnd,
            'status'          => 'validated',
            'notes'           => 'Paiement automatique via Kkiapay (self-service).',
        ]);

        $shop->update([
            'status'             => 'active',
            'subscription_start' => $shop->subscription_start ?? $periodStart,
            'subscription_end'   => $periodEnd,
        ]);

        $intent->update([
            'status'                   => 'consumed',
            'consumed_transaction_ref' => $validated['transaction_id'],
        ]);

        return response()->json([
            'message' => "Abonnement active jusqu'au {$periodEnd->toDateString()}.",
            'data'    => $shop->fresh(),
        ]);
    }

    /**
     * Webhook Kkiapay — a titre de journalisation/reconciliation UNIQUEMENT.
     * N'active PAS automatiquement un abonnement : le flux autoritatif est /confirm,
     * appele par le client authentifie apres succes du widget, avec verification
     * de l'intention de paiement liee a la boutique.
     */
    #[OA\Post(
        path: '/webhooks/kkiapay',
        summary: 'Webhook Kkiapay (journalisation, pas d\'activation automatique)',
        tags: ['Abonnement'],
        responses: [new OA\Response(response: 200, description: 'Recu')]
    )]
    public function webhook(Request $request): Response
    {
        $signature = $request->header('x-kkiapay-secret');
        $expected  = config('services.kkiapay.secret');

        if (! $signature || ! hash_equals((string) $expected, (string) $signature)) {
            Log::warning('Webhook Kkiapay recu avec une signature invalide.');
            return response('Invalid signature', 403);
        }

        Log::info('Webhook Kkiapay recu', $request->all());

        $transactionId = $request->input('transactionId');
        $isSuccess     = $request->boolean('isPaymentSucces');

        if ($isSuccess && $transactionId) {
            $alreadyProcessed = SubscriptionPayment::where('transaction_ref', $transactionId)->exists();
            if (! $alreadyProcessed) {
                Log::warning('Kkiapay : paiement reussi jamais confirme cote client - verification manuelle requise.', [
                    'transaction_id' => $transactionId,
                ]);
                // Volontairement pas d'auto-activation ici : voir docblock ci-dessus.
                // Le Super Admin peut retrouver cette transaction via les logs et
                // activer manuellement via /admin/shops/{id}/activate si necessaire.
            }
        }

        return response('OK', 200);
    }
}
