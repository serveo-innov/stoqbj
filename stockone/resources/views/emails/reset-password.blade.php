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
                <h2 style="color: #1a1a1a; margin: 0 0 16px;">Réinitialisation de mot de passe</h2>
                <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
                    Bonjour {{ $userFirstname }},
                </p>
                <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
                    Vous avez demandé la réinitialisation de votre mot de passe Stoq.bj.
                    Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
                    Ce lien est valable 60 minutes.
                </p>
                <table cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                    <tr>
                        <td style="background: #F97316; border-radius: 8px;">
                            <a href="{{ $resetUrl }}" style="display: inline-block; padding: 12px 28px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px;">
                                Réinitialiser mon mot de passe
                            </a>
                        </td>
                    </tr>
                </table>
                <p style="color: #9ca3af; font-size: 12px; line-height: 1.6;">
                    Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email —
                    votre mot de passe restera inchangé.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
