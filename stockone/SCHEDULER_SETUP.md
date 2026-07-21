# Planifier la suspension automatique des essais expirés

## 1. Placer le fichier de commande

Copie `SuspendExpiredTrials.php` dans :
```
app/Console/Commands/SuspendExpiredTrials.php
```

## 2. Tester la commande manuellement (avant de l'automatiser)

```
php artisan shops:suspend-expired-trials
```

Tu devrais voir soit "Aucune boutique en essai expiré à suspendre." soit la liste des boutiques suspendues.

## 3. Planifier l'exécution automatique

Ouvre `routes/console.php` (fichier existant par défaut dans Laravel 11+, généralement très court —
il contient juste la commande `inspire` de démo). Ajoute ces lignes en haut, sous les imports :

```php
use Illuminate\Support\Facades\Schedule;

Schedule::command('shops:suspend-expired-trials')->daily();
```

Ça exécute la vérification une fois par jour (minuit). Tu peux ajuster la fréquence si besoin
(`->hourly()`, `->everySixHours()`, etc.).

## 4. Faire tourner le planificateur Laravel

Le `Schedule` de Laravel ne s'exécute pas tout seul — il faut qu'une tâche système appelle
`php artisan schedule:run` régulièrement (Laravel recommande chaque minute, il décide lui-même
quand chaque tâche planifiée doit vraiment s'exécuter).

### En développement (Laragon, Windows)
Ouvre un terminal dédié et laisse tourner :
```
php artisan schedule:work
```
Cette commande simule le cron : elle appelle `schedule:run` chaque minute, tant que le terminal
reste ouvert. Pratique pour tester, mais pas pour la production (il faut un vrai cron/tâche planifiée
qui survit aux redémarrages).

### En production
Ajoute une tâche planifiée système (cron sur Linux, Planificateur de tâches sur Windows Server)
qui exécute cette commande chaque minute :
```
* * * * * cd /chemin/vers/stockone && php artisan schedule:run >> /dev/null 2>&1
```

## 5. Vérifier que ça fonctionne

Pour tester sans attendre 7 jours : modifie temporairement en base de données le
`subscription_end` d'une boutique de test à une date passée, relance la commande manuellement,
et vérifie que son statut passe bien à `suspended` et que ses utilisateurs sont déconnectés
(token révoqué) à la prochaine requête.
