<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Utilisateurs', description: 'Gestion des utilisateurs')]
class UserController extends Controller
{
    use ResolvesShopId;

    /**
     * Liste des utilisateurs de la boutique
     */
    #[OA\Get(
        path: '/users',
        summary: 'Liste des utilisateurs',
        security: [['bearerAuth' => []]],
        tags: ['Utilisateurs'],
        responses: [new OA\Response(response: 200, description: 'Liste retournee')]
    )]
    public function index(Request $request): JsonResponse
    {
        $shopId = $this->requireShopId($request);

        $users = User::where('shop_id', $shopId)
            ->orderBy('name')
            ->get()
            ->map(fn($u) => $this->formatUser($u));

        return response()->json(['data' => $users]);
    }

    /**
     * Créer un utilisateur
     */
    #[OA\Post(
        path: '/users',
        summary: 'Creer un utilisateur',
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name', 'firstname', 'email', 'password', 'role'],
                properties: [
                    new OA\Property(property: 'name',      type: 'string',  example: 'Dossou'),
                    new OA\Property(property: 'firstname', type: 'string',  example: 'Aime'),
                    new OA\Property(property: 'email',     type: 'string',  example: 'dossou@pcc.bj'),
                    new OA\Property(property: 'phone',     type: 'string',  example: '+22997000003'),
                    new OA\Property(property: 'password',  type: 'string',  example: 'Password@123'),
                    new OA\Property(property: 'role',      type: 'string',  enum: ['admin_shop', 'gerant', 'caissier']),
                ]
            )
        ),
        tags: ['Utilisateurs'],
        responses: [
            new OA\Response(response: 201, description: 'Utilisateur cree'),
            new OA\Response(response: 422, description: 'Donnees invalides'),
        ]
    )]
    public function store(Request $request): JsonResponse
    {
        $shopId      = $this->requireShopId($request);
        $currentUser = $request->user();

        // Seul le Super Admin peut créer un admin_shop
        $allowedRoles = $currentUser->isSuperAdmin()
            ? ['admin_shop', 'gerant', 'caissier']
            : ['gerant', 'caissier'];

        $validated = $request->validate([
            'name'      => ['required', 'string', 'max:100'],
            'firstname' => ['required', 'string', 'max:100'],
            'email'     => ['required', 'email', 'max:150', 'unique:users,email'],
            'phone'     => ['nullable', 'string', 'max:20'],
            'password'  => ['required', 'string', 'min:8'],
            'role'      => ['required', Rule::in($allowedRoles)],
        ], [
            'email.unique' => 'Cette adresse email est deja utilisee.',
            'password.min' => 'Le mot de passe doit contenir au moins 8 caracteres.',
            'role.in'      => 'Role invalide. Roles autorises : ' . implode(', ', $allowedRoles),
        ]);

        $user = User::create([
            'shop_id'   => $shopId,
            'name'      => $validated['name'],
            'firstname' => $validated['firstname'],
            'email'     => $validated['email'],
            'phone'     => $validated['phone'] ?? null,
            'password'  => Hash::make($validated['password']),
            'role'      => $validated['role'],
            'is_active' => true,
        ]);

        return response()->json([
            'data'    => $this->formatUser($user),
            'message' => 'Utilisateur cree avec succes.',
        ], 201);
    }

    /**
     * Détail d'un utilisateur
     */
    #[OA\Get(
        path: '/users/{id}',
        summary: 'Detail utilisateur',
        security: [['bearerAuth' => []]],
        tags: ['Utilisateurs'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'OK')]
    )]
    public function show(Request $request, int $id): JsonResponse
    {
        $shopId = $this->requireShopId($request);
        $user   = User::where('shop_id', $shopId)->findOrFail($id);

        // Stats activité
        $stats = [
            'nb_sales_today'  => \App\Models\Sale::where('user_id', $id)->today()->count(),
            'nb_sales_month'  => \App\Models\Sale::where('user_id', $id)->whereMonth('sold_at', now()->month)->count(),
            'ca_today'        => \App\Models\Sale::where('user_id', $id)->today()->sum('net_amount'),
            'last_login_at'   => $user->last_login_at?->toISOString(),
            'last_login_ip'   => $user->last_login_ip,
        ];

        return response()->json([
            'data'  => $this->formatUser($user),
            'stats' => $stats,
        ]);
    }

    /**
     * Modifier un utilisateur
     */
    #[OA\Put(
        path: '/users/{id}',
        summary: 'Modifier un utilisateur',
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'name',      type: 'string'),
                    new OA\Property(property: 'firstname', type: 'string'),
                    new OA\Property(property: 'phone',     type: 'string'),
                    new OA\Property(property: 'role',      type: 'string', enum: ['admin_shop', 'gerant', 'caissier']),
                    new OA\Property(property: 'is_active', type: 'boolean'),
                ]
            )
        ),
        tags: ['Utilisateurs'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'OK')]
    )]
    public function update(Request $request, int $id): JsonResponse
    {
        $shopId      = $this->requireShopId($request);
        $currentUser = $request->user();
        $user        = User::where('shop_id', $shopId)->findOrFail($id);

        // Empêcher de modifier son propre rôle ou statut
        if ($user->id === $currentUser->id) {
            return response()->json([
                'message' => 'Vous ne pouvez pas modifier votre propre compte via cet endpoint.',
            ], 403);
        }

        $allowedRoles = $currentUser->isSuperAdmin()
            ? ['admin_shop', 'gerant', 'caissier']
            : ['gerant', 'caissier'];

        $validated = $request->validate([
            'name'      => ['sometimes', 'string', 'max:100'],
            'firstname' => ['sometimes', 'string', 'max:100'],
            'phone'     => ['nullable', 'string', 'max:20'],
            'role'      => ['sometimes', Rule::in($allowedRoles)],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $user->update($validated);

        return response()->json([
            'data'    => $this->formatUser($user->fresh()),
            'message' => 'Utilisateur modifie.',
        ]);
    }

    /**
     * Changer le mot de passe d'un utilisateur
     */
    #[OA\Post(
        path: '/users/{id}/password',
        summary: 'Changer le mot de passe',
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['password'],
                properties: [
                    new OA\Property(property: 'password',              type: 'string', example: 'NewPass@2025'),
                    new OA\Property(property: 'password_confirmation', type: 'string', example: 'NewPass@2025'),
                ]
            )
        ),
        tags: ['Utilisateurs'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Mot de passe modifie')]
    )]
    public function changePassword(Request $request, int $id): JsonResponse
    {
        $shopId = $this->requireShopId($request);
        $user   = User::where('shop_id', $shopId)->findOrFail($id);

        $validated = $request->validate([
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ], [
            'password.confirmed' => 'Les mots de passe ne correspondent pas.',
            'password.min'       => 'Le mot de passe doit contenir au moins 8 caracteres.',
        ]);

        $user->update(['password' => Hash::make($validated['password'])]);

        // Révoquer tous les tokens actifs de cet utilisateur
        $user->tokens()->delete();

        return response()->json(['message' => 'Mot de passe modifie. L\'utilisateur devra se reconnecter.']);
    }

    /**
     * Changer son propre mot de passe
     */
    #[OA\Post(
        path: '/users/me/password',
        summary: 'Changer son propre mot de passe',
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['current_password', 'password'],
                properties: [
                    new OA\Property(property: 'current_password',      type: 'string', example: 'OldPass@2025'),
                    new OA\Property(property: 'password',              type: 'string', example: 'NewPass@2025'),
                    new OA\Property(property: 'password_confirmation', type: 'string', example: 'NewPass@2025'),
                ]
            )
        ),
        tags: ['Utilisateurs'],
        responses: [new OA\Response(response: 200, description: 'Mot de passe modifie')]
    )]
    public function changeOwnPassword(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'password'         => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        if (! Hash::check($validated['current_password'], $user->password)) {
            return response()->json([
                'message' => 'Le mot de passe actuel est incorrect.',
                'errors'  => ['current_password' => ['Mot de passe incorrect.']],
            ], 422);
        }

        $user->update(['password' => Hash::make($validated['password'])]);
        $user->tokens()->delete();

        return response()->json(['message' => 'Mot de passe modifie. Veuillez vous reconnecter.']);
    }

    /**
     * Modifier son propre profil (nom, prenom, telephone)
     *
     * MANQUE COMBLE : update() interdit explicitement l'auto-modification,
     * et il n'existait aucune autre route pour changer son propre nom/
     * prenom/telephone (seul le mot de passe l'etait, via changeOwnPassword
     * ci-dessus). Un admin_shop avec une faute de frappe dans son nom
     * n'avait aucun moyen de la corriger. Volontairement limite a ces 3
     * champs : ni role ni is_active ne sont modifiables ici (update() les
     * gere deja, pour les AUTRES utilisateurs).
     */
    #[OA\Put(
        path: '/users/me',
        summary: 'Modifier son propre profil (nom, prenom, telephone)',
        security: [['bearerAuth' => []]],
        tags: ['Utilisateurs'],
        responses: [new OA\Response(response: 200, description: 'Profil modifie')]
    )]
    public function updateOwnProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name'      => ['sometimes', 'string', 'max:100'],
            'firstname' => ['sometimes', 'string', 'max:100'],
            'phone'     => ['nullable', 'string', 'max:20'],
        ]);

        $user->update($validated);

        return response()->json([
            'data'    => $this->formatUser($user->fresh()),
            'message' => 'Profil modifie.',
        ]);
    }

    /**
     * Activer / Désactiver un utilisateur
     */
    #[OA\Post(
        path: '/users/{id}/toggle',
        summary: 'Activer ou desactiver un utilisateur',
        security: [['bearerAuth' => []]],
        tags: ['Utilisateurs'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Statut modifie')]
    )]
    public function toggle(Request $request, int $id): JsonResponse
    {
        $shopId = $this->requireShopId($request);
        $user   = User::where('shop_id', $shopId)->findOrFail($id);

        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Vous ne pouvez pas desactiver votre propre compte.'], 403);
        }

        // AVERTISSEMENT (non bloquant, pas de restriction) : desactiver le
        // dernier admin_shop actif d'une boutique laisse cette boutique
        // sans personne pour gerer ses utilisateurs (le gerant n'a pas ce
        // droit). super_admin reste volontairement libre de le faire, ce
        // role etant celui de l'equipe plateforme — on previent juste.
        $lastAdminWarning = null;
        if ($user->role === 'admin_shop' && $user->is_active) {
            $autresAdminsActifs = User::where('shop_id', $shopId)
                ->where('role', 'admin_shop')
                ->where('id', '!=', $user->id)
                ->where('is_active', true)
                ->exists();
            if (! $autresAdminsActifs) {
                $lastAdminWarning = "Attention : c'etait le dernier admin_shop actif de cette boutique. Plus personne ne pourra y gerer les utilisateurs tant qu'aucun admin_shop n'est reactive.";
            }
        }

        $user->update(['is_active' => ! $user->is_active]);

        // Révoquer les tokens si désactivé
        if (! $user->is_active) {
            $user->tokens()->delete();
        }

        $status = $user->is_active ? 'active' : 'desactive';
        return response()->json([
            'message'   => "Compte {$status}." . ($lastAdminWarning ? ' ' . $lastAdminWarning : ''),
            'is_active' => $user->is_active,
            'warning'   => $lastAdminWarning,
        ]);
    }

    /**
     * Supprimer un utilisateur (soft)
     */
    #[OA\Delete(
        path: '/users/{id}',
        summary: 'Supprimer un utilisateur',
        security: [['bearerAuth' => []]],
        tags: ['Utilisateurs'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Supprime')]
    )]
    public function destroy(Request $request, int $id): JsonResponse
    {
        $shopId = $this->requireShopId($request);
        $user   = User::where('shop_id', $shopId)->findOrFail($id);

        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Vous ne pouvez pas supprimer votre propre compte.'], 403);
        }

        // Suppression irreversible : un avertissement apres coup ne sert a
        // rien ici (contrairement a toggle()). On exige une confirmation
        // explicite avant de supprimer le dernier admin_shop actif d'une
        // boutique — meme principe que refund_confirmed dans Sale::cancel().
        // Pas un blocage : super_admin peut toujours le faire, juste pas
        // par inadvertance.
        if ($user->role === 'admin_shop' && $user->is_active) {
            $autresAdminsActifs = User::where('shop_id', $shopId)
                ->where('role', 'admin_shop')
                ->where('id', '!=', $user->id)
                ->where('is_active', true)
                ->exists();
            if (! $autresAdminsActifs && ! $request->boolean('confirm_last_admin')) {
                return response()->json([
                    'message' => "C'est le dernier admin_shop actif de cette boutique. Plus personne ne pourra y gerer les utilisateurs. Renvoyez la requete avec confirm_last_admin=true pour confirmer.",
                    'requires_confirmation' => 'confirm_last_admin',
                ], 409);
            }
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->json(['message' => 'Utilisateur supprime.']);
    }

    // ──────────────────────────────────────────
    // Helper
    // ──────────────────────────────────────────

    private function formatUser(User $user): array
    {
        return [
            'id'            => $user->id,
            'name'          => $user->name,
            'firstname'     => $user->firstname,
            'email'         => $user->email,
            'phone'         => $user->phone,
            'role'          => $user->role,
            'is_active'     => $user->is_active,
            'last_login_at' => $user->last_login_at?->toISOString(),
            'created_at'    => $user->created_at->toISOString(),
        ];
    }
}
