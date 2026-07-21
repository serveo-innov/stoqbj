<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\ResetPasswordMail;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Auth', description: 'Authentification')]
class PasswordResetController extends Controller
{
    /**
     * Durée de validité du lien de réinitialisation (minutes)
     */
    private const TOKEN_EXPIRY_MINUTES = 60;

    /**
     * Demander un lien de réinitialisation par email
     */
    #[OA\Post(
        path: '/auth/forgot-password',
        summary: 'Demander un lien de reinitialisation de mot de passe',
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['email'],
                properties: [
                    new OA\Property(property: 'email', type: 'string', format: 'email', example: 'admin@pcc.bj'),
                ]
            )
        ),
        tags: ['Auth'],
        responses: [
            new OA\Response(response: 200, description: 'Email envoye si le compte existe'),
            new OA\Response(response: 422, description: 'Email invalide'),
        ]
    )]
    public function forgotPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $user = User::where('email', $validated['email'])->first();

        // Toujours retourner le même message, que le compte existe ou non,
        // pour ne pas laisser deviner quels emails sont enregistres.
        $genericResponse = response()->json([
            'message' => 'Si ce compte existe, un email de reinitialisation a ete envoye.',
        ]);

        if (! $user || ! $user->is_active) {
            return $genericResponse;
        }

        $token = Str::random(64);

        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $user->email],
            ['token' => Hash::make($token), 'created_at' => now()]
        );

        $frontendUrl = rtrim(config('app.frontend_url'), '/');
        $resetUrl = "{$frontendUrl}/set-password?token={$token}&email=" . urlencode($user->email);

        Mail::to($user->email)->send(new ResetPasswordMail($resetUrl, $user->firstname));

        return $genericResponse;
    }

    /**
     * Réinitialiser le mot de passe avec le token reçu par email
     */
    #[OA\Post(
        path: '/auth/reset-password',
        summary: 'Reinitialiser le mot de passe avec un token',
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['email', 'token', 'password', 'password_confirmation'],
                properties: [
                    new OA\Property(property: 'email',                 type: 'string', format: 'email'),
                    new OA\Property(property: 'token',                 type: 'string'),
                    new OA\Property(property: 'password',              type: 'string', example: 'NewPass@2025'),
                    new OA\Property(property: 'password_confirmation', type: 'string', example: 'NewPass@2025'),
                ]
            )
        ),
        tags: ['Auth'],
        responses: [
            new OA\Response(response: 200, description: 'Mot de passe reinitialise'),
            new OA\Response(response: 422, description: 'Token invalide, expire, ou donnees invalides'),
        ]
    )]
    public function resetPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email'    => ['required', 'email'],
            'token'    => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ], [
            'password.confirmed' => 'Les mots de passe ne correspondent pas.',
            'password.min'       => 'Le mot de passe doit contenir au moins 8 caracteres.',
        ]);

        $record = DB::table('password_reset_tokens')->where('email', $validated['email'])->first();

        if (! $record) {
            return response()->json(['message' => 'Lien de reinitialisation invalide ou deja utilise.'], 422);
        }

        $isExpired = now()->diffInMinutes($record->created_at) > self::TOKEN_EXPIRY_MINUTES;
        if ($isExpired) {
            DB::table('password_reset_tokens')->where('email', $validated['email'])->delete();
            return response()->json(['message' => 'Ce lien de reinitialisation a expire. Veuillez en redemander un.'], 422);
        }

        if (! Hash::check($validated['token'], $record->token)) {
            return response()->json(['message' => 'Lien de reinitialisation invalide.'], 422);
        }

        $user = User::where('email', $validated['email'])->first();
        if (! $user) {
            return response()->json(['message' => 'Compte introuvable.'], 422);
        }

        $user->update(['password' => Hash::make($validated['password'])]);
        $user->tokens()->delete();

        DB::table('password_reset_tokens')->where('email', $validated['email'])->delete();

        return response()->json(['message' => 'Mot de passe reinitialise avec succes. Vous pouvez vous connecter.']);
    }
}
