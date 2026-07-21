# Configuration Kkiapay — étapes manuelles

## 1. Installer le SDK PHP officiel

Dans le dossier backend Laravel :
```
composer require kkiapay/kkiapay-php
```

## 2. Créer un compte marchand Kkiapay

1. Va sur https://kkiapay.me et crée un compte marchand (gratuit).
2. Une fois le compte créé, va dans **Développeurs > API** sur ton tableau de bord.
3. Tu y trouveras 3 clés :
   - **Clé publique** (`public_key`) — utilisée côté client (widget JS), sans risque si exposée.
   - **Clé privée** (`private_key`) — usage serveur uniquement, sert à vérifier les transactions.
   - **Clé secrète** (`secret`) — usage serveur uniquement, sert à vérifier la signature des webhooks.
4. En mode test, utilise les clés **Sandbox** (visibles sur le même tableau de bord, section test).
   Les numéros de téléphone de test sont fournis par Kkiapay pour simuler succès/échec sans vrai argent.

## 3. Ajouter dans `.env`

```env
KKIAPAY_PUBLIC_KEY=ta_cle_publique
KKIAPAY_PRIVATE_KEY=ta_cle_privee
KKIAPAY_SECRET=ta_cle_secrete
KKIAPAY_SANDBOX=true
KKIAPAY_SUBSCRIPTION_PRICE=35000
```

⚠️ Quand tu passeras en production (vrais paiements), remplace les clés Sandbox par les clés Live
et mets `KKIAPAY_SANDBOX=false`.

## 4. Ajouter dans `config/services.php`

Ouvre ce fichier (il existe déjà par défaut dans Laravel, avec des entrées comme `mailgun`, `postmark`...)
et ajoute cette entrée dans le tableau retourné :

```php
'kkiapay' => [
    'public_key'         => env('KKIAPAY_PUBLIC_KEY'),
    'private_key'        => env('KKIAPAY_PRIVATE_KEY'),
    'secret'              => env('KKIAPAY_SECRET'),
    'sandbox'             => env('KKIAPAY_SANDBOX', true),
    'subscription_price'  => env('KKIAPAY_SUBSCRIPTION_PRICE', 35000),
],
```

## 5. Configurer le webhook côté Kkiapay

Sur le tableau de bord Kkiapay : **Développeurs > API > Webhooks** → ajoute l'URL :
```
https://ton-domaine-api.bj/api/v1/webhooks/kkiapay
```
(remplace par ton URL réelle de production — en local avec Laragon, Kkiapay ne pourra pas
atteindre `localhost`, il faudra un tunnel type ngrok pour tester le webhook en dev).

## 6. Vérifier la migration avant de l'exécuter

```
php artisan migrate:status
SHOW COLUMNS FROM subscription_payments LIKE 'payment_method';
```
Si la colonne n'est pas un ENUM MySQL, la migration fournie n'est pas nécessaire (supprime-la).

## 7. Tester le flux complet en sandbox

1. Lance `php artisan migrate` (après vérification du point 6).
2. Connecte-toi en tant qu'`admin_shop`.
3. Va sur **Paramètres > Abonnement**.
4. Clique sur "Payer via Mobile Money / Carte".
5. Utilise un numéro de téléphone de test Kkiapay (fourni sur leur doc Sandbox) pour simuler un succès.
6. Vérifie que l'abonnement passe bien à "Active" avec une nouvelle date d'expiration.
