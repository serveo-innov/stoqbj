<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; background: #f8f9fa; padding: 24px; margin: 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden;">
        <tr>
            <td style="background: #1a1a1a; padding: 24px; text-align: center;">
                <span style="color: #ffffff; font-size: 22px; font-weight: 800;">
                    Stoq<span style="color: #F97316;">.bj</span>
                </span>
            </td>
        </tr>
        <tr>
            <td style="padding: 32px 28px;">
                @if($isTrial)
                    <h2 style="color: #1a1a1a; margin: 0 0 16px;">Votre essai gratuit se termine bientôt</h2>
                    <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
                        Bonjour,
                    </p>
                    <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
                        L'essai gratuit de <strong>{{ $shopName }}</strong> sur Stoq.bj se termine dans
                        <strong>{{ $daysRemaining }} jour{{ $daysRemaining > 1 ? 's' : '' }}</strong>.
                        Passé ce délai, l'accès à votre espace sera suspendu jusqu'à votre abonnement.
                    </p>
                @else
                    <h2 style="color: #1a1a1a; margin: 0 0 16px;">Votre abonnement expire bientôt</h2>
                    <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
                        Bonjour,
                    </p>
                    <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
                        L'abonnement de <strong>{{ $shopName }}</strong> sur Stoq.bj expire dans
                        <strong>{{ $daysRemaining }} jour{{ $daysRemaining > 1 ? 's' : '' }}</strong>.
                        Renouvelez des maintenant pour eviter toute interruption de service.
                    </p>
                @endif
                <table cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                    <tr>
                        <td style="background: #F97316; border-radius: 8px;">
                            <a href="{{ $subscriptionUrl }}" style="display: inline-block; padding: 12px 28px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px;">
                                {{ $isTrial ? "S'abonner maintenant" : 'Renouveler mon abonnement' }}
                            </a>
                        </td>
                    </tr>
                </table>
                <p style="color: #9ca3af; font-size: 12px; line-height: 1.6;">
                    Si votre abonnement est deja a jour au moment de la reception de cet email, vous pouvez ignorer ce message.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
